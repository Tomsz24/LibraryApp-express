import express, { Request, Response } from 'express';
import pool from '../../../database/db';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { RowDataPacket } from 'mysql2';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET is not defined');
}

router.post('/', async (req: Request, res: Response) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'email or password is missing' });
  }

  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT id, email, password, is_active
       FROM users
       WHERE email = ?`,
      [email],
    );

    if (!rows.length) {
      return res.status(400).json({ error: 'email or password is incorrect' });
    }

    const user = rows[0];

    if (user.is_active !== 1) {
      return res.status(403).json({ error: 'user is not active' });
    }

    const isPasswordValid: boolean = await bcrypt.compare(
      password,
      user.password,
    );

    if (!isPasswordValid) {
      return res.status(401).json({ error: 'email or password is incorrect' });
    }

    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, {
      expiresIn: '24h',
    });

    res.status(200).json({ message: 'Login successful', token: token });
  } catch (err) {
    res
      .status(500)
      .json({ message: 'Something went wrong on login', error: err });
  }
});

export default router;
