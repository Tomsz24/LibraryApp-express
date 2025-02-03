import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import db from '../../database/db';
import { RowDataPacket } from 'mysql2';

interface JwtPayload {
  id: string;
  email: string;
}

interface User {
  id: string;
  username: string;
  name: string;
  surname: string;
  email: string;
  password: string;
  is_active?: boolean;
  isAdmin?: boolean;
  number_of_books_checked_out?: number;
  avatar_url?: string;
  reset_password_token?: string;
  reset_password_expires?: Date;
  last_login?: Date;
  created_at?: Date;
  updated_at?: Date;
  activation_token?: string;
  activation_token_expires?: Date;
}

export const authenticateAdmin = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res
      .status(401)
      .json({ success: false, message: 'Access Denied. No token provided.' });
  }

  try {
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || 'secret',
    ) as JwtPayload;

    const [rows] = await db.query<User[] & RowDataPacket[]>(
      'SELECT id, isAdmin FROM users WHERE id = ?',
      [decoded.id],
    );

    if (rows.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: 'User not found.' });
    }

    const user = rows[0];

    if (!user.isAdmin) {
      return res
        .status(403)
        .json({ success: false, message: 'Access Denied. Admins only.' });
    }

    req.user = user;
    next();
  } catch (error) {
    return res
      .status(401)
      .json({ success: false, message: 'Invalid token. ' + error });
  }
};
