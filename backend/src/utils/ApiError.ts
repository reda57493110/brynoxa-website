export class ApiError extends Error {
  statusCode: number;
  errors?: unknown;
  isOperational: boolean;
  /** Machine-readable reason (e.g. MFA_REQUIRED) the app can act on. */
  code?: string;

  constructor(statusCode: number, message: string, errors?: unknown, code?: string) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
    this.errors = errors;
    this.isOperational = true;
    Object.setPrototypeOf(this, ApiError.prototype);
  }
}
