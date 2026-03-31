import { z } from 'zod';
import type { Profile } from './profile';
import { profileSchema } from './profile';

export type Plan = 'free' | 'pro';

export interface MeResponse {
  profile: Profile;
  plan: Plan;
  github_connected: boolean;
}

export const meResponseSchema = z.object({
  profile: profileSchema,
  plan: z.enum(['free', 'pro']),
  github_connected: z.boolean(),
});

export function parseMeResponse(json: unknown): MeResponse | null {
  const parsed = meResponseSchema.safeParse(json);
  return parsed.success ? parsed.data : null;
}
