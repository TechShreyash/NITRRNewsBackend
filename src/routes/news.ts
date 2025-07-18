// src/routes/news.ts
import { Router, Request, Response, NextFunction } from 'express';
import News from '../models/news.model';
import { requireAuth } from '../middleware/auth';

const router = Router();
const PAGE_SIZE = 20;
const IST_OFFSET = '+05:30'; // India Standard Time

/* ------------------------------------------------------------------ *
 * Helpers
 * ------------------------------------------------------------------ */

/** Basic YYYY-MM-DD validation. */
function isYmd(str: string): boolean {
    return /^\d{4}-\d{2}-\d{2}$/.test(str);
}

/**
 * Parse YYYY-MM-DD as *IST midnight* and return UTC Date.
 * We do this by appending the explicit +05:30 offset and letting
 * the JS Date parser normalize to UTC internally. (Date parsing of
 * ISO8601 with numeric zone is standardized; MDN shows that the
 * offset is honored and the stored value becomes UTC.) :contentReference[oaicite:3]{index=3}
 */
function istMidnightToUtc(ymd: string): Date | null {
    if (!isYmd(ymd)) return null;
    const d = new Date(`${ymd}T00:00:00${IST_OFFSET}`);
    return isNaN(d.getTime()) ? null : d;
}

/** Return an exclusive end UTC (next IST midnight) given a start UTC. */
function plusOneDay(startUtc: Date): Date {
    const end = new Date(startUtc);
    end.setUTCDate(end.getUTCDate() + 1);
    return end;
}

/* ------------------------------------------------------------------ *
 * GET /api/news
 *   ?page=1
 *   [&dept=CS]              // admin only; ignored for limited users
 *   [&date=2025-07-15]      // IST calendar day
 * ------------------------------------------------------------------ */
router.get(
    '/',
    requireAuth,
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            /* ----- page param (1-based integer) ----- */
            const pageRaw = String(req.query.page ?? '1');
            const n = Number.parseInt(pageRaw, 10);
            const page = Number.isFinite(n) && n > 0 ? n : 1;

            /* ----- department scoping ----- */
            const isAdmin = req.user?.access === 'full';
            const deptParam = (req.query.dept as string) || undefined;
            const dept = isAdmin ? deptParam : req.user?.deptShort; // forced for limited

            /* ----- optional IST day filter ----- */
            const dateParam = (req.query.date as string) || undefined;
            let createdAtFilter: Record<string, Date> | undefined;
            if (dateParam) {
                const startUtc = istMidnightToUtc(dateParam);
                if (startUtc) {
                    const endUtc = plusOneDay(startUtc);
                    createdAtFilter = { $gte: startUtc, $lt: endUtc }; // inclusive start, exclusive end. :contentReference[oaicite:4]{index=4}
                }
            }

            /* ----- build Mongo filter ----- */
            const filter: Record<string, any> = {};
            if (dept) filter.department = dept;
            if (createdAtFilter) filter.createdAt = createdAtFilter;

            /* ----- pagination counts ----- */
            const totalDocs = await News.countDocuments(filter); // std count for paging. :contentReference[oaicite:5]{index=5}
            const hasNextPage = page * PAGE_SIZE < totalDocs;

            /* ----- fetch page ----- */
            const items = await News.find(filter)
                .sort({ createdAt: -1 })
                .skip((page - 1) * PAGE_SIZE)
                .limit(PAGE_SIZE)
                .select('title body department files createdAt');

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
