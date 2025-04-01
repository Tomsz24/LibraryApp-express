import { Request, Response, NextFunction } from 'express';

export const redirectToHttps = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  if (!req.secure) {
    // Przekierowanie do HTTPS dla żądań HTTP
    res.redirect(`https://${req.headers.host}${req.url}`);
    return; // Dodano return, aby zatrzymać dalsze wywołanie middlewares
  }

  // Jeśli żądanie jest już HTTPS, przejdź dalej
  next();
};
