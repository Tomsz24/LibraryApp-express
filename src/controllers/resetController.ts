import { Request, Response, NextFunction } from 'express';
import { AppError } from '../middlewares/errorHandler';
import {
  getUserByEmail,
  saveTokenInDatabase,
  sendPasswordResetEmail,
  getUserByResetToken,
  updatePasswordAndClearResetToken,
} from '../services/resetService';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcrypt';

export const resetPasswordController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const { email } = req.body;

  try {
    if (!email) {
      throw new AppError('Email is missing', 400);
    }

    const user = await getUserByEmail(email);
    if (!user) {
      throw new AppError('User not found', 404);
    }

    const resetToken = uuidv4();
    const resetTokenExpiryDate = new Date(Date.now() + 1000 * 30 * 60);

    await saveTokenInDatabase(user.id, resetToken, resetTokenExpiryDate);
    await sendPasswordResetEmail(email, resetToken);

    res.status(200).json({ message: 'Email sent with reset link' });
  } catch (err) {
    next(err);
  }
};

export const changePasswordController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const { token, newPassword } = req.body;

  if (!token || !newPassword) {
    throw new AppError('Token or new password is missing', 400);
  }

  try {
    const user = await getUserByResetToken(token);

    if (!user || !user.password) {
      throw new AppError('User not found', 404);
    }

    const isSamePassword = await bcrypt.compare(newPassword, user.password);
    if (isSamePassword) {
      throw new AppError('New password cannot be the same as the old one', 400);
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await updatePasswordAndClearResetToken(user.id, hashedPassword);

    res.status(200).json({ message: 'Password changed successfully' });
  } catch (err) {
    next(err);
  }
};
