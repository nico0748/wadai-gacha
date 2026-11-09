export type ErrorCode =
  | "bad_request"
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "conflict"
  | "payload_too_large"
  | "limit_reached"
  | "rate_limited";

const STATUS: Record<ErrorCode, number> = {
  bad_request: 400,
  unauthorized: 401,
  forbidden: 403,
  not_found: 404,
  conflict: 409,
  payload_too_large: 413,
  limit_reached: 422,
  rate_limited: 429,
};

/** An error whose message is safe to show to the person using the app. */
export class AppError extends Error {
  readonly status: number;
  /** Seconds the client should wait before retrying; sent as Retry-After. */
  readonly retryAfter?: number;
  constructor(
    readonly code: ErrorCode,
    message: string,
    options?: { retryAfter?: number },
  ) {
    super(message);
    this.status = STATUS[code];
    this.retryAfter = options?.retryAfter;
  }
}
