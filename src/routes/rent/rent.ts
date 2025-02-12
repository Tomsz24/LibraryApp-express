import express, { Request, Response } from 'express';
import { authenticateUser } from '../../middlewares/authenticateUser';
import pool from '../../../database/db'; // Połączenie z bazą danych
import { v4 as uuidv4 } from 'uuid';
import { FieldPacket, RowDataPacket } from 'mysql2';

// Typy: BorrowedBook oraz User
interface BorrowedBook {
  id: string; // UUID wypożyczenia
  book_id: number; // ID książki
  book_title: string; // Tytuł książki
  author_first_name: string; // Imię autora
  author_last_name: string; // Nazwisko autora
  user_id: string; // UUID użytkownika
  user_first_name: string; // Imię użytkownika
  user_last_name: string; // Nazwisko użytkownika
  status: 'borrowed' | 'returned'; // Status wypożyczenia
  borrowed_at: Date; // Data wypożyczenia
  due_date: Date; // Data zwrotu
}

interface User {
  id: string; // UUID użytkownika
  email?: string; // Email (opcjonalnie)
  name: string; // Imię
  surname: string; // Nazwisko
  numbers_of_books_checked_out: number; // Liczba aktualnie wypożyczonych książek
  current_borrowed: number;
}

interface Book {
  id: number; // ID książki
  title: string; // Tytuł książki
  author_first_name: string; // Imię autora
  author_last_name: string; // Nazwisko autora
  availability_status: 'available' | 'unavailable'; // Dostępność książki
}

interface UserRow {
  id: string;
  email?: string;
  name: string;
  surname: string;
  numbers_of_books_checked_out: number;
}

interface BookRow {
  id: number;
  title: string;
  author_first_name: string;
  author_last_name: string;
  availability_status: 'available' | 'unavailable';
}

// Funkcja: Pobierz użytkownika po ID
async function getUserById(userId: string): Promise<User | null> {
  try {
    // Wykonanie zapytania do bazy danych
    const [rows]: [UserRow[] & RowDataPacket[], FieldPacket[]] =
      await pool.query('SELECT * FROM Users WHERE id = ? LIMIT 1', [userId]);

    // Zweryfikuj, czy wynik jest poprawny
    if (rows && Array.isArray(rows) && rows.length > 0) {
      const user = rows[0]; // Pobieramy pierwszy wiersz wyników

      // Mapuj dane użytkownika do typu User
      return {
        id: user.id,
        email: user.email,
        name: user.name,
        surname: user.surname,
        numbers_of_books_checked_out: user.numbers_of_books_checked_out,
        current_borrowed: user.current_borrowed,
      };
    }

    // Jeśli brak wyników
    return null;
  } catch (error) {
    console.error(`Error in getUserById: ${error}`);
    throw new Error('Failed to fetch user from database.');
  }
}

// Funkcja: Pobierz książkę po ID
async function getBookById(bookId: number): Promise<Book | null> {
  try {
    // Złożone zapytanie SQL łączące tabele Books, book_authors i Authors
    const [rows]: [BookRow[] & RowDataPacket[], FieldPacket[]] =
      await pool.query(
        `
            SELECT b.id                  AS book_id,
                   b.title               AS book_title,
                   b.availability_status AS availability_status,
                   a.first_name          AS author_first_name,
                   a.last_name           AS author_last_name
            FROM Books b
                     LEFT JOIN book_authors ba ON ba.book_id = b.id
                     LEFT JOIN Authors a ON a.id = ba.author_id
            WHERE b.id = ?
            LIMIT 1
        `,
        [bookId],
      );

    // Zweryfikuj, czy wynik jest poprawny
    if (rows && Array.isArray(rows) && rows.length > 0) {
      const book = rows[0]; // Pobieramy pierwszy wiersz wyników

      // Mapuj dane książki do typu Book
      return {
        id: book.book_id,
        title: book.book_title,
        author_first_name: book.author_first_name || 'Unknown', // Jeśli brak autora, wpisz "Unknown"
        author_last_name: book.author_last_name || 'Unknown',
        availability_status: book.availability_status,
      };
    }

    // Jeśli brak wyników
    return null;
  } catch (error) {
    console.error(`Error in getBookById: ${error}`);
    throw new Error('Failed to fetch book from database.');
  }
}

