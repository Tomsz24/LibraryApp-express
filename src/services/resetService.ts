import { RowDataPacket } from 'mysql2';
import pool from '../../database/db';
import { User } from '../types/user';
import nodemailer from 'nodemailer';

export const getUserByEmail = async (email: string): Promise<User | null> => {
  const [rows] = await pool.query<User[] & RowDataPacket[]>(
    `SELECT *
     FROM Users
     WHERE email = ?`,
    [email],
  );

  return rows.length ? rows[0] : null;
};

export const saveTokenInDatabase = async (
  id: string,
  resetToken: string,
  resetTokenExpiryDate: Date,
) => {
  await pool.query(
    `UPDATE Users
     SET reset_password_token   = ?,
         reset_password_expires = ?
     WHERE id = ?`,
    [resetToken, resetTokenExpiryDate, id],
  );
};

export const sendPasswordResetEmail = async (
  email: string,
  resetToken: string,
): Promise<void> => {
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
      <a href="${resetLink}">${resetLink}</a>
    `,
  });
};

export const getUserByResetToken = async (
  resetToken: string,
): Promise<User | null> => {
  const [rows] = await pool.query<User[] & RowDataPacket[]>(
    `SELECT *
     FROM Users
     WHERE reset_password_token = ?`,
    [resetToken],
  );

  return rows.length ? rows[0] : null;
};

export const updatePasswordAndClearResetToken = async (
  id: string,
  hashedPassword: string,
) => {
  await pool.query(
    `UPDATE Users
     SET password               = ?,
         reset_password_token   = NULL,
         reset_password_expires = NULL
     WHERE id = ?`,
    [hashedPassword, id],
  );
};
