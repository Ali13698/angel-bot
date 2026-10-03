import { ErrorCodes, type ErrorCode, type RetryHint } from './errors.js';

export interface ErrorBody {
  code: ErrorCode;
  message: string;
  retry: RetryHint;
}

export interface OkEnvelope<T> {
  ok: true;
  data: T;
  ts: number;
}

export interface ErrEnvelope {
  ok: false;
  error: ErrorBody;
  ts: number;
}

export type Envelope<T> = OkEnvelope<T> | ErrEnvelope;

export function ok<T>(data: T): OkEnvelope<T> {
  return { ok: true, data, ts: Date.now() };
}

export function fail(code: ErrorCode, message: string, retry?: RetryHint): ErrEnvelope {
  return {
    ok: false,
    error: { code, message, retry: retry ?? ErrorCodes[code].retry },
    ts: Date.now(),
  };
}

export function httpStatusOf(code: ErrorCode): number {
  return ErrorCodes[code].http;
}
