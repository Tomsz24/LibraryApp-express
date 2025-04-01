import { Request, Response, NextFunction } from 'express';
//
// export class AppError extends Error {
//   public statusCode: number;
//
//   constructor(message: string, statusCode: number) {
//     super(message);
//     this.statusCode = statusCode;
//     Error.captureStackTrace(this, this.constructor);
//   }
// }
//
// export const ErrorHandler = (
//   err: AppError,
//   req: Request,
//   res: Response,
//   /* eslint-disable-next-line @typescript-eslint/no-unused-vars */
//   next: NextFunction,
// ) => {
//   const status = err.statusCode || 500;
//   const message = err.message || 'Something went wrong';
//
//   console.error(`Error: ${message}, Status Code: ${status}`);
//   res.status(status).json({ message });
// };

export class AppError extends Error {
  public statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
    Error.captureStackTrace(this, this.constructor);
  }
}

export const ErrorHandler = (
  err: AppError,
  req: Request,
  res: Response,
  next: NextFunction, // eslint-disable-line @typescript-eslint/no-unused-vars
) => {
  // Sprawdź, czy odpowiedź została już wysłana
  if (res.headersSent) {
    console.error('Headers already sent. Skipping response in ErrorHandler.');
    return next(err); // Przekaz błąd do dalszej obsługi
  }

  const status = err.statusCode || 500;
  const message = err.message || 'Something went wrong';

  console.error(`Error: ${message}, Status Code: ${status}`);

  // Wyślij odpowiedź tylko raz (jeśli odpowiedź jeszcze nie została wysłana)
  res.status(status).json({
    success: false,
    error: {
      message,
      status,
    },
  });
};
