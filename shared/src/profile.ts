import { z } from 'zod';

export interface Profile {
  id: string;
  email: string;
  display_name?: string;
  avatar_url?: string;
}

export const profileSchema = z.object({
  id: z.string(),
  email: z.string(),
  display_name: z.string().optional(),
  avatar_url: z.string().optional(),
});
