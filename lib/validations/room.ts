import { z } from "zod";
import { MEMBER_CONTRIB_MAX } from "@/lib/config";

const ROOM_NAME_MIN = 1;
const ROOM_NAME_MAX = 80;
const ROOM_DESC_MAX = 280;
const PASSWORD_MIN = 4;
const PASSWORD_MAX = 64;

const themeEnum = z.enum(["DARK_CINEMA", "NEON_NIGHT", "RETRO_DRIVE", "MINIMAL"]);

export const createRoomSchema = z
  .object({
    name: z.string().trim().min(ROOM_NAME_MIN).max(ROOM_NAME_MAX),
    description: z.string().trim().max(ROOM_DESC_MAX).optional(),
    theme: themeEnum.optional(),
    isPrivate: z.boolean().optional(),
    password: z.string().min(PASSWORD_MIN).max(PASSWORD_MAX).optional(),
    capacity: z.number().int().positive().max(1000).optional(),
  })
  .refine((d) => !d.isPrivate || (d.password && d.password.length >= PASSWORD_MIN), {
    message: "Private rooms require a password",
    path: ["password"],
  });

export type CreateRoomInput = z.infer<typeof createRoomSchema>;

export const updateRoomSchema = z.object({
  name: z.string().trim().min(ROOM_NAME_MIN).max(ROOM_NAME_MAX).optional(),
  description: z.string().trim().max(ROOM_DESC_MAX).nullable().optional(),
  theme: themeEnum.optional(),
  capacity: z.number().int().positive().max(1000).optional(),
  chatEnabled: z.boolean().optional(),
  voiceEnabled: z.boolean().optional(),
  reactionsEnabled: z.boolean().optional(),
  memberContributionLimit: z.number().int().min(0).max(MEMBER_CONTRIB_MAX).optional(),
  loopQueue: z.boolean().optional(),
  loopSingle: z.boolean().optional(),
  shuffleEnabled: z.boolean().optional(),
});

export type UpdateRoomInput = z.infer<typeof updateRoomSchema>;

export const joinRoomSchema = z.object({
  joinCode: z.string().trim().min(1).max(32),
  password: z.string().max(PASSWORD_MAX).optional(),
});

export type JoinRoomInput = z.infer<typeof joinRoomSchema>;
