import { z } from 'zod';

export const LeaderboardQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
  scope: z.enum(['exam', 'class', 'batch']).default('exam'),
});
export type LeaderboardQuery = z.infer<typeof LeaderboardQuerySchema>;
