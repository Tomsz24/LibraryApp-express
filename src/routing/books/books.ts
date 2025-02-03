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
  rating: number;
  ratingsCount: number;
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
  authors: { firstName: string; lastName: string }[];
  genres: string[];
}

type TypedRequest<TBody> = Request<
  Record<string, never>,
  unknown,
  TBody,
  Record<string, never>
>;

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
             b.ratings_count,
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

  const [rows] = await db.execute<RawBookRow[] & RowDataPacket[]>(query, [
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

router.post(
  '/addBook',
  authenticateAdmin,
  async (req: TypedRequest<AddBookRequestBody>, res: Response) => {
    const {
      title,
      description,
      isbn,
      publicationYear,
      pages,
      rating,
      authors,
      genres,
    } = req.body;

    // 1. Ręczna walidacja danych wejściowych
    if (
      !title ||
      !description ||
      !isbn ||
      !publicationYear ||
      !pages ||
      !rating ||
      !authors ||
      !genres
    ) {
      return res
        .status(400)
        .json({ success: false, message: 'Missing required fields.' });
    }

    if (typeof isbn !== 'string' || isbn.length !== 13) {
      return res.status(400).json({
        success: false,
        message: 'ISBN must be a 13-character string.',
      });
    }

    if (
      !Array.isArray(authors) ||
      authors.length === 0 ||
      !Array.isArray(genres) ||
      genres.length === 0
    ) {
      return res.status(400).json({
        success: false,
        message: 'Authors and genres must be non-empty arrays.',
      });
    }

    const connection = await db.getConnection();
    await connection.beginTransaction();

    try {
      // 2. Sprawdź, czy książka już istnieje
      const [existingBooks] = await connection.query<RowDataPacket[]>(
        'SELECT id FROM Books WHERE isbn = ? OR title = ?',
        [isbn, title],
      );

      if (existingBooks.length > 0) {
        throw new Error('Book with the same ISBN or title already exists.');
      }

      // 3. Dodaj autorów i zapisuj ich ID
      const authorIds: number[] = [];
      for (const author of authors) {
        const { firstName, lastName } = author;

        const [existingAuthors] = await connection.query<RowDataPacket[]>(
          'SELECT id FROM authors WHERE first_name = ? AND last_name = ?',
          [firstName, lastName],
        );

        if (existingAuthors.length > 0) {
          // Autor już istnieje
          authorIds.push(existingAuthors[0].id);
        } else {
          // Dodaj nowego autora
          const [authorResult] = await connection.query<ResultSetHeader>(
            'INSERT INTO authors (first_name, last_name) VALUES (?, ?)',
            [firstName, lastName],
          );
          authorIds.push(authorResult.insertId);
        }
      }

      // 4. Dodaj gatunki i zapisuj ich ID
      const genreIds: number[] = [];
      for (const genre of genres) {
        const [existingGenres] = await connection.query<RowDataPacket[]>(
          'SELECT id FROM genres WHERE name = ?',
          [genre],
        );

        if (existingGenres.length > 0) {
          // Gatunek już istnieje
          genreIds.push(existingGenres[0].id);
        } else {
          // Dodaj nowy gatunek
          const [genreResult] = await connection.query<ResultSetHeader>(
            'INSERT INTO genres (name) VALUES (?)',
            [genre],
          );
          genreIds.push(genreResult.insertId);
        }
      }

      // 5. Dodaj książkę
      const [bookResult] = await connection.query<ResultSetHeader>(
        'INSERT INTO Books (title, description, isbn, publication_year, pages, rating) VALUES (?, ?, ?, ?, ?, ?)',
        [title, description, isbn, publicationYear, pages, rating],
      );
      const bookId = bookResult.insertId;

      // 6. Powiąż książkę z autorami
      for (const authorId of authorIds) {
        await connection.query(
          'INSERT INTO book_authors (book_id, author_id) VALUES (?, ?)',
          [bookId, authorId],
        );
      }

      // 7. Powiąż książkę z gatunkami
      for (const genreId of genreIds) {
        await connection.query(
          'INSERT INTO book_genres (book_id, genre_id) VALUES (?, ?)',
          [bookId, genreId],
        );
      }

      // 8. Zatwierdzenie transakcji
      await connection.commit();
      return res
        .status(201)
        .json({ success: true, message: 'Book added successfully.' });
    } catch (error) {
      // Wycofanie zmian w przypadku błędu
      await connection.rollback();
      return res.status(500).json({
        success: false,
        message:
          error instanceof Error ? error.message : 'Internal server error.',
      });
    } finally {
      connection.release();
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
                 b.publication_year                                       AS publicationYear,
                 b.pages,
                 b.rating,
                 b.availability_status,
                 b.cover_url,
                 GROUP_CONCAT(DISTINCT CONCAT(a.first_name, a.last_name)) AS authors,
                 GROUP_CONCAT(DISTINCT g.name)                            AS genres
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
