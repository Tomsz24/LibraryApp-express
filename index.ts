import express, { Request, Response } from "express";
import pool from "./database/db";
import helmet from "helmet";
import cors from "cors";
import loginRoute from "./src/routing/login/login";
import registerRoute from "./src/routing/register/register";
import booksRoute from "./src/routing/books/books";
import rentRoute from "./src/routing/rent/rent";
import logsRoute from "./src/routing/logs/logs";
import usersRoute from "./src/routing/users/users";
import dotenv from "dotenv";

// CONNECTION TEST FOR MYSQL DATABASE
(async () => {
  try {
    const connection = await pool.getConnection();
    console.log("Połączono z bazą danych.");
    connection.release();
  } catch (err) {
    console.error("Błąd podczas łączenia z bazą danych:", err);
    process.exit(1);
  }
})();

const app = express();
const port = process.env.PORT || 3000;
dotenv.config();

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

//ROUTES
app.use("/login", loginRoute);
app.use("/register", registerRoute);
app.use("/books", booksRoute);
app.use("/rent", rentRoute);
app.use("/logs", logsRoute);
app.use("/users", usersRoute);

app.get("/", (req: Request, res: Response) => {
  res.send("Hello World!");
});

app.listen(port, () => {
  console.log(`Server started at http://localhost:${port}`);
});
