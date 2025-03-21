import { Router, Response, Request } from 'express';
import db from '../../../database/db';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { authenticateAdmin } from '../../middlewares/authenticateAdmin';

const router = Router();

interface RawBookRow {
  book_id: number;
  title: string;
  description: string;
  isbn: string;
  publication_year: number;
  pages: number;
  rating: number;
  ratings_count: number;
  cover_url: string | null;
  authors: string | null;
  genres: string | null;
}

interface Book {
  id: number;
  title: string;
  description: string;
  isbn: string;
  publicationYear: number;
  pages: number;
  rating?: number;
  ratingsCount?: number;
  coverUrl?: string;
  authors: string[];
  genres: string[];
}

interface FetchBooksParams {
  limit: number;
  offset: number;
  orderBy?: string;
  orderDirection?: 'ASC' | 'DESC';
}

interface AddBookRequestBody {
  title: string;
  description: string;
  isbn: string;
  publicationYear: number;
  pages: number;
  rating: number;
  ratingCount: number;
  coverUrl: string | null;
  language: string;
  publisher: string;
  authors: {
    firstName: string;
    lastName: string;
    birth_date?: string;
    nationality?: string;
  }[];
  genres: string[];
}

export const fetchBooks = async (params: FetchBooksParams): Promise<Book[]> => {
  const { limit, offset, orderBy = 'title', orderDirection = 'ASC' } = params;

  if (!['title', 'rating', 'publication_year'].includes(orderBy)) {
    throw new Error(`Invalid orderBy parameter: ${orderBy}`);
  }

  const query = `
      SELECT b.id                                                                         AS book_id,
             b.title,
             b.description,
             b.isbn,
             b.publication_year,
             b.pages,
             b.rating,
             b.rating_count,
             b.cover_url,
             GROUP_CONCAT(DISTINCT CONCAT(a.first_name, ' ', a.last_name) SEPARATOR ', ') AS authors,
             GROUP_CONCAT(DISTINCT g.name SEPARATOR ', ')                                 AS genres
      FROM Books b
               LEFT JOIN
           book_authors ba ON b.id = ba.book_id
               LEFT JOIN
           Authors a ON ba.author_id = a.id
               LEFT JOIN
           book_genres bg ON b.id = bg.book_id
               LEFT JOIN
           Genres g ON bg.genre_id = g.id
      GROUP BY b.id
      ORDER BY ${orderBy} ${orderDirection}
      LIMIT ? OFFSET ?;
  `;

  const [rows] = await db.query<RawBookRow[] & RowDataPacket[]>(query, [
    limit,
    offset,
  ]);

  return rows.map((row) => ({
    id: row.book_id,
    title: row.title,
    description: row.description,
    isbn: row.isbn,
    publicationYear: row.publication_year,
    pages: row.pages,
    rating: row.rating,
    ratingsCount: row.ratings_count,
    coverUrl: row.cover_url || undefined,
    authors: row.authors ? row.authors.split(', ') : [],
    genres: row.genres ? row.genres.split(', ') : [],
  }));
};

router.get('/', async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string, 10) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const offset = (page - 1) * limit;

    const books = await fetchBooks({ limit, offset });

    if (books.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'No books found',
      });
    }

    res.status(200).json({
      success: true,
      page,
      limit,
      data: books,
    });
  } catch (err) {
    console.error('Error fetching books: ', err);
    res.status(500).json({ error: 'Error fetching books' });
  }
});

interface AddBookResponseBody {
  success: boolean;
  message: string;
}

