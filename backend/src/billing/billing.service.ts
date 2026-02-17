import { BadRequestException, Injectable } from '@nestjs/common';
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';
import type { Plan, UsageResponse } from '../types';

const USAGE_LIMITS: Record<Plan, number> = {
  free: 10,
  pro: 200,
};

@Injectable()
export class BillingService {
  private stripe: Stripe | null = null;

  private getStripe(): Stripe {
    if (!this.stripe) {
      const secretKey = process.env.STRIPE_SECRET_KEY ?? '';
      this.stripe = new Stripe(secretKey);
    }
    return this.stripe;
  }

  verifyWebhook(
    rawBody: Buffer,
    signature: string,
    webhookSecret: string,
  ): Stripe.Event {
    const stripe = this.getStripe();
    try {
      return stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
    } catch (err) {
      throw new BadRequestException(
        err instanceof Error
          ? err.message
          : 'Webhook signature verification failed',
      );
    }
  }

  async getUsage(userId: string, accessToken: string): Promise<UsageResponse> {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('Supabase not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
    });

    const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM

    const [subscriptionResult, usageResult] = await Promise.all([
      supabase
        .from('subscriptions')
        .select('plan')
        .eq('user_id', userId)
        .maybeSingle(),
      supabase
        .from('usage')
        .select('review_count')
        .eq('user_id', userId)
        .eq('month', currentMonth)
        .maybeSingle(),
    ]);

    const plan: Plan =
      (subscriptionResult.data?.plan as Plan) ?? 'free';
    const reviewCount = usageResult.data?.review_count ?? 0;
    const limit = USAGE_LIMITS[plan];

    return { review_count: reviewCount, limit, plan };
  }
}
