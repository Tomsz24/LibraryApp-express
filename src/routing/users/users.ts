import { Router, Response, Request } from 'express';
import db from '../../../database/db';
import { RowDataPacket } from 'mysql2';
import { authenticateUser } from '../../middlewares/authenticateUser';

const router = Router();

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

export default router;
