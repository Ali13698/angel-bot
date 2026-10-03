export type RetryHint = boolean | number | string;

export interface ErrorSpec {
  http: number;
  retry: RetryHint;
}

export const ErrorCodes = {
  AUTH_001: { http: 401, retry: false },
  AUTH_002: { http: 401, retry: 'refresh' },
  AUTH_003: { http: 401, retry: 'login' },
  AUTH_004: { http: 403, retry: false },
  AUTH_005: { http: 403, retry: 'update' },
  AUTH_006: { http: 401, retry: 'login+revoke-all' },
  RATE_001: { http: 429, retry: 1000 },
  RATE_002: { http: 429, retry: 10000 },
  PERM_001: { http: 403, retry: false },
  PERM_002: { http: 403, retry: false },
  DATA_001: { http: 404, retry: false },
  DATA_002: { http: 409, retry: false },
  DB_001: { http: 500, retry: 3 },
  SYS_001: { http: 500, retry: 1 },
  SYS_002: { http: 400, retry: false },
  SYS_003: { http: 400, retry: false },
  GAME_001: { http: 400, retry: false },
  GAME_002: { http: 409, retry: false },
  GAME_003: { http: 410, retry: false },
  ECON_001: { http: 402, retry: false },
  ECON_002: { http: 409, retry: false },
} as const satisfies Record<string, ErrorSpec>;

export type ErrorCode = keyof typeof ErrorCodes;
