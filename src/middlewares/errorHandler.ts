import { Request, Response, NextFunction } from 'express';

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
  /* eslint-disable-next-line @typescript-eslint/no-unused-vars */
  next: NextFunction,
) => {
  const status = err.statusCode || 500;
  const message = err.message || 'Something went wrong';

  console.error(`Error: ${message}, Status Code: ${status}`);
  res.status(status).json({ message });
};
