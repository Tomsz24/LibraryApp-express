import pool from '../../database/db';
import { RowDataPacket } from 'mysql2';

export const getUserById = async (
  userId: string,
): Promise<RowDataPacket | null> => {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT email, name, surname, avatar_url
     FROM Users
     WHERE id = ?`,
    [userId],
  );

  return rows.length ? rows[0] : null;
};

export const updateUser = async (
  userId: string,
  fieldsToUpdate: Record<string, string | undefined>,
) => {
  const fields = Object.keys(fieldsToUpdate)
    .filter((key) => fieldsToUpdate[key] !== undefined)
    .map((key) => `${key} = ?`)
    .join(', ');

  const values = Object.values(fieldsToUpdate).filter(
    (value) => value !== undefined,
  );

  if (fields.length === 0) {
    return;
  }

  await pool.query(
    `UPDATE Users
     SET ${fields}
     WHERE id = ?`,
    [userId, ...values],
  );
};

export const checkActiveBorrowedBooks = async (
  userId: string,
): Promise<boolean> => {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS active_borrowed_books
     FROM borrowed_books
     WHERE user_id = ?
       AND status = 'borrowed'`,
    [userId],
  );

  return rows[0].active_borrowed_books > 0;
};

export const deleteUser = async (userId: string) => {
  await pool.query(
    `
        UPDATE borrowed_books
        SET user_id = NULL
        WHERE user_id = ?
    `,
    [userId],
  );

  await pool.query(
    `DELETE
     FROM Users
     WHERE id = ?`,
    [userId],
  );
};
