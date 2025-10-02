import { StatusCode, ReasonPhrase } from "../utils/httpStatusCode";

export class ErrorResponse extends Error {
  public status: number;
  public now: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
    this.now = Date.now();
  }
}

export class ConflictRequestError extends ErrorResponse {
  constructor(
    message: string = ReasonPhrase.CONFLICT,
    statusCode: number = StatusCode.CONFLICT
  ) {
    super(message, statusCode);
  }
}

export class BadRequestError extends ErrorResponse {
  constructor(
    message: string = ReasonPhrase.BAD_REQUEST,
    statusCode: number = StatusCode.BAD_REQUEST
  ) {
    super(message, statusCode);
  }
}

export class AuthFailureError extends ErrorResponse {
  constructor(
    message: string = ReasonPhrase.UNAUTHORIZED,
    statusCode: number = StatusCode.UNAUTHORIZED
  ) {
    super(message, statusCode);
  }
}

export class NotFoundError extends ErrorResponse {
  constructor(
    message: string = ReasonPhrase.NOT_FOUND,
    statusCode: number = StatusCode.NOT_FOUND
  ) {
    super(message, statusCode);
  }
}

export class ForbiddenError extends ErrorResponse {
  constructor(
    message: string = ReasonPhrase.FORBIDDEN,
    statusCode: number = StatusCode.FORBIDDEN
  ) {
    super(message, statusCode);
  }
}

export class RedisErrorResponse extends ErrorResponse {
  constructor(
    message: string = ReasonPhrase.INTERNAL_SERVER_ERROR,
    statusCode: number = StatusCode.INTERNAL_SERVER_ERROR
  ) {
    super(message, statusCode);
  }
}
