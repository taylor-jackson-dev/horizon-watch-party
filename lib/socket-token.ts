import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import type { UserTier } from "@prisma/client";

const ISSUER = "watch-party";
const AUDIENCE = "watch-party-socket";
const DEFAULT_TTL_SECONDS = 60 * 60; // 1 hour
const ALGORITHM = "HS256";

export interface SocketTokenClaims {
  userId: string;
  tier: UserTier;
}

interface SocketJWTPayload extends JWTPayload {
  tier: UserTier;
}

function getSecret(): Uint8Array {
  const secret = process.env.NEXTAUTH_SECRET ?? process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error(
      "NEXTAUTH_SECRET (or AUTH_SECRET) is required to sign/verify socket tokens"
    );
  }
  return new TextEncoder().encode(secret);
}

export async function signSocketToken(
  claims: SocketTokenClaims,
  ttlSeconds = DEFAULT_TTL_SECONDS,
): Promise<string> {
  return await new SignJWT({ tier: claims.tier } satisfies SocketJWTPayload)
    .setProtectedHeader({ alg: ALGORITHM })
    .setSubject(claims.userId)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${ttlSeconds}s`)
    .sign(getSecret());
}

export async function verifySocketToken(token: string): Promise<SocketTokenClaims> {
  const { payload } = await jwtVerify(token, getSecret(), {
    issuer: ISSUER,
    audience: AUDIENCE,
    algorithms: [ALGORITHM],
  });
  if (!payload.sub) throw new Error("Token missing subject");
  const tier = (payload as SocketJWTPayload).tier;
  if (tier !== "FREE" && tier !== "PREMIUM") {
    throw new Error("Token missing or invalid tier");
  }
  return { userId: payload.sub, tier };
}
