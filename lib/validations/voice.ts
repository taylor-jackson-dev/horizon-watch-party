import { z } from "zod";

/**
 * Body for `POST /api/livekit/token`. Membership, room flags, and per-member
 * permissions are all enforced server-side after this passes.
 */
export const voiceTokenRequestSchema = z.object({
  roomId: z.string().min(1),
});

export type VoiceTokenRequest = z.infer<typeof voiceTokenRequestSchema>;
