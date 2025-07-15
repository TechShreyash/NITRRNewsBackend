import User from '../models/user.model';
import { Router, Request, Response, NextFunction } from 'express';
import { requireAuth } from '../middleware/auth';
import mongoose from 'mongoose';
import News from '../models/news.model';

const router = Router();

router.get('/dept', async (_req, res, next) => {
    try {
        const depts = await User.aggregate([
            {
                $match: { access: 'limited' } // Filter users with limited access
            },
            {
                $group: {
                    _id: { deptShort: '$deptShort', deptLong: '$deptLong' }
                }
            },
            {
                $project: {
                    _id: 0,
                    deptShort: '$_id.deptShort',
                    deptLong: '$_id.deptLong'
                }
            },
            { $sort: { deptShort: 1 } }
        ]);

        res.json(depts); // e.g. [ {deptShort:'CS',deptLong:'Computer Science'} ]
    } catch (err) {
        next(err);
    }
});


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
        } catch (err) {
            next(err);
        }
    }
);

router.get(
    '/news/:id',
    requireAuth,
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { id } = req.params;

            /* 1️⃣ Validate ObjectId format */
            if (!mongoose.Types.ObjectId.isValid(id))
                return res.status(400).json({ message: 'Invalid news id' });

            /* 2️⃣ Find the document */
            const doc = await News.findById(id).select(
                'title body department files createdAt'
            );
            if (!doc) return res.status(404).json({ message: 'News not found' });

            /* 3️⃣ Access control */
            if (req.user?.access === 'limited' && doc.department !== req.user.deptShort)
                return res.status(403).json({ message: 'Forbidden' });

            /* 4️⃣ Success */
            res.json(doc);
        } catch (err) {
            next(err);
        }
    }
);

export default router;
