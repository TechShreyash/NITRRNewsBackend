import { Router, Request } from 'express';
import News from '../models/news.model';
import { requireAuth } from '../middleware/auth';

const PAGE_SIZE = 20;
const router = Router();

/**
 * GET /api/news?page=N
 * – limited users see only their department’s news
 * – returns pagination metadata + news list
 */
router.get(
  '/',
  requireAuth,
  async (req: Request, res, next) => {
    try {
      /* 1. page query (1-based) */
      const page = Math.max(parseInt(String(req.query.page ?? '1'), 10), 1);

      /* 2. Filter for limited users */
      const filter =
        req.user?.access === 'limited'
          ? { department: req.user.deptShort }
          : {};

      /* 3. Count for hasNextPage */
      const totalDocs   = await News.countDocuments(filter);
      const hasNextPage = page * PAGE_SIZE < totalDocs;

      /* 4. Page query (always keep department) */
      const items = await News.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * PAGE_SIZE)
        .limit(PAGE_SIZE)
        .select('title body department files createdAt');  // include dept

      res.json({
        page,
        pageSize   : PAGE_SIZE,
        count      : items.length,
        total      : totalDocs,
        hasNextPage,
        data       : items
      });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
