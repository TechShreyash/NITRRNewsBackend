import { Router } from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/user.model';

const router = Router();

router.post('/login', async (req, res) => {
    const { username, password } = req.body;
    const user = await User.findOne({ username });
    if (!user || (password !== user.password)) {
        return res.status(401).json({ message: 'Invalid credentials' }

        );
    }
    const token = jwt.sign(
        { sub: user.id, dept: user.department, access: user.access },
        process.env.JWT_SECRET!,
        { expiresIn: '1h' }
    );
    res.json({ token });
});

export default router;
