import { Router, Request } from 'express';
import News from '../models/news.model';
import { requireAuth } from '../middleware/auth';

const PAGE_SIZE = 20;
const router = Router();

router.get(
    '/',
    requireAuth,
    async (req: Request, res, next) => {
        try {
            /* 1. Parse ?page= query (1-based, default 1) */
            const page = Math.max(parseInt(String(req.query.page ?? '1'), 10), 1);

            /* 2. Access filter: limited ⇒ only that department */
            const filter =
                req.user?.access === 'limited'
                    ? { department: req.user.dept }
                    : {};

            /* 3. Total count for hasNextPage ----------------------------------- */
            const totalDocs = await News.countDocuments(filter);   // fast index scan:contentReference[oaicite:1]{index=1}
            const hasNextPage = page * PAGE_SIZE < totalDocs;        // true iff more docs remain

            /* 4. Fetch the actual page of data --------------------------------- */
            const items = await News.find(filter)
                .sort({ createdAt: -1 })
                .skip((page - 1) * PAGE_SIZE)
                .limit(PAGE_SIZE);

            res.json({
                page,
                pageSize: PAGE_SIZE,
                count: items.length,
                total: totalDocs,
                hasNextPage,
                data: items
            });
        } catch (err) {
            next(err);
        }
    }
);

export default router;
