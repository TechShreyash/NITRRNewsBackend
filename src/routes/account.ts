import { Router, Request, Response, NextFunction } from 'express';
import User from '../models/user.model';
import { requireAuth } from '../middleware/auth';

const router = Router();

/* ─── helper guard ─── */
const mustBeAdmin = (req: Request, res: Response, next: NextFunction) => {
    if (req.user?.access !== 'full')
        return res.status(403).json({ message: 'Admins only' });
    next();
};

/* ──────────────────────────────────────────
 *  POST /api/users
 *  Body: { username, password, deptShort, deptLong }
 *  → creates a limited department account (password stored as‑is)
 * ────────────────────────────────────────── */
router.post(
    '/',
    requireAuth,
    mustBeAdmin,
    async (req, res, next) => {
        try {
            const { username, password, deptShort, deptLong } = req.body;
            if (!username || !password || !deptShort || !deptLong)
                return res.status(400).json({ message: 'Missing fields' });

            if (await User.findOne({ username }))
                return res.status(409).json({ message: 'Username already exists' });

            const doc = await User.create({
                username,
                password,            // ← plain text per requirements
                deptShort,
                deptLong,
                access: 'limited'
            });

            res.status(201).json({ id: doc._id, username });
        } catch (err) { next(err); }
    }
);

/* ──────────────────────────────────────────
 *  DELETE /api/users/:id
 *  → deletes a limited account (won’t delete full admins)
 * ────────────────────────────────────────── */
router.delete(
    '/:id',
    requireAuth,
    mustBeAdmin,
    async (req, res, next) => {
        try {
            const { id } = req.params;
            const user = await User.findById(id);

            if (!user) return res.status(404).json({ message: 'User not found' });
            if (user.access !== 'limited')
                return res.status(400).json({ message: 'Cannot delete admin accounts' });

            await user.deleteOne();
            res.json({ message: 'User deleted' });
        } catch (err) { next(err); }
    }
);

export default router;
