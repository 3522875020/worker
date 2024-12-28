import Imap from 'imap';
import { simpleParser, ParsedMail } from 'mailparser';
import { AppDataSource } from '../data-source';
import { Mail } from '../entities/Mail';
import { EventEmitter } from 'events';
import { Repository } from 'typeorm';

interface ImapConfig {
    user: string;
    password: string;
    host: string;
    port: number;
    tls: boolean;
    tlsOptions: { rejectUnauthorized: boolean };
}

export class ImapService extends EventEmitter {
    private imap: Imap;
    private isConnected: boolean = false;
    private mailRepository?: Repository<Mail>;
    private reconnectAttempts: number = 0;
    private readonly maxReconnectAttempts: number = 5;
    private readonly reconnectInterval: number = 5000;

    constructor() {
        super();

        // 检查必需的环境变量
        const requiredEnvVars = ['IMAP_HOST', 'IMAP_PORT', 'IMAP_USER', 'IMAP_PASSWORD'];
        const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);
        
        if (missingEnvVars.length > 0) {
            throw new Error(`Missing required IMAP configuration: ${missingEnvVars.join(', ')}`);
        }

        const config: ImapConfig = {
            user: process.env.IMAP_USER!,
            password: process.env.IMAP_PASSWORD!,
            host: process.env.IMAP_HOST!,
            port: parseInt(process.env.IMAP_PORT!),
            tls: true,
            tlsOptions: { rejectUnauthorized: false }
        };

        // 验证配置
        this.validateConfig(config);

        this.imap = new Imap(config);

        // 绑定事件处理器
        this.imap.on('ready', this.onReady.bind(this));
        this.imap.on('error', this.onError.bind(this));
        this.imap.on('end', this.onEnd.bind(this));
    }

    private validateConfig(config: ImapConfig): void {
        if (!config.user || !config.password || !config.host || !config.port) {
            throw new Error('Invalid IMAP configuration: missing required fields');
        }

        if (config.port <= 0 || config.port > 65535) {
            throw new Error('Invalid IMAP port number');
        }

        console.log('IMAP Configuration:', {
            host: config.host,
            port: config.port,
            user: config.user,
            tls: config.tls
        });
    }

    // 获取 repository
    private getMailRepository(): Repository<Mail> {
        if (!this.mailRepository) {
            if (!AppDataSource.isInitialized) {
                throw new Error('Database connection is not initialized');
            }
            this.mailRepository = AppDataSource.getRepository(Mail);
        }
        return this.mailRepository;
    }

    // 连接到 IMAP 服务器
    public connect(): void {
        if (!this.isConnected) {
            this.reconnectAttempts = 0;
            this.imap.connect();
        }
    }

    // 断开连接
    public disconnect(): void {
        if (this.isConnected) {
            this.imap.end();
        }
    }

    // 当连接就绪时
    private onReady(): void {
        console.log('IMAP Connection ready');
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.openInbox();
    }

    // 当发生错误时
    private onError(err: Error): void {
        console.error('IMAP Error:', err);
        this.emit('error', err);
        
        if (this.isConnected) {
            this.disconnect();
        }
    }

    // 当连接结束时
    private onEnd(): void {
        console.log('IMAP Connection ended');
        this.isConnected = false;
        this.emit('end');
        
        // 尝试重新连接
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
            setTimeout(() => this.connect(), this.reconnectInterval);
        } else {
            console.error('Max reconnection attempts reached');
            this.emit('error', new Error('Max reconnection attempts reached'));
        }
    }

    // 打开收件箱并监听新邮件
    private openInbox(): void {
        this.imap.openBox('INBOX', false, (err, box) => {
            if (err) {
                console.error('Error opening inbox:', err);
                this.emit('error', err);
                return;
            }

            console.log('Inbox opened successfully');
            
            // 移除之前的监听器以避免重复
            this.imap.removeAllListeners('mail');
            
            // 监听新邮件
            this.imap.on('mail', this.onNewMail.bind(this));

            // 搜索未读邮件
            this.searchUnread();
        });
    }

    // 当收到新邮件时
    private onNewMail(): void {
        console.log('New mail notification received');
        this.searchUnread();
    }

    // 搜索未读邮件
    private searchUnread(): void {
        this.imap.search(['UNSEEN'], (err, results) => {
            if (err) {
                console.error('Error searching unread emails:', err);
                this.emit('error', err);
                return;
            }

            if (results.length === 0) {
                console.log('No unread emails found');
                return;
            }

            console.log(`Found ${results.length} unread email(s)`);
            this.fetchEmails(results);
        });
    }

    // 获取邮件内容
    private fetchEmails(seqArr: number[]): void {
        const fetch = this.imap.fetch(seqArr, {
            bodies: '',
            markSeen: true
        });

        fetch.on('message', (msg, seqno) => {
            console.log(`Processing message #${seqno}`);
            const chunks: Buffer[] = [];

            msg.on('body', (stream, info) => {
                stream.on('data', (chunk) => {
                    chunks.push(chunk);
                });

                stream.once('end', async () => {
                    try {
                        const fullBody = Buffer.concat(chunks);
                        const parsed = await simpleParser(fullBody);
                        await this.processEmail(parsed);
                    } catch (error) {
                        console.error('Error processing email:', error);
                        this.emit('error', error);
                    }
                });
            });

            msg.once('error', err => {
                console.error('Error processing message:', err);
                this.emit('error', err);
            });
        });

        fetch.once('error', err => {
            console.error('Error fetching emails:', err);
            this.emit('error', err);
        });
    }

    // 处理单个邮件
    private async processEmail(parsed: ParsedMail): Promise<void> {
        try {
            // 解析收件人地址
            const to = Array.isArray(parsed.to) 
                ? parsed.to.map(t => t.value[0].address).join(', ')
                : parsed.to?.value[0].address || '';

            // 提取域名后的用户名作为地址
            const addressMatch = to.match(/@(.+?)>/);
            const address = addressMatch ? addressMatch[1] : to.split('@')[0];

            // 保存到数据库
            const repository = this.getMailRepository();
            const mail = repository.create({
                address,
                from: parsed.from?.value[0].address || '',
                to,
                cc: parsed.cc?.value?.map(c => c.address).join(', ') || '',
                subject: parsed.subject || '',
                text_content: parsed.text || '',
                html_content: parsed.html || '',
                attachments: parsed.attachments,
                headers: parsed.headers
            });

            await repository.save(mail);
            console.log(`Email saved successfully: ${mail.subject}`);
            this.emit('newMail', mail);
        } catch (error) {
            console.error('Error saving mail:', error);
            this.emit('error', error);
            throw error;
        }
    }
} 