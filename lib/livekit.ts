import "server-only";
import { AccessToken } from "livekit-server-sdk";
import { LIVEKIT_TOKEN_TTL_SECONDS } from "@/lib/config";

/**
 * Server-side LiveKit access token signing. Never importable from client
 * code (the "server-only" import enforces this at build time).
 *
 * One LiveKit room per Watch Party room, namespaced as "wp_<roomId>" so we
 * don't collide with other rooms in the same LiveKit project (handy if we
 * ever share a project across environments).
 */

const LIVEKIT_ROOM_PREFIX = "wp_";

export function liveKitRoomName(roomId: string): string {
  return `${LIVEKIT_ROOM_PREFIX}${roomId}`;
}

interface CreateVoiceTokenParams {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  roomId: string;
  /** When false, the participant can subscribe but cannot publish their mic. */
  canPublish: boolean;
}

export interface VoiceTokenResult {
  token: string;
  url: string;
  identity: string;
  roomName: string;
}

export async function createVoiceToken(
  params: CreateVoiceTokenParams,
): Promise<VoiceTokenResult> {
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  const url = process.env.LIVEKIT_URL;
  if (!apiKey || !apiSecret || !url) {
    throw new Error("LiveKit credentials are not configured");
  }

  const roomName = liveKitRoomName(params.roomId);

  const at = new AccessToken(apiKey, apiSecret, {
    identity: params.userId,
    name: params.displayName,
    metadata: JSON.stringify({ avatarUrl: params.avatarUrl }),
    ttl: LIVEKIT_TOKEN_TTL_SECONDS,
  });

  at.addGrant({
    roomJoin: true,
    room: roomName,
    canPublish: params.canPublish,
    canSubscribe: true,
    // We don't use LiveKit data channels — chat + sync already flow over
    // our Socket.io pipe. Keeping this off limits the attack surface.
    canPublishData: false,
  });

  const token = await at.toJwt();

  return { token, url, identity: params.userId, roomName };
}
