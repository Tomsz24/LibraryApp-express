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
import dotenv from 'dotenv';
import { ErrorHandler } from './src/middlewares/errorHandler';

import https from 'https';
import fs from 'fs';
import { redirectToHttps } from './src/middlewares/redirectToHttps';

const options = {
  key: fs.readFileSync('./key.pem'),
  cert: fs.readFileSync('./cert.pem'),
};

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
const port = 5005;
dotenv.config();

app.use(helmet());
app.use(redirectToHttps);

app.use(cors());
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
app.get('/example', (req, res) => {
  res.json({ message: 'Pierwszy komunikat' });
});

app.get('/', (req: Request, res: Response) => {
  res.send('Hello World!');
});

app.use(ErrorHandler);

https.createServer(options, app).listen(port, '0.0.0.0', () => {
  console.log(`Server started at https://localhost:${port}`);
});
