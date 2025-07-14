import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface JwtPayload {
    sub: string;
    dept: string;
    iat: number;
    exp: number;
    access?: 'limited' | 'full';
}

declare module 'express-serve-static-core' {
    interface Request {
        user?: JwtPayload;
    }
}

export const requireAuth = (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    const token = req.headers.authorization?.split(' ')[1];
    try {
        req.user = jwt.verify(token ?? '', process.env.JWT_SECRET!) as JwtPayload;
        return next();
    } catch {
        return res.status(401).json({ message: 'Token missing or invalid' });
    }
};
