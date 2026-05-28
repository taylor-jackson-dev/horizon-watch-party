import { z } from "zod";

/**
 * Allowed emoji set for animated overlay reactions. Kept intentionally small so
 * the picker UI stays compact and the surface for abuse (custom emoji storms,
 * skin-tone bombing) is bounded. Server-validated on every send.
 */
export const ALLOWED_REACTION_EMOJIS = [
  "👍",
  "❤️",
  "😂",
  "😮",
  "😢",
  "🔥",
  "👏",
  "🎉",
] as const;

export type ReactionEmoji = (typeof ALLOWED_REACTION_EMOJIS)[number];

const ALLOWED_SET: ReadonlySet<string> = new Set(ALLOWED_REACTION_EMOJIS);

export function isAllowedReactionEmoji(value: string): value is ReactionEmoji {
  return ALLOWED_SET.has(value);
}

/**
 * Socket `reaction:send` payload. Mirrored on the server — the server is the
 * source of truth and re-validates everything it receives.
 */
export const reactionSendSchema = z.object({
  roomId: z.string().min(1),
  emoji: z.string().refine(isAllowedReactionEmoji, {
    message: "Emoji not allowed",
  }),
});

export type ReactionSendInput = z.infer<typeof reactionSendSchema>;
