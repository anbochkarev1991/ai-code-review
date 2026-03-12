/**
 * Emulate PRO subscription for a user by email.
 * Run from backend/: npx ts-node -r tsconfig-paths/register scripts/emulate-pro-for-user.ts [email]
 *
 * Requires: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY in backend/.env
 * Default email: a.n.bochkarev1991@gmail.com
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import { createClient } from '@supabase/supabase-js';

config({ path: resolve(process.cwd(), '.env') });

const EMAIL = process.argv[2] ?? 'a.n.bochkarev1991@gmail.com';

async function main() {
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    console.error(
      'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Load backend/.env and retry.',
    );
    process.exit(1);
  }

  const supabase = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const {
    data: { users },
    error: listError,
  } = await supabase.auth.admin.listUsers({ perPage: 1000 });

  if (listError) {
    console.error('Failed to list users:', listError.message);
    process.exit(1);
  }

  const user = users?.find(
    (u) => u.email?.toLowerCase() === EMAIL.toLowerCase(),
  );
  if (!user) {
    console.error(`User not found: ${EMAIL}`);
    process.exit(1);
  }

  const { data: existing } = await supabase
    .from('subscriptions')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle();

  const row = {
    user_id: user.id,
    plan: 'pro',
    status: 'active',
    updated_at: new Date().toISOString(),
  };

  if (existing) {
    const { error } = await supabase
      .from('subscriptions')
      .update(row)
      .eq('user_id', user.id);
    if (error) {
      console.error('Failed to update subscription:', error.message);
      process.exit(1);
    }
    console.log(`Updated subscription to PRO for ${EMAIL}`);
  } else {
    const { error } = await supabase.from('subscriptions').insert(row);
    if (error) {
      console.error('Failed to insert subscription:', error.message);
      process.exit(1);
    }
    console.log(`Created PRO subscription for ${EMAIL}`);
  }
}

void main();
