import { Router } from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/user.model';

const router = Router();

/**
 * POST /api/login
 * Body: { username, password }
 * Returns: { token }
 */
router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  /* 1. Find the user */
  const user = await User.findOne({ username });
  if (!user || password !== user.password)
    return res.status(401).json({ message: 'Invalid credentials' });

  /* 2. Sign JWT — include deptShort / deptLong */
  const token = jwt.sign(
    {
      sub: user.id,        // MongoDB _id
      deptShort: user.deptShort, // e.g. "IT"
      deptLong: user.deptLong,  // e.g. "Information Technology"
      access: user.access     // "limited" | "full"
    },
    process.env.JWT_SECRET!,      // make sure this env var exists
  );

  res.json({ token });
});

export default router;
