import { Router, Response, Request } from 'express';
import db from '../../../database/db';
import { RowDataPacket } from 'mysql2';

const router = Router();

// Typ dla danych zwracanych przez zapytanie SQL
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
  authors: string | null; // Sklejone imiona w SQL
  genres: string | null; // Sklejone gatunki w SQL
}

// Typ wynikowy zwracany na frontend
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

// Parametry zapytań do funkcji fetchBooks
interface FetchBooksParams {
  limit: number;
  offset: number;
  orderBy?: string; // Może sortować np. "title", "rating"
  orderDirection?: 'ASC' | 'DESC'; // Przechowuje "ASC" lub "DESC"
}

export const fetchBooks = async (params: FetchBooksParams): Promise<Book[]> => {
  const { limit, offset, orderBy = 'title', orderDirection = 'ASC' } = params;

  // Walidacja sortowania (uniknięcie SQL Injection)
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

  // Wykonanie zapytania do bazy danych
  const [rows] = await db.execute<RawBookRow[] & RowDataPacket[]>(query, [
    limit,
    offset,
  ]);

  // Mapowanie wyników SQL na bardziej przyjazny format dla API
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
    const limit = 10;
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

export default router;
