export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }

  static badRequest(msg = 'Bad request', details?: unknown) { return new AppError(400, msg, details); }
  static unauthorized(msg = 'Please sign in to continue') { return new AppError(401, msg); }
  static forbidden(msg = 'You do not have access to this resource') { return new AppError(403, msg); }
  static notFound(msg = 'Not found') { return new AppError(404, msg); }
  static conflict(msg = 'Already exists') { return new AppError(409, msg); }
}
