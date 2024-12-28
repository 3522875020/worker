import 'reflect-metadata';
import express, { Request, Response, NextFunction } from 'express';
import { expressjwt as jwt } from 'express-jwt';
import { mailsRouter } from './routes/mails';
import { authRouter } from './routes/auth';
import { ImapService } from './services/imap_service';
import { AppDataSource } from './data-source';
import * as dotenv from 'dotenv';

// 加载环境变量
dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// 中间件
app.use(express.json());

// JWT 认证中间件
const jwtMiddleware = jwt({
    secret: process.env.JWT_SECRET || 'your-secret-key',
    algorithms: ['HS256'],
}).unless({ path: ['/api/auth/login', '/api/auth/register'] });

app.use(jwtMiddleware);

// 路由
app.use('/api/mails', mailsRouter);
app.use('/api/auth', authRouter);

// 错误处理中间件
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
    console.error('Error:', err);
    
    if (err.name === 'UnauthorizedError') {
        return res.status(401).json({ message: 'Invalid token' });
    }
    
    res.status(500).json({ message: 'Internal Server Error' });
});

let imapService: ImapService | null = null;

// 初始化数据库连接并启动服务器
async function startServer() {
    try {
        // 初始化数据库连接
        await AppDataSource.initialize();
        console.log('Database connection initialized');
        
        // 启动服务器
        app.listen(port, () => {
            console.log(`Server is running on port ${port}`);
            
            // 确保所有必需的环境变量都已设置
            const requiredEnvVars = ['IMAP_HOST', 'IMAP_PORT', 'IMAP_USER', 'IMAP_PASSWORD'];
            const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);
            
            if (missingEnvVars.length > 0) {
                console.warn(`Warning: Missing IMAP configuration: ${missingEnvVars.join(', ')}`);
                return;
            }

            try {
                // 启动 IMAP 服务
                imapService = new ImapService();
                
                // 监听新邮件事件
                imapService.on('newMail', (mail) => {
                    console.log('New mail received:', mail.subject);
                });

                // 监听错误事件
                imapService.on('error', (error) => {
                    console.error('IMAP service error:', error);
                });

                // 监听结束事件
                imapService.on('end', () => {
                    console.log('IMAP service ended');
                });

                // 连接到 IMAP 服务器
                imapService.connect();
            } catch (error) {
                console.error('Failed to initialize IMAP service:', error);
            }
        });
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}

// 优雅关闭
process.on('SIGTERM', async () => {
    console.log('SIGTERM received. Shutting down gracefully...');
    
    if (imapService) {
        imapService.disconnect();
    }
    
    await AppDataSource.destroy();
    process.exit(0);
});

startServer(); 