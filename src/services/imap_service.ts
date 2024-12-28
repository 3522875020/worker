import Imap from 'imap';
import { simpleParser } from 'mailparser';
import { AppDataSource } from '../server';
import { Mail } from '../entities/Mail';
import { EventEmitter } from 'events';

export class ImapService extends EventEmitter {
    private imap: Imap;
    private isConnected: boolean = false;
    private mailRepository = AppDataSource.getRepository(Mail);

    constructor() {
        super();
        this.imap = new Imap({
            user: process.env.IMAP_USER || '',
            password: process.env.IMAP_PASSWORD || '',
            host: process.env.IMAP_HOST || '',
            port: parseInt(process.env.IMAP_PORT || '993'),
            tls: true,
            tlsOptions: { rejectUnauthorized: false }
        });

        // 绑定事件处理器
        this.imap.on('ready', this.onReady.bind(this));
        this.imap.on('error', this.onError.bind(this));
        this.imap.on('end', this.onEnd.bind(this));
    }

    // 连接到 IMAP 服务器
    public connect(): void {
        if (!this.isConnected) {
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
        this.openInbox();
    }

    // 当发生错误时
    private onError(err: Error): void {
        console.error('IMAP Error:', err);
        this.emit('error', err);
    }

    // 当连接结束时
    private onEnd(): void {
        console.log('IMAP Connection ended');
        this.isConnected = false;
        this.emit('end');
        
        // 尝试重新连接
        setTimeout(() => {
            console.log('Attempting to reconnect...');
            this.connect();
        }, 5000);
    }

    // 打开收件箱并监听新邮件
    private openInbox(): void {
        this.imap.openBox('INBOX', false, (err, box) => {
            if (err) {
                console.error('Error opening inbox:', err);
                return;
            }

            // 监听新邮件
            this.imap.on('mail', this.onNewMail.bind(this));

            // 搜索未读邮件
            this.searchUnread();
        });
    }

    // 当收到新邮件时
    private onNewMail(): void {
        this.searchUnread();
    }

    // 搜索未读邮件
    private searchUnread(): void {
        this.imap.search(['UNSEEN'], (err, results) => {
            if (err) {
                console.error('Error searching unread emails:', err);
                return;
            }

            if (results.length === 0) {
                return;
            }

            // 获取邮件内容
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
            const chunks: Buffer[] = [];

            msg.on('body', (stream, info) => {
                stream.on('data', (chunk) => {
                    chunks.push(chunk);
                });

                stream.once('end', async () => {
                    const fullBody = Buffer.concat(chunks);
                    const parsed = await simpleParser(fullBody);

                    // 解析收件人地址
                    const to = Array.isArray(parsed.to) 
                        ? parsed.to.map(t => t.value[0].address).join(', ')
                        : parsed.to?.value[0].address || '';

                    // 提取域名后的用户名作为地址
                    const addressMatch = to.match(/@(.+?)>/);
                    const address = addressMatch ? addressMatch[1] : to.split('@')[0];

                    // 保存到数据库
                    const mail = this.mailRepository.create({
                        address,
                        from: parsed.from?.value[0].address || '',
                        to,
                        cc: parsed.cc?.value.map(c => c.address).join(', ') || '',
                        subject: parsed.subject || '',
                        text_content: parsed.text || '',
                        html_content: parsed.html || '',
                        attachments: parsed.attachments,
                        headers: parsed.headers
                    });

                    try {
                        await this.mailRepository.save(mail);
                        this.emit('newMail', mail);
                    } catch (error) {
                        console.error('Error saving mail:', error);
                    }
                });
            });

            msg.once('error', err => {
                console.error('Error processing message:', err);
            });
        });

        fetch.once('error', err => {
            console.error('Error fetching emails:', err);
        });
    }
} 