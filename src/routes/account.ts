// src/routes/account.ts
import { Router, Request, Response, NextFunction } from 'express';
import User from '../models/user.model';
import { requireAuth } from '../middleware/auth';

const router = Router();

/* -------------------------------------------------
 * Helpers
 * ------------------------------------------------- */

/** Admin‑only guard — assumes requireAuth has already populated req.user */
function mustBeAdmin(req: Request, res: Response, next: NextFunction) {
  if (req.user?.access !== 'full') {
    return res.status(403).json({ message: 'Admins only' });
  }
  next();
}

/** Small async wrapper to cut down on repetitive try/catch */
const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) =>
  (req: Request, res: Response, next: NextFunction) =>
    Promise.resolve(fn(req, res, next)).catch(next);

/* -------------------------------------------------
 * GET /api/account/users
 * Admins get *all* users (both full + limited).
 * Used by your “Current Users” + “Manage Account” pages.
 * ------------------------------------------------- */
router.get(
  '/users',
  requireAuth,
  mustBeAdmin,
  asyncHandler(async (_req, res) => {
    const users = await User.find({}, 'username deptShort deptLong access').sort({
      access: -1, // admins first
      username: 1,
    });
    res.json(
      users.map((u) => ({
        id: u._id,
        username: u.username,
        deptShort: u.deptShort,
        deptLong: u.deptLong,
        access: u.access,
      }))
    );
  })
);

/* -------------------------------------------------
 * POST /api/account
 * Body: { username, password, deptShort, deptLong, [access] }
 * • By design you ONLY create limited department accounts here.
 * • If "access" is passed as "full" we ignore & force "limited"
 *   (protect your one super admin, etc.).
 * ------------------------------------------------- */
router.post(
  '/',
  requireAuth,
  mustBeAdmin,
  asyncHandler(async (req, res) => {
    const { username, password, deptShort, deptLong } = req.body;

    if (!username || !password || !deptShort || !deptLong) {
      return res.status(400).json({ message: 'Missing fields' });
    }

    // Unique username
    if (await User.findOne({ username })) {
      return res.status(409).json({ message: 'Username already exists' });
    }

    const doc = await User.create({
      username,
      password, // ← plain text per requirement
      deptShort,
      deptLong,
      access: 'limited',
    });

    res.status(201).json({
      id: doc._id,
      username: doc.username,
      deptShort: doc.deptShort,
      deptLong: doc.deptLong,
      access: doc.access,
    });
  })
);

/* -------------------------------------------------
 * PATCH /api/account/:id/password
 * Body: { password }
 * Change ANY user’s password (admin override).
 * (You could restrict to limited accounts only; leaving open
 *  so you can reset admin creds if needed. Change logic if desired.)
 * ------------------------------------------------- */
router.patch(
  '/:id/password',
  requireAuth,
  mustBeAdmin,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({ message: 'Password required' });
    }

    const user = await User.findById(id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    user.password = password; // plain text
    await user.save();

    res.json({ message: 'Password updated' });
  })
);

/* -------------------------------------------------
 * DELETE /api/account/:id
 * Deletes a LIMITED user. Won’t delete admin accounts.
 * ------------------------------------------------- */
router.delete(
  '/:id',
  requireAuth,
  mustBeAdmin,
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    const user = await User.findById(id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (user.access !== 'limited') {
      return res
        .status(400)
        .json({ message: 'Cannot delete admin accounts' });
    }

    await user.deleteOne();
    res.json({ message: 'User deleted' });
  })
);

export default router;
