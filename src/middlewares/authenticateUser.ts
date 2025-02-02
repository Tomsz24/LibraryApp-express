import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';

declare global {
  namespace Express {
    interface Request {
      user?: { id: string; email?: string };
    }
  }
}

export const authenticateUser = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized: No token provided' });
  }

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET as string) as {
      id: string;
      email?: string;
    };
    next();
  } catch (err) {
    res
      .status(401)
      .json({ error: 'Unauthorized: Invalid token provided ' + err });
  }
};
