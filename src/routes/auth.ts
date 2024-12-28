import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { AppDataSource } from '../server';
import { User } from '../entities/User';

const router = Router();

// 用户注册
router.post('/register', async (req, res) => {
    const userRepository = AppDataSource.getRepository(User);
    const { email, password } = req.body;

    try {
        const existingUser = await userRepository.findOne({
            where: { email }
        });

        if (existingUser) {
            return res.status(400).json({ error: 'User already exists' });
        }

        const user = userRepository.create({
            email,
            password, // 注意：实际应用中需要对密码进行加密
        });

        await userRepository.save(user);

        const token = jwt.sign(
            { userId: user.id, email: user.email },
            process.env.JWT_SECRET || 'your-secret-key',
            { expiresIn: '24h' }
        );

        res.json({ token });
    } catch (error) {
        res.status(500).json({ error: 'Failed to register user' });
    }
});

// 用户登录
router.post('/login', async (req, res) => {
    const userRepository = AppDataSource.getRepository(User);
    const { email, password } = req.body;

    try {
        const user = await userRepository.findOne({
            where: { email }
        });

        if (!user || user.password !== password) { // 注意：实际应用中需要使用安全的密码比较
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const token = jwt.sign(
            { userId: user.id, email: user.email },
            process.env.JWT_SECRET || 'your-secret-key',
            { expiresIn: '24h' }
        );

        res.json({ token });
    } catch (error) {
        res.status(500).json({ error: 'Failed to login' });
    }
});

export const authRouter = router; 