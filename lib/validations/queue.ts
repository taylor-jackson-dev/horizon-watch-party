import { z } from "zod";

const TITLE_MAX = 200;

export const addQueueItemSchema = z.object({
  url: z.string().trim().min(1).max(500),
  title: z.string().trim().max(TITLE_MAX).optional(),
});

export type AddQueueItemInput = z.infer<typeof addQueueItemSchema>;

export const reorderQueueItemSchema = z.object({
  position: z.number().int().min(0),
});

export type ReorderQueueItemInput = z.infer<typeof reorderQueueItemSchema>;
