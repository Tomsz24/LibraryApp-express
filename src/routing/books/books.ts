import express from 'express';
import db from '../../../database/db';
const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM books');
    console.log(rows);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err });
  }
  console.log('books');
});

export default router;
