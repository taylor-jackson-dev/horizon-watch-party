import { z } from "zod";

export const DISPLAY_NAME_MIN = 1;
export const DISPLAY_NAME_MAX = 40;

export const updateProfileSchema = z.object({
  displayName: z.string().trim().min(DISPLAY_NAME_MIN).max(DISPLAY_NAME_MAX),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
