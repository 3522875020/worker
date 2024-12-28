import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { AppDataSource } from '../data-source';
import { User } from '../entities/User';
import * as bcrypt from 'bcrypt';

const router = Router();

// 用户注册
router.post('/register', async (req, res) => {
    const userRepository = AppDataSource.getRepository(User);
    const { email, password } = req.body;

    try {
        // 验证请求数据
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        if (password.length < 6) {
            return res.status(400).json({ error: 'Password must be at least 6 characters long' });
        }

        // 检查邮箱格式
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ error: 'Invalid email format' });
        }

        // 检查用户是否已存在
        const existingUser = await userRepository.findOne({
            where: { email }
        });

        if (existingUser) {
            return res.status(400).json({ error: 'User already exists' });
        }

        // 加密密码
        const hashedPassword = await bcrypt.hash(password, 10);

        // 创建新用户
        const user = userRepository.create({
            email,
            password: hashedPassword
        });

        await userRepository.save(user);

        // 生成 JWT token
        const token = jwt.sign(
            { userId: user.id, email: user.email },
            process.env.JWT_SECRET || 'your-secret-key',
            { expiresIn: '24h' }
        );

        res.json({ token });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Failed to register user' });
    }
});

// 用户登录
router.post('/login', async (req, res) => {
    const userRepository = AppDataSource.getRepository(User);
    const { email, password } = req.body;

    try {
        // 验证请求数据
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        // 查找用户
        const user = await userRepository.findOne({
            where: { email }
        });

        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // 验证密码
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // 生成 JWT token
        const token = jwt.sign(
            { userId: user.id, email: user.email },
            process.env.JWT_SECRET || 'your-secret-key',
            { expiresIn: '24h' }
        );

        res.json({ token });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Failed to login' });
    }
});

export const authRouter = router; 