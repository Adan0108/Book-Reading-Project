import { StatusCode, ReasonPhrase } from "../utils/httpStatusCode";
import { Response } from "express";

interface SuccessPayload<T = unknown> {
  message?: string;
  reasonStatusCode?: string; // cố ý để string để không bị “literal-narrowing”
  statusCode?: number;
  metadata?: T;
}

export class SuccessResponse<T = unknown> {
  public message: string;
  public status: number;
  public metadata: T;

  constructor({
    message,
    reasonStatusCode = ReasonPhrase.OK,
    statusCode = StatusCode.OK,
    metadata = {} as T,
  }: SuccessPayload<T>) {
    this.message = message ?? reasonStatusCode;
    this.status = statusCode;
    this.metadata = metadata;
  }

  // cho express chain được
  send(res: Response, _header: Record<string, string> = {}) {
    return res.status(this.status).json(this);
  }
}

export class OK<T = unknown> extends SuccessResponse<T> {
  constructor(message?: string, metadata?: T) {
    super({ message, metadata });
  }
}

export class CREATED<T = unknown> extends SuccessResponse<T> {
  options: unknown;
  constructor({
    message,
    reasonStatusCode = ReasonPhrase.CREATED,
    statusCode = StatusCode.CREATED,
    metadata = {} as T,
    options = {},
  }: SuccessPayload<T> & { options?: unknown }) {
    super({ message, reasonStatusCode, statusCode, metadata });
    this.options = options;
  }
}
