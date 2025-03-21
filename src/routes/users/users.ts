import { Router, Response, Request } from 'express';
import db from '../../../database/db';
import { RowDataPacket } from 'mysql2';
import { authenticateUser } from '../../middlewares/authenticateUser';

const router = Router();

router.get('/', authenticateUser, async (req: Request, res: Response) => {
  const userId = req.user?.id;

  try {
    const [rows] = await db.query<RowDataPacket[]>(
      `SELECT id, email, name, surname
       FROM users
       WHERE id = ?`,
      [userId],
    );

    if (!rows.length) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = rows[0];
    res.status(200).json({
      id: user.id,
      email: user.email,
      name: user.name,
      surname: user.surname,
    });
  } catch (error) {
    console.error('Error getting user: ', error);
    res.status(500).json({ error: 'Error getting user' });
  }
});

router.put('/:id', authenticateUser, async (req: Request, res: Response) => {
  const { id } = req.params;
  const { email, name, surname, avatar } = req.body;

  try {
    if (req.user?.id !== id) {
      return res.status(403).json({
        error: 'Forbidden: You can only update your own data',
      });
    }

    const [rows] = await db.query<RowDataPacket[]>(
      `
          SELECT email, name, surname, avatar_url
          FROM users
          WHERE id = ?
      `,
      [id],
    );

    if (!rows.length) {
      return res.status(404).json({ error: 'User not found' });
    }

    const currentData = rows[0];
    const updateFields: { [key: string]: string } = {};

    if (email && email !== currentData.email) {
      updateFields.email = email;
    }
    if (name && name !== currentData.name) {
      updateFields.name = name;
    }
    if (surname && surname !== currentData.surname) {
      updateFields.surname = surname;
    }
    if (avatar && avatar !== currentData.avatar_url) {
      updateFields.avatar_url = avatar;
    }

    if (Object.keys(updateFields).length === 0) {
      return res.status(200).json({ message: 'No changes detected' });
    }

    const fieldsToUpdate = Object.keys(updateFields)
      .map((field) => `${field} = ?`)
      .join(', ');
    const valuesToUpdate = Object.values(updateFields);

    await db.query(
      `
          UPDATE users
          SET ${fieldsToUpdate}
          WHERE id = ?
      `,
      [id, ...valuesToUpdate],
    );
  } catch (err) {
    console.error('Error updating user: ', err);
    return res.status(500).json({ error: 'Error updating user' });
  }
});

router.delete('/:id', authenticateUser, async (req: Request, res: Response) => {
  const userId = req.params.id;
  const requesterId = req.user?.id;

  try {
    if (userId !== requesterId) {
      return res.status(403).json({
        error: 'Forbidden: You can only delete your own account',
      });
    }

    const [rows] = await db.query<RowDataPacket[]>(
      `SELECT id
       FROM usesrs
       WHERE id = ?`,
      [userId],
    );

    if (!rows.length) {
      return res.status(404).json({ error: 'User not found' });
    }

    const [borrowedBooks] = await db.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS active_borrowed_books
       FROM borrowed_books
       WHERE user_id = ?
         AND status = 'borrowed'
      `,
      [userId],
    );

    console.log(borrowedBooks[0]);

    if (borrowedBooks[0].active_borrowed_books > 0) {
      return res.status(403).json({
        error:
          'Forbidden: You can not delete your account because you have borrowed books',
      });
    }

    await db.query(
      `
          UPDATE borrowed_books
          SET user_id = NULL
          WHERE user_id = ?
      `,
      [userId],
    );

    await db.query(
      `
          DELETE
          FROM users
          WHERE id = ?
      `,
      [userId],
    );
    res.status(200).json({ message: 'User deleted' });
  } catch (err) {
    console.error('Error deleting user: ', err);
    return res.status(500).json({ error: 'Error deleting user' });
  }
});

export default router;
