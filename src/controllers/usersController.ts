import { Request, Response, NextFunction } from 'express';
import { AppError } from '../middlewares/errorHandler';
import {
  getUserById,
  updateUser,
  checkActiveBorrowedBooks,
  deleteUser,
} from '../services/userService';

export const updateUserController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const { id } = req.params;
  const { email, name, surname, avatar_url = null } = req.body;

  try {
    if (req.user?.id !== id) {
      throw new AppError('Forbidden: You can only update your own data', 403);
    }

    const user = await getUserById(id);
    if (!user) {
      throw new AppError('User not found', 404);
    }

    const updateFields = {
      email: email && email !== user.email ? email : user.email,
      name: name && name !== user.name ? name : user.name,
      surname: surname && surname !== user.surname ? surname : user.surname,
      avatar_url:
        avatar_url && avatar_url !== user.avatar_url
          ? avatar_url
          : user.avatar_url,
    };

    await updateUser(id, updateFields);

    res.status(200).json({
      message: 'User updated successfully',
    });
  } catch (err) {
    next(err);
  }
};

export const deleteUserController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const userId = req.params.id;
  const requesterId = req.user?.id;

  try {
    if (userId !== requesterId) {
      throw new AppError(
        'Forbidden: You can only delete your own account',
        403,
      );
    }

    const user = await getUserById(userId);

    if (!user) {
      throw new AppError('User not found', 404);
    }

    const hasBorrowedBooks = await checkActiveBorrowedBooks(userId);

    if (hasBorrowedBooks) {
      throw new AppError(
        'You cannot deldete your account because of active borrowed books',
        403,
      );
    }

    await deleteUser(userId);

    res.status(200).json({
      message: 'User deleted successfully',
    });
  } catch (err) {
    next(err);
  }
};
