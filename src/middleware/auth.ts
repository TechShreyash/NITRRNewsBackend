import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

/* Payload we embed in the JWT */
export interface JwtPayload {
  sub       : string;                 // user id
  deptShort : string;                 // "IT", "CSE", …
  deptLong  : string;                 // full department name
  access   ?: 'limited' | 'full';
  iat       : number;
  exp       : number;
}

declare module 'express-serve-static-core' {
  interface Request {
    user?: JwtPayload;
  }
}

/* Bearer-token guard */
export const requireAuth = (
  req: Request, res: Response, next: NextFunction
) => {
  const token = req.headers.authorization?.split(' ')[1];
  try {
    req.user = jwt.verify(token ?? '', process.env.JWT_SECRET!) as JwtPayload;
    return next();
  } catch {
    return res.status(401).json({ message: 'Token missing or invalid' });
  }
};
