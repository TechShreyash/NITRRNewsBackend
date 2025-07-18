// src/routes/upload.ts
import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';

import News from '../models/news.model';
import { requireAuth } from '../middleware/auth';
import { uploadAndGetMeta } from '../googleDriveClient';
import { bus } from '../progressBus';

const router = Router();

/* ──────────────────────────────────────────────────────────────
 * Multer config (store temp files locally; 500 MB / file)
 * Multer is the recommended middleware for handling multipart/form-data. :contentReference[oaicite:3]{index=3}
 * ────────────────────────────────────────────────────────────── */
const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      const dir = path.resolve(__dirname, '../uploads');
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname);
      const base = path.basename(file.originalname, ext);
      cb(null, `${base}-${Date.now()}${ext}`);
    }
  }),
  limits: { fileSize: 500 * 1024 * 1024 }
});

/* ──────────────────────────────────────────────────────────────
 * POST /api/upload
 * Form fields: title, body, [newsId], files=<file>   (single file per request)
 * For multi-file news posts, client sends sequential requests
 * passing back the newsId returned from the first upload.
 * Timestamps stored as UTC (new Date()) per MongoDB best practice. :contentReference[oaicite:4]{index=4}
 * ────────────────────────────────────────────────────────────── */
router.post(
  '/',
  requireAuth,
  upload.single('files'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const file = req.file;
      if (!file) {
        return res.status(400).json({ message: 'No file uploaded' });
      }

      const { title, body, newsId } = req.body;

      /* Phase 1 (browser → server) is done; push 100% for UI. */
      bus.emit('progress', {
        file: file.originalname,
        phase: 'upload',
        pct: 100
      });

      /* Phase 2 (server → Google Drive): upload with progress callback. */
      const start = Date.now();
      const meta = await uploadAndGetMeta(file.path, (loaded, total) => {
        const secs = (Date.now() - start) / 1000;
        const mbLoaded = loaded / 1024 / 1024;
        const speedMb = secs ? mbLoaded / secs : 0;
        const pct = total ? Math.round((loaded / total) * 100) : 0;
        const eta = speedMb > 0 ? (total / 1024 / 1024 - mbLoaded) / speedMb : 0;

        bus.emit('progress', {
          file: file.originalname,
          phase: 'gdrive',
          pct,
          speed: speedMb.toFixed(2), // MB/s
          eta: Math.round(eta)       // seconds
        });
      });

      /* Normalize meta for DB (store driveId, name, embedLink, mimeType). */
      const fileDoc = {
        driveId: meta.id,
        mimeType: meta.mimeType,
        embedLink: meta.embedLink,
        originalName: file.originalname
      };

      let newsDoc;
      if (newsId) {
        // append to existing News
        newsDoc = await News.findByIdAndUpdate(
          newsId,
          { $push: { files: fileDoc } },
          { new: true }
        );
        if (!newsDoc) {
          return res.status(400).json({ message: 'newsId invalid' });
        }
      } else {
        // first file ⇒ create News doc; store UTC timestamp (new Date()).
        // JS Date objects capture UTC instants and MongoDB stores UTC internally. :contentReference[oaicite:5]{index=5}
        newsDoc = await News.create({
          department: req.user!.deptShort,
          title,
          body,
          files: [fileDoc],
          createdAt: new Date()
        });
      }

      res.status(201).json({ newsId: newsDoc._id });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
