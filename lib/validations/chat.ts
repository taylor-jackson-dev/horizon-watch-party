import { z } from "zod";
import { MESSAGE_HISTORY_LIMIT, MESSAGE_MAX_LENGTH } from "@/lib/config";

/** Max history items a single request may pull. Higher than the default
 * but capped to keep payloads bounded. */
export const MESSAGE_HISTORY_MAX = 100;

/**
 * Socket `chat:send` payload. Mirrored on the server — the server is the
 * source of truth and re-validates everything it receives.
 */
export const chatSendSchema = z.object({
  roomId: z.string().min(1),
  content: z.string().trim().min(1).max(MESSAGE_MAX_LENGTH),
});

export type ChatSendInput = z.infer<typeof chatSendSchema>;

/**
 * REST `GET /api/rooms/[id]/messages` query. `before` is a cursor (ISO
 * datetime) — when present, we return messages strictly older than it.
 */
export const messageHistoryQuerySchema = z.object({
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(MESSAGE_HISTORY_MAX)
    .default(MESSAGE_HISTORY_LIMIT),
  before: z.coerce.date().optional(),
});

export type MessageHistoryQuery = z.infer<typeof messageHistoryQuerySchema>;