router.post(
  '/addBook',
  authenticateAdmin,
  async (
    req: Request<
      Record<string, never>,
      AddBookResponseBody,
      AddBookRequestBody
    >,
    res: Response<AddBookResponseBody>,
  ) => {
    const {
      title,
      description,
      isbn,
      publicationYear,
      pages,
      rating = 0,
      ratingCount = 0,
      coverUrl = '',
      language,
      publisher,
      authors,
      genres,
    } = req.body;

    // Walidacja danych wejściowych
    if (!title || typeof title !== 'string' || title.trim() === '') {
      return res.status(400).json({
        success: false,
        message: "Invalid or missing 'title'. It must be a non-empty string.",
      });
    }

    if (
      !description ||
      typeof description !== 'string' ||
      description.trim() === ''
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid or missing 'description'. It must be a non-empty string.",
      });
    }

    if (!isbn || typeof isbn !== 'string' || isbn.length > 20) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid or missing 'isbn'. It must be a string with a maximum length of 20 characters.",
      });
    }

    if (
      !publicationYear ||
      typeof publicationYear !== 'number' ||
      publicationYear < 0
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid or missing 'publicationYear'. It must be a positive number.",
      });
    }

    if (!pages || typeof pages !== 'number' || pages <= 0) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid or missing 'pages'. It must be a positive number greater than zero.",
      });
    }

    if (!Array.isArray(authors) || authors.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid or missing 'authors'. It must be a non-empty array.",
      });
    }

    if (!Array.isArray(genres) || genres.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid or missing 'genres'. It must be a non-empty array.",
      });
    }

    const connection = await db.getConnection(); // Połączenie z bazą danych

    try {
      await connection.beginTransaction(); // Rozpoczęcie transakcji

      // Dodanie języka lub znalezienie istniejącego
      let languageId!: number;
      const [existingLanguage] = await connection.query<RowDataPacket[]>(
        'SELECT id FROM Languages WHERE name = ?',
        [language],
      );
      if (existingLanguage.length > 0) {
        languageId = existingLanguage[0].id;
      } else {
        const [languageResult] = await connection.query<ResultSetHeader>(
          'INSERT INTO Languages (name) VALUES (?)',
          [language],
        );
        languageId = languageResult.insertId;
      }

      // Dodanie wydawcy lub znalezienie istniejącego
      let publisherId!: number;
      const [existingPublisher] = await connection.query<RowDataPacket[]>(
        'SELECT id FROM Publishers WHERE name = ?',
        [publisher],
      );
      if (existingPublisher.length > 0) {
        publisherId = existingPublisher[0].id;
      } else {
        const [publisherResult] = await connection.query<ResultSetHeader>(
          'INSERT INTO Publishers (name) VALUES (?)',
          [publisher],
        );
        publisherId = publisherResult.insertId;
      }

      // Dodanie książki
      const [bookResult] = await connection.query<ResultSetHeader>(
        `INSERT INTO Books
         (title, description, isbn, publication_year, pages, language_id, publisher_id, rating, rating_count, cover_url,
          availability_status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'available', NOW(), NOW())`,
        [
          title,
          description,
          isbn,
          publicationYear,
          pages,
          languageId,
          publisherId,
          rating,
          ratingCount,
          coverUrl,
        ],
      );
      const bookId = bookResult.insertId;

      // Dodanie autorów
      const authorIds: number[] = [];
      for (const { firstName, lastName, birth_date, nationality } of authors) {
        const [existingAuthor] = await connection.query<RowDataPacket[]>(
          `SELECT id
           FROM Authors
           WHERE first_name = ?
             AND last_name = ?
             AND (birth_date = ? OR (birth_date IS NULL AND ? IS NULL))
             AND (nationality = ? OR (nationality IS NULL AND ? IS NULL))`,
          [
            firstName,
            lastName,
            birth_date,
            birth_date,
            nationality,
            nationality,
          ],
        );

        if (existingAuthor.length > 0) {
          authorIds.push(existingAuthor[0].id);
        } else {
          const [authorResult] = await connection.query<ResultSetHeader>(
            `INSERT INTO Authors (first_name, last_name, birth_date, nationality, created_at, updated_at)
             VALUES (?, ?, ?, ?, NOW(), NOW())`,
            [firstName, lastName, birth_date, nationality],
          );
          authorIds.push(authorResult.insertId);
        }
      }

      // Przypisanie autorów do książki
      for (const authorId of authorIds) {
        await connection.query(
          'INSERT INTO book_authors (book_id, author_id) VALUES (?, ?)',
          [bookId, authorId],
        );
      }

      // Dodanie gatunków i przypisanie do książki
      for (const genre of genres) {
        let genreId!: number;
        const [existingGenre] = await connection.query<RowDataPacket[]>(
          'SELECT id FROM Genres WHERE name = ?',
          [genre],
        );
        if (existingGenre.length > 0) {
          genreId = existingGenre[0].id;
        } else {
          const [genreResult] = await connection.query<ResultSetHeader>(
            `INSERT INTO Genres (name, created_at, updated_at)
             VALUES (?, NOW(), NOW())`,
            [genre],
          );
          genreId = genreResult.insertId;
        }
        await connection.query(
          `INSERT INTO book_genres (book_id, genre_id)
           VALUES (?, ?)`,
          [bookId, genreId],
        );
      }

      // Zatwierdzenie transakcji
      await connection.commit();

      res
        .status(201)
        .json({ success: true, message: 'Book added successfully.' });
    } catch (error) {
      await connection.rollback(); // Cofnięcie transakcji w razie błędu
      res.status(500).json({
        success: false,
        message:
          error instanceof Error ? error.message : 'Internal server error.',
      });
    } finally {
      connection.release(); // Zakończenie połączenia
    }
  },
);

