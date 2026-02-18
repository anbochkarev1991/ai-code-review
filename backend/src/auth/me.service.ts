import { Injectable } from '@nestjs/common';
import { createClient } from '@supabase/supabase-js';
import type { User } from '@supabase/supabase-js';
import type { MeResponse, Profile, Plan } from '../types';

@Injectable()
export class MeService {
  async getMe(user: User, accessToken: string): Promise<MeResponse> {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('Supabase not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
    });

    const [profileResult, subscriptionResult, githubResult] = await Promise.all(
      [
        supabase
          .from('profiles')
          .select('id, email, display_name, avatar_url')
          .eq('id', user.id)
          .maybeSingle(),
        supabase
          .from('subscriptions')
          .select('plan')
          .eq('user_id', user.id)
          .maybeSingle(),
        supabase
          .from('github_connections')
          .select('id')
          .eq('user_id', user.id)
          .maybeSingle(),
      ],
    );

    const profileRow = profileResult.data;
    const profile: Profile = profileRow
      ? {
          id: profileRow.id,
          email: profileRow.email,
          display_name: profileRow.display_name ?? undefined,
          avatar_url: profileRow.avatar_url ?? undefined,
        }
      : {
          id: user.id,
          email: user.email ?? '',
          display_name:
            user.user_metadata?.full_name ??
            user.user_metadata?.name ??
            undefined,
          avatar_url: user.user_metadata?.avatar_url ?? undefined,
        };

    const plan: Plan = (subscriptionResult.data?.plan as Plan) ?? 'free';
    const github_connected = !!githubResult.data;

    return { profile, plan, github_connected };
  }
}
