import { Router } from 'express';
import { AppDataSource } from '../data-source';
import { Mail } from '../entities/Mail';
import { Between, LessThanOrEqual } from 'typeorm';

const router = Router();

// 获取邮件列表
router.get('/', async (req, res) => {
    const mailRepository = AppDataSource.getRepository(Mail);
    const { address } = req.auth as { address: string };
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 100); // 限制最大返回数量
    const offset = Math.max(parseInt(req.query.offset as string) || 0, 0); // 确保 offset 不为负

    try {
        // 验证地址
        if (!address) {
            return res.status(400).json({ error: 'Address is required' });
        }

        const [mails, total] = await mailRepository.findAndCount({
            where: { address },
            order: { created_at: 'DESC' },
            take: limit,
            skip: offset,
            cache: true // 启用查询缓存
        });

        res.json({
            data: mails,
            total,
            limit,
            offset
        });
    } catch (error) {
        console.error('Error fetching mails:', error);
        res.status(500).json({ error: 'Failed to fetch mails' });
    }
});

// 获取单个邮件
router.get('/:id', async (req, res) => {
    const mailRepository = AppDataSource.getRepository(Mail);
    const { address } = req.auth as { address: string };
    const { id } = req.params;

    try {
        // 验证参数
        if (!address) {
            return res.status(400).json({ error: 'Address is required' });
        }

        const mailId = parseInt(id);
        if (isNaN(mailId)) {
            return res.status(400).json({ error: 'Invalid mail ID' });
        }

        const mail = await mailRepository.findOne({
            where: { id: mailId, address },
            cache: true // 启用查询缓存
        });

        if (!mail) {
            return res.status(404).json({ error: 'Mail not found' });
        }

        res.json(mail);
    } catch (error) {
        console.error('Error fetching mail:', error);
        res.status(500).json({ error: 'Failed to fetch mail' });
    }
});

// 删除邮件
router.delete('/:id', async (req, res) => {
    const mailRepository = AppDataSource.getRepository(Mail);
    const { address } = req.auth as { address: string };
    const { id } = req.params;

    try {
        // 验证参数
        if (!address) {
            return res.status(400).json({ error: 'Address is required' });
        }

        const mailId = parseInt(id);
        if (isNaN(mailId)) {
            return res.status(400).json({ error: 'Invalid mail ID' });
        }

        // 首先检查邮件是否存在
        const mail = await mailRepository.findOne({
            where: { id: mailId, address }
        });

        if (!mail) {
            return res.status(404).json({ error: 'Mail not found' });
        }

        // 执行删除操作
        await mailRepository.remove(mail);

        res.json({
            success: true,
            message: 'Mail deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting mail:', error);
        res.status(500).json({ error: 'Failed to delete mail' });
    }
});

// 清理过期邮件
router.delete('/cleanup/:days', async (req, res) => {
    const mailRepository = AppDataSource.getRepository(Mail);
    const days = parseInt(req.params.days) || 30;

    try {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - days);

        const result = await mailRepository.delete({
            created_at: LessThanOrEqual(cutoffDate)
        });

        res.json({
            success: true,
            deletedCount: result.affected || 0,
            message: `Deleted emails older than ${days} days`
        });
    } catch (error) {
        console.error('Error cleaning up mails:', error);
        res.status(500).json({ error: 'Failed to cleanup mails' });
    }
});

export const mailsRouter = router; 