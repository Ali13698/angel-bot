import { z } from 'zod';

export const RequestEnvelope = z.object({
  type: z.string(),
  cbId: z.string(),
  idempotencyKey: z.string().optional(),
  payload: z.record(z.unknown()),
  ts: z.number().int(),
});

export const ResponseEnvelope = z.object({
  type: z.literal('response'),
  cbId: z.string(),
  ok: z.boolean(),
  data: z.unknown().optional(),
  error: z
    .object({
      code: z.string(),
      message: z.string(),
      traceId: z.string().optional(),
      retryAfterMs: z.number().int().optional(),
    })
    .optional(),
  ts: z.number().int(),
});

export const EventEnvelope = z.object({
  type: z.string(),
  eventId: z.string(),
  streamId: z.string(),
  seq: z.number().int().nonnegative(),
  payload: z.record(z.unknown()),
  ts: z.number().int(),
  traceId: z.string(),
});

export type RequestEnvelope = z.infer<typeof RequestEnvelope>;
export type ResponseEnvelope = z.infer<typeof ResponseEnvelope>;
export type EventEnvelope = z.infer<typeof EventEnvelope>;
