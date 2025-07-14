import { Router } from 'express';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import { formatInTimeZone } from 'date-fns-tz';

import News from '../models/news.model';
import { requireAuth } from '../middleware/auth';
import { uploadAndGetMeta } from '../googleDriveClient';
import { bus } from '../progressBus';

const router = Router();

/* Multer (500 MB / file) */
const upload = multer({
    storage: multer.diskStorage({
        destination: (_r, _f, cb) => {
            const dir = path.resolve(__dirname, '../uploads');
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            cb(null, dir);
        },
        filename: (_r, f, cb) => {
            const ext = path.extname(f.originalname);
            const name = path.basename(f.originalname, ext);
            cb(null, `${name}-${Date.now()}${ext}`);
        }
    }),
    limits: { fileSize: 500 * 1024 * 1024 }
});

/* POST /api/upload  – body must include title, body, [newsId] */
router.post('/', requireAuth, upload.single('files'), async (req, res, next) => {
    try {
        const file = req.file!;
        const { title, body, newsId } = req.body;

        /* Phase-1 bar is already 100 % here            */
        bus.emit('progress', { file: file.originalname, phase: 'upload', pct: 100 });

        /* Phase-2: server → Drive                      */
        const start = Date.now();
        const meta = await uploadAndGetMeta(file.path, (loaded, total) => {
            const secs = (Date.now() - start) / 1000;
            const speed = secs ? (loaded / 1024 / 1024 / secs).toFixed(2) : '0';
            const eta = parseFloat(speed) > 0 ? (total - loaded) / 1024 / 1024 / parseFloat(speed) : 0;
            const pct = Math.round((loaded / total) * 100);
            bus.emit('progress', {
                file: file.originalname,
                phase: 'gdrive',
                pct,
                speed,
                eta: Math.round(eta)
            });
        });

        /* ─── create-or-append logic ───────────────────────────── */
        let newsDoc;
        if (newsId) {
            /* append to existing doc */
            newsDoc = await News.findByIdAndUpdate(
                newsId,
                { $push: { files: { ...meta, originalName: file.originalname } } },
                { new: true }
            );
            if (!newsDoc) return res.status(400).json({ message: 'newsId invalid' });
        } else {
            /* first file → new News document */
            newsDoc = await News.create({
                department: req.user!.dept,
                title,
                body,
                files: [{ ...meta, originalName: file.originalname }],
                createdAt: new Date(
                    formatInTimeZone(new Date(), 'Asia/Kolkata', 'yyyy-MM-dd HH:mm:ss')
                )
            });
        }

        res.status(201).json({ newsId: newsDoc._id }); // return id after every file
    } catch (err) { next(err); }
});

export default router;