// Funkcja: Dodaj rekord do `Borrowed_books`
async function addBorrowedBook(borrowedBook: BorrowedBook): Promise<void> {
  const {
    id,
    book_id,
    book_title,
    author_first_name,
    author_last_name,
    user_id,
    user_first_name,
    user_last_name,
    status,
    borrowed_at,
    due_date,
  } = borrowedBook;

  await pool.query(
    `
        INSERT INTO Borrowed_books
        (id, book_id, book_title, author_first_name, author_last_name, user_id, user_first_name, user_last_name, status,
         borrowed_at, due_date)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      id,
      book_id,
      book_title,
      author_first_name,
      author_last_name,
      user_id,
      user_first_name,
      user_last_name,
      status,
      borrowed_at,
      due_date,
    ],
  );
}

// Funkcja: Zmień status książki
async function updateBookStatus(
  bookId: number,
  status: 'available' | 'unavailable',
): Promise<void> {
  await pool.query('UPDATE Books SET availability_status = ? WHERE id = ?', [
    status,
    bookId,
  ]);
}

// Funkcja: Zweryfikuj limit użytkownika
async function incrementUserBorrowCount(userId: string): Promise<void> {
  await pool.query(
    `UPDATE Users
     SET current_borrowed = current_borrowed + 1
     WHERE id = ?`,
    [userId],
  );
}

// Router Express
const router = express.Router();

// Endpoint: Wypożyczenie książki
router.post('/', authenticateUser, async (req: Request, res: Response) => {
  const { book_id } = req.body;

  console.log(book_id);

  if (!book_id || typeof book_id !== 'number') {
    return res
      .status(400)
      .json({ error: 'Book ID is required and must be a number.' });
  }

  try {
    // Pobierz dane użytkownika z JWT middleware
    const userId = req.user?.id;

    if (!userId) {
      return res
        .status(401)
        .json({ error: 'Unauthorized: User not found in token.' });
    }

    // Pobierz użytkownika z bazy danych
    const user = await getUserById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    // Sprawdź limit wypożyczeń
    if (user.current_borrowed >= 5) {
      return res
        .status(403)
        .json({ error: 'User has reached the maximum borrowing limit.' });
    }

    // Pobierz książkę z bazy danych
    const book = await getBookById(book_id);
    if (!book) {
      return res.status(404).json({ error: 'Book not found.' });
    }

    if (book.availability_status !== 'available') {
      return res
        .status(400)
        .json({ error: 'Book is not available for borrowing.' });
    }

    // Wyznacz terminy wypożyczenia
    const borrowedAt = new Date();
    const dueDate = new Date();
    dueDate.setDate(borrowedAt.getDate() + 14); // Termin zwrotu: 14 dni od wypożyczenia

    // Zapisz wypożyczenie w bazie danych
    const borrowedBook: BorrowedBook = {
      id: uuidv4(),
      book_id: book.id,
      book_title: book.title,
      author_first_name: book.author_first_name,
      author_last_name: book.author_last_name,
      user_id: user.id,
      user_first_name: user.name,
      user_last_name: user.surname,
      status: 'borrowed',
      borrowed_at: borrowedAt,
      due_date: dueDate,
    };

    await addBorrowedBook(borrowedBook);

    // Zaktualizuj status książki na "unavailable"
    await updateBookStatus(book.id, 'unavailable');

    // Zwiększ licznik wypożyczeń użytkownika
    await incrementUserBorrowCount(user.id);

    // Wyślij odpowiedź
    res.status(200).json({
      message: 'Book borrowed successfully.',
      data: {
        bookId: borrowedBook.book_id,
        borrowedAt: borrowedBook.borrowed_at,
        dueDate: borrowedBook.due_date,
      },
    });
  } catch (error) {
    console.error('Error borrowing book:', error);
    res.status(500).json({
      error: 'An unexpected error occurred while borrowing the book.',
    });
  }
});

router.post(
  '/return',
  authenticateUser,
  async (req: Request, res: Response) => {
    const { book_id } = req.body;
    console.log(book_id);
    // Pobranie danych zalogowanego użytkownika z req.user
    const userId = req.user?.id;

    if (!book_id) {
      return res.status(400).json({ message: 'Book ID is required.' });
    }

    try {
      // Sprawdzamy, czy użytkownik faktycznie wypożyczył tę konkretną książkę
      const [borrowed]: [RowDataPacket[], FieldPacket[]] = await pool.query(
        `SELECT *
         FROM Borrowed_books
         WHERE book_id = ?
           AND user_id = ?
           AND status = 'borrowed'`,
        [book_id, userId],
      );

      // Jeśli brak rekordu - zwracamy błąd
      if (borrowed.length === 0) {
        return res.status(400).json({
          message: 'This book is not currently borrowed by this user.',
        });
      }

      // Aktualizujemy status książki na "available" (zmiana dostępności w tabeli Books)
      await pool.query(
        `UPDATE Books
         SET availability_status = 'available'
         WHERE id = ?`,
        [book_id],
      );

      // Aktualizujemy rekord w logach wypożyczeń dla tej konkretnej książki
      await pool.query(
        `UPDATE Borrowed_books
         SET returned_at = NOW(),
             status      = 'returned'
         WHERE book_id = ?
           AND user_id = ?
           AND status = 'borrowed'`,
        [book_id, userId],
      );

      // Zwiększamy licznik przeczytanych książek dla użytkownika
      await pool.query(
        'UPDATE Users SET numbers_of_books_checked_out = numbers_of_books_checked_out + 1 WHERE id = ?',
        [userId],
      );

      //zmniejszamy licznik wypozyczonych ksiazek
      await pool.query(
        `UPDATE Users
         SET current_borrowed = current_borrowed - 1
         WHERE id = ?`,
        [userId],
      );

      return res.status(200).json({ message: 'Book returned successfully.' });
    } catch (error) {
      console.error(`Error handling return: ${(error as Error).message}`);
      return res
        .status(500)
        .json({ message: 'Could not process book return.' });
    }
  },
);

router.get(
  '/borrowed',
  authenticateUser,
  async (req: Request, res: Response) => {
    const userId = req.user?.id;

    try {
      const [borrowedBooks] = await pool.query<RowDataPacket[]>(
        `SELECT id                                               AS borrowID,
                book_id                                          AS bookID,
                book_title                                       AS title,
                CONCAT(author_first_name, ' ', author_last_name) AS author,
                borrowed_at,
                due_date
         FROM Borrowed_books
         WHERE user_id = ?
           AND status = 'borrowed'`,
        [userId],
      );

      if (borrowedBooks.length === 0) {
        return res
          .status(200)
          .json({ message: 'You have not borrowed any books yet.' });
      }
      return res.status(200).json(borrowedBooks);
    } catch (error) {
      console.error(`Error handling borrowed: ${(error as Error).message}`);
      return res
        .status(500)
        .json({ message: 'Could not process borrowed books fetching.' });
    }
  },
);

router.get(
  '/history',
  authenticateUser,
  async (req: Request, res: Response) => {
    // Pobieramy ID zalogowanego użytkownika z middleware
    const userId = req.user?.id;

    try {
      // Pobranie pełnej historii wypożyczeń
      const [borrowedBookHistory] = await pool.query<RowDataPacket[]>(
        `SELECT id                                               AS borrowID,
                book_id                                          AS bookID,
                book_title                                       AS title,
                CONCAT(author_first_name, ' ', author_last_name) AS author,
                status,
                borrowed_at,
                due_date,
                returned_at
         FROM Borrowed_books
         WHERE user_id = ?
         ORDER BY borrowed_at DESC`,
        [userId],
      );

      // Zwracamy wyniki w odpowiedzi
      return res.status(200).json(borrowedBookHistory);
    } catch (error) {
      console.error(`Error fetching history: ${(error as Error).message}`);
      return res
        .status(500)
        .json({ message: 'Unable to fetch borrowed books history.' });
    }
  },
);

export default router;
