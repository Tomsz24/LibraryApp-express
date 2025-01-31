import express from "express";
import db from "../../../database/db";
const router = express.Router();

router.get("/", async (req, res) => {
  console.log("gmail", process.env.GMAIL_USER);
  try {
    const [rows] = await db.query("SELECT * FROM users");
    console.log(rows);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err });
  }
  console.log("users");
});

export default router;
