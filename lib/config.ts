// lib/config.ts
// Central configuration constants for Watch Party.
// All cap values, defaults, and feature flags live here.
// Changing these requires no database migration — just a redeploy.

// ─────────────────────────────────────────────
// ROOM
// ─────────────────────────────────────────────

/** Max concurrent viewers for free tier rooms */
export const FREE_ROOM_CAPACITY = 10;

/** Max concurrent viewers for premium tier rooms */
export const PREMIUM_ROOM_CAPACITY = 100;

/** Length of the nanoid-generated room join code (e.g. "xK9mP2qR") */
export const JOIN_CODE_LENGTH = 8;

// ─────────────────────────────────────────────
// VIDEO QUEUE
// ─────────────────────────────────────────────

/** Rolling cap on how many videos can be in the queue at one time */
export const QUEUE_MAX_SIZE = 33;

/**
 * Default number of videos each room member can contribute to the queue.
 * Host can override this per room (0 = host-only curation, up to MEMBER_CONTRIB_MAX).
 */
export const MEMBER_CONTRIB_DEFAULT = 2;

/** Maximum value a host can set for per-member contribution limit */
export const MEMBER_CONTRIB_MAX = 5;

// ─────────────────────────────────────────────
// MESSAGES
// ─────────────────────────────────────────────

/** Hours after which chat messages are automatically purged (same for all tiers) */
export const MESSAGE_RETENTION_HOURS = 48;

/** Max number of messages loaded when a user joins a room mid-session */
export const MESSAGE_HISTORY_LIMIT = 50;

/** Max character length for a single chat message */
export const MESSAGE_MAX_LENGTH = 500;

// ─────────────────────────────────────────────
// RATE LIMITING
// ─────────────────────────────────────────────

/** Max chat messages a user can send per minute (enforced via Redis) */
export const CHAT_RATE_LIMIT_PER_MINUTE = 20;

/** Max emoji reactions a user can send per minute */
export const REACTION_RATE_LIMIT_PER_MINUTE = 30;

// ─────────────────────────────────────────────
// FEATURE FLAGS
// ─────────────────────────────────────────────

/**
 * Feature flags — set to true to activate, false to hide from UI.
 * These gate features that are architecturally ready but not yet launched.
 */
export const FEATURES = {
  /** User-uploaded video files (schema ready, UI hidden until enabled) */
  VIDEO_UPLOADS: false,

  /** Public room browser / discovery page (post-MVP) */
  ROOM_BROWSER: false,

  /** Named guest access without an account (post-MVP growth feature) */
  GUEST_ACCESS: false,

  /** CO_HOST role and per-member premium permissions (post-MVP) */
  CO_HOST: false,
} as const;

// ─────────────────────────────────────────────
// LIVEKIT
// ─────────────────────────────────────────────

/** LiveKit token TTL in seconds (1 hour) */
export const LIVEKIT_TOKEN_TTL_SECONDS = 3600;

// ─────────────────────────────────────────────
// ADS
// ─────────────────────────────────────────────

/** Pre-session ad duration in seconds before the room starts */
export const AD_PRE_SESSION_DURATION_SECONDS = 15;
