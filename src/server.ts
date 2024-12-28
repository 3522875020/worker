import 'reflect-metadata';
import express, { Request, Response, NextFunction } from 'express';
import { expressjwt as jwt } from 'express-jwt';
import { mailsRouter } from './routes/mails';
import { authRouter } from './routes/auth';
import { ImapService } from './services/imap_service';
import { AppDataSource } from './data-source';

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

// 错误处理
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
    console.error(err);
    res.status(500).json({ message: 'Internal Server Error' });
});

// 初始化 IMAP 服务
let imapService: ImapService;

// 初始化数据库连接并启动服务器
AppDataSource.initialize()
    .then(() => {
        app.listen(port, () => {
            console.log(`Server is running on port ${port}`);
            
            // 启动 IMAP 服务
            imapService = new ImapService();
            imapService.connect();

            // 监听新邮件事件
            imapService.on('newMail', (mail) => {
                console.log('New mail received:', mail.subject);
            });

            // 监听错误事件
            imapService.on('error', (error) => {
                console.error('IMAP service error:', error);
            });
        });
    })
    .catch((error) => {
        console.error('Error during Data Source initialization:', error);
    }); 