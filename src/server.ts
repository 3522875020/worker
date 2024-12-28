import express, { Request, Response, NextFunction } from 'express';
import { expressjwt as jwt } from 'express-jwt';
import { DataSource } from 'typeorm';
import { mailsRouter } from './routes/mails.js';
import { authRouter } from './routes/auth.js';
import { adminRouter } from './routes/admin.js';
import { ImapService } from './services/imap_service.js';
import { Mail } from './entities/Mail.js';
import * as fs from 'fs';
import * as path from 'path';

const app = express();
const port = process.env.PORT || 3000;

// 数据库连接
export const AppDataSource = new DataSource({
  type: "postgres",
  host: process.env.DB_HOST || "localhost",
  port: parseInt(process.env.DB_PORT || "5432"),
  username: process.env.DB_USER || "postgres",
  password: process.env.DB_PASSWORD || "postgres",
  database: process.env.DB_NAME || "temp_email",
  synchronize: true,
  logging: process.env.NODE_ENV === 'development',
  entities: ["src/entities/*.ts"],
  subscribers: [],
  migrations: [],
  ssl: {
    rejectUnauthorized: true,
    ca: process.env.DB_SSL_CA
  }
});

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
app.use('/api/admin', adminRouter);

// 错误处理
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// 初始化 IMAP 服务
let imapService: ImapService;

// 启动服务器
AppDataSource.initialize().then(() => {
  app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
    
    // 启动 IMAP 服务
    imapService = new ImapService();
    imapService.connect();

    // 监听新邮件事件
    imapService.on('newMail', (mail: Mail) => {
      console.log('New mail received:', mail.subject);
    });

    // 监听错误事件
    imapService.on('error', (error: Error) => {
      console.error('IMAP service error:', error);
    });
  });
}).catch((error: Error) => console.log(error)); 