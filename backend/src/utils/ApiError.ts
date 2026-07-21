export class ApiError extends Error {
  statusCode: number;
  errors?: unknown;
  isOperational: boolean;

  constructor(statusCode: number, message: string, errors?: unknown) {
    super(message);
    this.statusCode = statusCode;
    this.errors = errors;
    this.isOperational = true;
    Object.setPrototypeOf(this, ApiError.prototype);
  }
}