router.get('/:id', async (req: Request<{ id: string }>, res: Response) => {
  const { id } = req.params;

  if (!id || isNaN(Number(id))) {
    return res.status(400).json({ error: 'Invalid book id' });
  }

  try {
    const [bookRow] = await db.query<RawBookRow & RowDataPacket[]>(
      `
          SELECT b.id,
                 b.title,
                 b.description,
                 b.isbn,
                 b.publication_year                                            AS publicationYear,
                 b.pages,
                 b.rating,
                 b.availability_status,
                 b.cover_url,
                 GROUP_CONCAT(DISTINCT CONCAT(a.first_name, ' ', a.last_name)) AS authors,
                 GROUP_CONCAT(DISTINCT g.name)                                 AS genres
          FROM Books b
                   LEFT JOIN book_authors ba ON b.id = ba.book_id
                   LEFT JOIN authors a ON ba.author_id = a.id
                   LEFT JOIN book_genres bg ON b.id = bg.book_id
                   LEFT JOIN genres g ON bg.genre_id = g.id
          WHERE b.id = ?
          GROUP BY b.id
      `,
      [id],
    );

    if (bookRow.length === 0) {
      return res.status(404).json({ error: 'Book not found' });
    }

    const book = {
      id: bookRow[0].id,
      title: bookRow[0].title,
      description: bookRow[0].description,
      isbn: bookRow[0].isbn,
      publicationYear: bookRow[0].publicationYear,
      pages: bookRow[0].pages,
      rating: bookRow[0].rating,
      availabilityStatus: bookRow[0].availability_status,
      coverUrl: bookRow[0].cover_url || null,
      genres: bookRow[0].genres ? bookRow[0].genres.split(', ') : [],
      authors: bookRow[0].authors ? bookRow[0].authors.split(', ') : [],
    };

    return res.status(200).json({ success: true, data: book });
  } catch (err) {
    console.error('Error fetching book: ', err);
    res.status(500).json({ error: 'Error fetching book' });
  }
});

router.delete(
  '/:id',
  authenticateAdmin,
  async (req: Request<{ id: string }>, res: Response) => {
    const { id } = req.params;

    if (!id || isNaN(Number(id))) {
      return res.status(400).json({
        success: false,
        message: 'Invalid book ID provided.',
      });
    }

    try {
      const [bookRow] = await db.query<RawBookRow & RowDataPacket[]>(
        `
            SELECT id, availability_status
            FROM Books
            WHERE id = ?
        `,
        [id],
      );

      if (bookRow.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Book not found.',
        });
      }

      const bookStatus = bookRow[0].availability_status;

      if (bookStatus !== 'available') {
        return res.status(400).json({
          success: false,
          message: 'Cannot delete book that is not available.',
        });
      }

      //DELETING RELATIONS IN book_authors
      await db.query(
        `
            DELETE
            FROM book_authors
            WHERE book_id = ?
        `,
        [id],
      );

      //DELETING RELATIONS FROM book_genres
      await db.query(
        `
            DELETE
            FROM book_genres
            WHERE book_id = ?
        `,
        [id],
      );

      //DELETE BOOK FROM books
      await db.query(
        `
            DELETE
            FROM books
            WHERE id = ?
        `,
        [id],
      );

      return res.status(200).json({
        success: true,
        message: 'Book deleted successfully.',
      });
    } catch (err) {
      console.error('Error deleting book: ', err);
      res.status(500).json({
        success: false,
        message: 'Error deleting book.',
      });
    }
  },
);

export default router;
