import type { Profile } from './profile';

export type Plan = 'free' | 'pro';

export interface MeResponse {
  profile: Profile;
  plan: Plan;
  github_connected: boolean;
}
