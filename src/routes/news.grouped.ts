// src/routes/news.grouped.ts
import { Router, Request, Response, NextFunction } from 'express';
import type { PipelineStage } from 'mongoose';
import News from '../models/news.model';
import { requireAuth } from '../middleware/auth';

const router = Router();
const IST_TZ = 'Asia/Kolkata';
const DEFAULT_DAYS = 7;

/* ------------------------------------------------------------------ *
 * Date helpers
 * ------------------------------------------------------------------ */

/** Parse YYYY-MM-DD as IST start-of-day → UTC Date; null if invalid. */
function parseIstStart(dateStr?: string | null): Date | null {
    if (!dateStr) return null;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return null;
    // Build explicit +05:30 offset ISO string so JS parses reliably.
    const d = new Date(`${dateStr}T00:00:00+05:30`);
    return isNaN(d.getTime()) ? null : d;
}

/** Add whole days to a Date (UTC math). */
function addDays(date: Date, days: number): Date {
    const d = new Date(date);
    d.setUTCDate(d.getUTCDate() + days);
    return d;
}

/** Derive [from,toExclusive] UTC range based on query and fallback window. */
function getDateRange(q: Request['query']): { from?: Date; to?: Date } {
    const fromParsed = parseIstStart(q.from as string | undefined);
    const toParsed = parseIstStart(q.to as string | undefined);

    if (fromParsed && toParsed) {
        return { from: fromParsed, to: addDays(toParsed, 1) }; // inclusive end => +1
    }
    if (fromParsed) {
        return { from: fromParsed, to: addDays(fromParsed, DEFAULT_DAYS) };
    }

    // default last N days ending today IST
    const now = new Date();
    const fmt = new Intl.DateTimeFormat('en-CA', {
        timeZone: IST_TZ,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });
    const parts = fmt.formatToParts(now);
    const y = parts.find(p => p.type === 'year')?.value;
    const m = parts.find(p => p.type === 'month')?.value;
    const d = parts.find(p => p.type === 'day')?.value;
    const todayStart = parseIstStart(`${y}-${m}-${d}`)!;
    const from = addDays(todayStart, -DEFAULT_DAYS + 1);
    const to = addDays(todayStart, 1);
    return { from, to };
}

/* ------------------------------------------------------------------ *
 * Pipeline builders
 * ------------------------------------------------------------------ */

/**
 * Build pipeline that returns expanded items for a *single department*
 * (used for limited users; also used by admin if they pass ?dept=).
 */
function buildLimitedPipeline(
    match: Record<string, any>
): PipelineStage[] {
    const stages: PipelineStage[] = [
        { $match: match },
        {
            $set: {
                dayBucket: {
                    $dateTrunc: {
                        date: '$createdAt',
                        unit: 'day',
                        timezone: IST_TZ
                    }
                }
            }
        },
        {
            $group: {
                _id: '$dayBucket',
                total: { $sum: 1 },
                items: {
                    $push: {
                        _id: '$_id',
                        title: '$title',
                        body: '$body',
                        department: '$department',
                        createdAt: '$createdAt',
                        files: '$files'
                    }
                }
            }
        },
        {
            $project: {
                _id: 0,
                date: {
                    $dateToString: {
                        date: '$_id',
                        format: '%Y-%m-%d',
                        timezone: IST_TZ
                    }
                },
                total: 1,
                items: 1
            }
        },
        // sort by actual bucket value (string safe because YYYY-MM-DD)
        { $sort: { date: -1 } }
    ];
    return stages;
}

/**
 * Build pipeline that returns per-day summary counts *per department*
 * (used for full admins when not filtered to a specific dept).
 */
function buildAdminSummaryPipeline(
    match: Record<string, any>
): PipelineStage[] {
    const stages: PipelineStage[] = [
        { $match: match },
        {
            $set: {
                dayBucket: {
                    $dateTrunc: {
                        date: '$createdAt',
                        unit: 'day',
                        timezone: IST_TZ
                    }
                }
            }
        },
        {
            $group: {
                _id: { day: '$dayBucket', department: '$department' },
                count: { $sum: 1 }
            }
        },
        {
            $group: {
                _id: '$_id.day',
                total: { $sum: '$count' },
                departments: {
                    $push: { department: '$_id.department', count: '$count' }
                }
            }
        },
        {
            $project: {
                _id: 0,
                date: {
                    $dateToString: {
                        date: '$_id',
                        format: '%Y-%m-%d',
                        timezone: IST_TZ
                    }
                },
                total: 1,
                departments: 1
            }
        },
        { $sort: { date: -1 } }
    ];
    return stages;
}

/* ------------------------------------------------------------------ *
 * GET /api/news/grouped
 * ------------------------------------------------------------------ */
router.get(
    '/',
    requireAuth,
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const isAdmin = req.user?.access === 'full';
            const forcedDept = !isAdmin ? req.user?.deptShort : undefined;
            const deptParam = (req.query.dept as string) || undefined;
            const effectiveDept = forcedDept ?? deptParam;

            // build match filter
            const { from, to } = getDateRange(req.query);
            const match: Record<string, any> = {};
            if (effectiveDept) match.department = effectiveDept;
            if (from || to) {
                match.createdAt = {};
                if (from) match.createdAt.$gte = from;
                if (to) match.createdAt.$lt = to;
            }

            const pipeline = effectiveDept
                ? buildLimitedPipeline(match)       // dept filter → expanded
                : isAdmin
                    ? buildAdminSummaryPipeline(match) // admin summary
                    : buildLimitedPipeline(match);     // limited always comes here anyway

            const results = await News.aggregate(pipeline).exec();
            res.json(results);
        } catch (err) {
            next(err);
        }
    }
);

export default router;
