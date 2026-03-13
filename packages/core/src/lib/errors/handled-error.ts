import type { ErrorCode } from './error-codes.js';

export class HandledError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly detail: string | null;
  public readonly details: Array<{ code: string; message: string }> | null;

  constructor(errorCode: ErrorCode, detail?: string, details?: Array<{ code: string; message: string }>) {
    super(detail ? `${errorCode.message}: ${detail}` : errorCode.message);
    this.code = errorCode.code;
    this.statusCode = errorCode.statusCode;
    this.detail = detail ?? null;
    this.details = details ?? null;
    this.name = 'HandledError';
  }
}
