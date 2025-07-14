import { Router } from 'express';
import multer from 'multer';
import path from 'node:path';
import News from '../models/news.model';
import { requireAuth } from '../middleware/auth';
import { uploadAndGetMeta } from '../googleDriveClient';
import { formatInTimeZone } from 'date-fns-tz';

import fs from 'fs';

const router = Router();

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.resolve(__dirname, '../uploads');
        // Create uploads folder if absent
        if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        const name = path.basename(file.originalname, ext);
        const unique = `${name}-${Date.now()}${ext}`;
        cb(null, unique);
    }
});
const upload = multer({             // keep storage + size limits
    storage,
    limits: { fileSize: 500 * 1024 * 1024 }  // 500 MB per file
});

router.post(
    '/',
    requireAuth,
    upload.array('files'),
    async (req, res, next) => {
        try {
            const metas = await Promise.all(
                (req.files as Express.Multer.File[]).map(f => uploadAndGetMeta(f.path))
            );

            const nowIst = new Date(
                formatInTimeZone(new Date(), 'Asia/Kolkata', 'yyyy-MM-dd HH:mm:ss')
            );

            await News.create({
                department: req.user?.dept ?? 'General', // fallback if auth disabled
                title: req.body.title,
                body: req.body.body,
                files: metas.map((m, i) => ({ ...m, originalName: (req.files as Express.Multer.File[])[i].originalname })),
                createdAt: nowIst
            });

            res.status(201).json({ message: 'News created successfully' });
        } catch (err) { next(err); }
    }
);

export default router;