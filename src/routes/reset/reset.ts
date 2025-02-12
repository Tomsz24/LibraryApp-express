import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import pool from '../../../database/db';
import { RowDataPacket } from 'mysql2';
import nodemailer from 'nodemailer';

const router = Router();

router.post('/request', async (req: Request, res: Response) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'email is missing' });
  }

  try {
    // FIND USER IN DATABASE VIA EMAIL
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT *
       FROM Users
       WHERE email = ?`,
      [email],
    );

    if (!rows.length) {
      return res
        .status(400)
        .json({ error: 'No user found with the provided email' });
    }

    const user = rows[0];
    const resetToken = uuidv4();
    const resetTokenExpiry = new Date(Date.now() + 1000 * 30 * 60);

    //SAVE TOKEN IN DATABASE
    await pool.query(
      `UPDATE users
       SET reset_password_token   = ?,
           reset_password_expires = ?
       WHERE id = ?`,
      [resetToken, resetTokenExpiry, user.id],
    );

    // LINK TO SEND TO RESET PASSWORD - NEED TO BE MOVED!!!
    const resetLink = `http://localhost:3000/reset-password/confirm/${resetToken}`;
    const transporter = nodemailer.createTransport({
      service: process.env.GMAIL_SERVICE,
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_PASSWORD,
      },
    });

    await transporter.sendMail({
      from: 'Library App by Tomasz Wojciechowski <tomaszwojciechowski244@gmail.com>',
      to: email,
      subject: 'Reset your password',
      html: `
        <h1>Reset your password</h1>
        <p>Please click on the link below to reset your password</p>
        a href="${resetLink}">${resetLink}</a>
        `,
    });

    res.status(200).json({ message: 'Email sent with reset link' });
  } catch (err) {
    console.error('Error during password reset request: ', err);
    res.status(500).json({ error: 'Error during password reset request' });
  }
});

router.post('/change', async (req: Request, res: Response) => {
  const { token, newPassword } = req.body;

  if (!token || !newPassword) {
    return res
      .status(400)
      .json({ error: 'Token and new password are required' });
  }

  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT *
       FROM Users
       WHERE reset_password_token = ?
         AND reset_password_expires > NOW()`,
      [token],
    );

    if (!rows.length) {
      return res.status(400).json({ error: 'Invalid or expired token' });
    }

    const user = rows[0];

    const isSamePassword = await bcrypt.compare(newPassword, user.password);
    if (isSamePassword) {
      return res
        .status(400)
        .json({ error: 'New password cannot be the same as the old password' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await pool.query(
      `UPDATE users
       SET password               = ?,
           reset_password_token   = NULL,
           reset_password_expires = NULL
       WHERE id = ?`,
      [hashedPassword, user.id],
    );

    res.status(200).json({ message: 'Password reset successful' });
  } catch (err) {
    console.error('Error during password reset:', err);
    res.status(500).json({ error: 'Error resetting password' });
  }
});

export default router;
