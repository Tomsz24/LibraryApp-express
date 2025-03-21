import express, { Request, Response } from 'express';
import pool from './database/db';
import helmet from 'helmet';
import cors from 'cors';
import loginRoute from './src/routes/login/login';
import registerRoute from './src/routes/register/register';
import booksRoute from './src/routes/books/books';
import rentRoute from './src/routes/rent/rent';
import logsRoute from './src/routes/logs/logs';
import usersRoute from './src/routes/users/users';
import resetRoute from './src/routes/reset/reset';
import dotenv from 'dotenv';

// CONNECTION TEST FOR MYSQL DATABASE
(async () => {
  try {
    const connection = await pool.getConnection();
    console.log('Połączono z bazą danych.');
    connection.release();
  } catch (err) {
    console.error('Błąd podczas łączenia z bazą danych:', err);
    process.exit(1);
  }
})();

const app = express();
const port = 3000;
dotenv.config();

app.use(helmet());
app.use(
  cors({
    origin: 'http://localhost:5173', // Zezwól tylko na żądania z Twojego frontendu
    methods: ['GET', 'POST', 'PUT', 'DELETE'], // Dozwolone metody
    credentials: true, // Obsługa cookies, jeśli potrzebne
  }),
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

//ROUTES
app.use('/login', loginRoute);
app.use('/register', registerRoute);
app.use('/books', booksRoute);
app.use('/rent', rentRoute);
app.use('/logs', logsRoute);
app.use('/users', usersRoute);
app.use('/reset', resetRoute);

app.get('/', (req: Request, res: Response) => {
  res.send('Hello World!');
});

app.listen(port, () => {
  console.log(`Server started at http://localhost:${port}`);
});
