import type { ErrorCode } from './error-codes.js';

export class HandledError extends Error {
  public readonly code: string;
  public readonly statusCode: number;

  constructor(errorCode: ErrorCode) {
    super(errorCode.message);
    this.code = errorCode.code;
    this.statusCode = errorCode.statusCode;
    this.name = 'HandledError';
  }
}
