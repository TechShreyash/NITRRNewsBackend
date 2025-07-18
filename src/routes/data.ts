import { Router, Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';

import User from '../models/user.model';
import News from '../models/news.model';
import { requireAuth } from '../middleware/auth';

const router = Router();

router.get(
  '/dept',
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const depts = await User.aggregate([
        { $match: { access: 'limited' } },

        /* capture all needed fields for grouping */
        {
          $project: {
            deptShort: 1,
            deptLong: 1,
            username: 1,
          }
        },

        /* group by department; build user array */
        {
          $group: {
            _id: { deptShort: '$deptShort', deptLong: '$deptLong' },
            users: {
              $push: {
                _id: '$_id',
                username: '$username'
              }
            }
          }
        },

        /* reshape */
        {
          $project: {
            _id: 0,
            deptShort: '$_id.deptShort',
            deptLong:  '$_id.deptLong',
            users: 1
          }
        },

        /* sort departments alpha; also sort embedded users via $setUnion trick */
        {
          $addFields: {
            users: {
              $sortArray: {
                input: '$users',
                sortBy: { username: 1 }
              }
            }
          }
        },

        { $sort: { deptShort: 1 } }
      ]);

      res.json(depts);
    } catch (err) { next(err); }
  }
);


/* ──────────────────────────────────────────────────────────────────────────────
 * GET /api/data/user
 * Return profile of authenticated user (minus password/hash).
 * ----------------------------------------------------------------------------- */
router.get(
  '/user',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = req.user!.sub;                     // set by requireAuth
      const user = await User.findById(id)
        .select('-password -passwordHash -__v')      // omit secrets & noise
        .lean();

      if (!user) return res.status(404).json({ message: 'User not found' });
      res.json(user);
    } catch (err) { next(err); }
  }
);


/* ──────────────────────────────────────────────────────────────────────────────
 * GET /api/data/news/:id
 * Fetch a single news document; limited users can only see their own dept.
 * ----------------------------------------------------------------------------- */
router.get(
  '/news/:id',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      /* validate ObjectId format */
      if (!mongoose.Types.ObjectId.isValid(id))
        return res.status(400).json({ message: 'Invalid news id' });

      /* fetch */
      const doc = await News.findById(id).select(
        'title body department files createdAt'
      );
      if (!doc) return res.status(404).json({ message: 'News not found' });

      /* access control */
      if (req.user?.access === 'limited' && doc.department !== req.user.deptShort)
        return res.status(403).json({ message: 'Forbidden' });

      res.json(doc);
    } catch (err) { next(err); }
  }
);

export default router;
