import { BadRequestException, Injectable } from '@nestjs/common';
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';
import type { User } from '@supabase/supabase-js';
import type { CheckoutBody, CheckoutResponse } from 'shared';
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
      const secretKey = process.env.STRIPE_SECRET_KEY;
      if (!secretKey) {
        throw new BadRequestException('Stripe is not configured');
      }
      this.stripe = new Stripe(secretKey);
    }
    return this.stripe;
  }

  async createCheckoutSession(
    user: User,
    body: CheckoutBody,
    accessToken: string,
  ): Promise<CheckoutResponse> {
    if (!body.success_url || !body.cancel_url) {
      throw new BadRequestException('success_url and cancel_url are required');
    }

    const priceId = process.env.STRIPE_PRO_PRICE_ID;
    if (!priceId) {
      throw new BadRequestException('Stripe Pro price is not configured');
    }

    const stripe = this.getStripe();
    const customerId = await this.getOrCreateStripeCustomerId(
      user,
      accessToken,
    );

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: body.success_url,
      cancel_url: body.cancel_url,
      metadata: { user_id: user.id },
    });

    if (!session.url) {
      throw new BadRequestException('Failed to create checkout session');
    }

    return { url: session.url };
  }

  private async getOrCreateStripeCustomerId(
    user: User,
    accessToken: string,
  ): Promise<string> {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseAnonKey) {
      throw new BadRequestException('Supabase not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
    });

    const { data: sub } = await supabase
      .from('subscriptions')
      .select('stripe_customer_id')
      .eq('user_id', user.id)
      .not('stripe_customer_id', 'is', null)
      .maybeSingle();

    if (sub?.stripe_customer_id) {
      return sub.stripe_customer_id;
    }

    const stripe = this.getStripe();
    const customer = await stripe.customers.create({
      email: user.email ?? undefined,
      name:
        (user.user_metadata?.full_name as string) ??
        (user.user_metadata?.name as string) ??
        undefined,
      metadata: { user_id: user.id },
    });

    return customer.id;
  }

  private getSupabaseAdmin() {
    const url = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !serviceKey) {
      throw new Error('Supabase URL and service role key required for webhook');
    }
    return createClient(url, serviceKey);
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

    const plan: Plan = (subscriptionResult.data?.plan as Plan) ?? 'free';
    const reviewCount = usageResult.data?.review_count ?? 0;
    const limit = USAGE_LIMITS[plan];

    return { review_count: reviewCount, limit, plan };
  }

  /**
   * Upserts usage for (user_id, current_month) and increments review_count.
   * Used after successful review completion.
   */
  async incrementUsage(userId: string, accessToken: string): Promise<void> {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('Supabase not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
    });

    const currentMonth = new Date().toISOString().slice(0, 7);

    const existing = await supabase
      .from('usage')
      .select('review_count')
      .eq('user_id', userId)
      .eq('month', currentMonth)
      .maybeSingle();

    const newCount = (existing.data?.review_count ?? 0) + 1;
    const now = new Date().toISOString();

    await supabase.from('usage').upsert(
      {
        user_id: userId,
        month: currentMonth,
        review_count: newCount,
        updated_at: now,
      },
      { onConflict: 'user_id,month' },
    );
  }

  async handleWebhookEvent(event: Stripe.Event): Promise<void> {
    if (!event.data?.object) return;

    switch (event.type) {
      case 'checkout.session.completed':
        await this.handleCheckoutSessionCompleted(event.data.object);
        break;
      case 'customer.subscription.updated':
        await this.handleCustomerSubscriptionUpdated(event.data.object);
        break;
      case 'customer.subscription.deleted':
        await this.handleCustomerSubscriptionDeleted(event.data.object);
        break;
      default:
        break;
    }
  }

  private async handleCheckoutSessionCompleted(
    session: Stripe.Checkout.Session,
  ): Promise<void> {
    const userId =
      (session.metadata?.user_id as string) ?? session.client_reference_id;
    if (!userId) {
      return;
    }

    const stripeCustomerId =
      typeof session.customer === 'string'
        ? session.customer
        : (session.customer?.id ?? null);
    const stripeSubscriptionId =
      typeof session.subscription === 'string'
        ? session.subscription
        : (session.subscription?.id ?? null);

    if (!stripeCustomerId || !stripeSubscriptionId) {
      return;
    }

    let currentPeriodEnd: string | null = null;
    try {
      const subscription =
        await this.getStripe().subscriptions.retrieve(stripeSubscriptionId);
      const firstItem = subscription.items?.data?.[0];
      if (firstItem?.current_period_end) {
        currentPeriodEnd = new Date(
          firstItem.current_period_end * 1000,
        ).toISOString();
      }
    } catch {
      currentPeriodEnd = null;
    }

    const supabase = this.getSupabaseAdmin();
    const row = {
      user_id: userId,
      stripe_customer_id: stripeCustomerId,
      stripe_subscription_id: stripeSubscriptionId,
      plan: 'pro',
      status: 'active',
      current_period_end: currentPeriodEnd,
      updated_at: new Date().toISOString(),
    };

    const { data: existing } = await supabase
      .from('subscriptions')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle();

    if (existing) {
      await supabase.from('subscriptions').update(row).eq('user_id', userId);
    } else {
      await supabase.from('subscriptions').insert(row);
    }
  }

  private async handleCustomerSubscriptionUpdated(
    subscription: Stripe.Subscription,
  ): Promise<void> {
    const stripeSubscriptionId = subscription.id;
    const supabase = this.getSupabaseAdmin();

    const { data: existing } = await supabase
      .from('subscriptions')
      .select('id')
      .eq('stripe_subscription_id', stripeSubscriptionId)
      .maybeSingle();

    if (!existing) return;

    const isActive =
      subscription.status === 'active' || subscription.status === 'trialing';
    const plan = isActive ? 'pro' : 'free';
    const status = isActive ? 'active' : 'canceled';

    let currentPeriodEnd: string | null = null;
    const firstItem = subscription.items?.data?.[0];
    if (firstItem?.current_period_end) {
      currentPeriodEnd = new Date(
        firstItem.current_period_end * 1000,
      ).toISOString();
    }

    await supabase
      .from('subscriptions')
      .update({
        plan,
        status,
        current_period_end: currentPeriodEnd,
        updated_at: new Date().toISOString(),
      })
      .eq('stripe_subscription_id', stripeSubscriptionId);
  }

  private async handleCustomerSubscriptionDeleted(
    subscription: Stripe.Subscription,
  ): Promise<void> {
    const stripeSubscriptionId = subscription.id;
    const supabase = this.getSupabaseAdmin();

    const { data: existing } = await supabase
      .from('subscriptions')
      .select('id')
      .eq('stripe_subscription_id', stripeSubscriptionId)
      .maybeSingle();

    if (!existing) return;

    await supabase
      .from('subscriptions')
      .update({
        plan: 'free',
        status: 'canceled',
        updated_at: new Date().toISOString(),
      })
      .eq('stripe_subscription_id', stripeSubscriptionId);
  }
}
