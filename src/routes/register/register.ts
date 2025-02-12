import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import pool from '../../../database/db';
import nodemailer from 'nodemailer';
import { RowDataPacket } from 'mysql2';

const router = Router();

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

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_PASSWORD,
  },
});

router.get('/', (req, res) => {
  res.send('register');
});

router.post(
  '/',
  async (req: Request, res: Response): Promise<void | Response> => {
    const { username, password, name, email, surname, avatar_url } = req.body;
    const normalizedEmail = email.toLowerCase();
    const normalizedUsername = username.toLowerCase();

    // simple verify (rest validation is on frontend)
    if (!username || !password || !name || !email || !surname) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    try {
      // Verify if user already exist
      const [rows] = await pool.query<User[] & RowDataPacket[]>(
        'SELECT * FROM Users WHERE LOWER(email) = ? OR LOWER(username) = ?',
        [normalizedEmail, normalizedUsername],
      );

      if (rows.length > 0) {
        const existingUsername = rows[0].username.toLowerCase();
        const existingEmail = rows[0].email.toLowerCase();

        let errorMessage = 'User with ';

        if (
          existingEmail === normalizedEmail &&
          existingUsername === normalizedUsername
        ) {
          errorMessage += 'this email and username already exists.';
        } else if (existingEmail === normalizedEmail) {
          errorMessage += 'this email already exists.';
        } else if (existingUsername === normalizedUsername) {
          errorMessage += 'this username already exists.';
        }

        return res.status(400).json({ error: errorMessage });
      }

      // hashing password
      const hashedPassword = await bcrypt.hash(password, 10);

      //Activation token
      const activationToken: string = uuidv4();
      const tokenExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

      // creating uniq ID
      const id = uuidv4();

      const sql = `INSERT INTO users (id,
                                      username,
                                      name,
                                      surname,
                                      email,
                                      password,
                                      activation_token,
                                      activation_token_expires,
                                      avatar_url)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;

      const data = [
        id,
        username,
        name,
        surname,
        email,
        hashedPassword,
        activationToken,
        tokenExpiresAt,
        avatar_url || null,
      ];

      await pool.execute(sql, data);

      //sending email
      const activationLink = `http://localhost:3000/register/activate/${activationToken}`;
      await transporter.sendMail({
        from: 'Library App by Tomasz Wojciechowski <tomaszwojciechowski244@gmail.com>',
        to: email,
        subject: 'Activate your account',
        html: `
        <h1>Activate your account</h1>
        <p>Please click on the link below to activate your account</p>
        <a href="${activationLink}">${activationLink}</a>
      `,
      });

      res.status(201).json({
        message: 'User created and activation email has been send',
        userId: id,
      });
    } catch (err) {
      console.error('Registration error: ', err);
      res.status(500).json({ error: 'Registration error' });
    }
  },
);

router.get('/activate/:token', async (req, res) => {
  const { token } = req.params;
  console.log(req.params);
  try {
    const [rows] = await pool.query<User[] & RowDataPacket[]>(
      'SELECT * FROM users WHERE activation_token = ? AND activation_token_expires > NOW()',
      [token],
    );
    const user = rows[0];

    await pool.query(
      `UPDATE users
       SET is_active                = 1,
           activation_token         = NULL,
           activation_token_expires = NULL
       WHERE id = ?`,
      [user.id],
    );

    return res
      .status(200)
      .json({ message: 'User activated', isActive: user.is_active });
  } catch (err) {
    console.error('Activation error: ', err);
    res.status(500).json({ error: 'Activation error' });
  }
});

export default router;
