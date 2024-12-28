import { Router } from 'express';
import { AppDataSource } from '../data-source';
import { Mail } from '../entities/Mail';

const router = Router();

// 获取邮件列表
router.get('/', async (req, res) => {
    const mailRepository = AppDataSource.getRepository(Mail);
    const { address } = req.auth as { address: string };
    const limit = parseInt(req.query.limit as string) || 10;
    const offset = parseInt(req.query.offset as string) || 0;

    try {
        const [mails, total] = await mailRepository.findAndCount({
            where: { address },
            order: { created_at: 'DESC' },
            take: limit,
            skip: offset
        });

        res.json({
            data: mails,
            total,
            limit,
            offset
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch mails' });
    }
});

// 获取单个邮件
router.get('/:id', async (req, res) => {
    const mailRepository = AppDataSource.getRepository(Mail);
    const { address } = req.auth as { address: string };
    const { id } = req.params;

    try {
        const mail = await mailRepository.findOne({
            where: { id: parseInt(id), address }
        });

        if (!mail) {
            return res.status(404).json({ error: 'Mail not found' });
        }

        res.json(mail);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch mail' });
    }
});

// 删除邮件
router.delete('/:id', async (req, res) => {
    const mailRepository = AppDataSource.getRepository(Mail);
    const { address } = req.auth as { address: string };
    const { id } = req.params;

    try {
        const result = await mailRepository.delete({
            id: parseInt(id),
            address
        });

        res.json({
            success: result.affected > 0
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete mail' });
    }
});

export const mailsRouter = router; 