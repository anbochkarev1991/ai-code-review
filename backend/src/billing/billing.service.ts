import { BadRequestException, Injectable } from '@nestjs/common';
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';

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

  async handleWebhookEvent(event: Stripe.Event): Promise<void> {
    if (!event.data?.object) return;

    switch (event.type) {
      case 'checkout.session.completed':
        await this.handleCheckoutSessionCompleted(
          event.data.object as Stripe.Checkout.Session,
        );
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
        : session.customer?.id ?? null;
    const stripeSubscriptionId =
      typeof session.subscription === 'string'
        ? session.subscription
        : session.subscription?.id ?? null;

    if (!stripeCustomerId || !stripeSubscriptionId) {
      return;
    }

    let currentPeriodEnd: string | null = null;
    try {
      const subscription = await this.getStripe().subscriptions.retrieve(
        stripeSubscriptionId,
      );
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
      await supabase
        .from('subscriptions')
        .update(row)
        .eq('user_id', userId);
    } else {
      await supabase.from('subscriptions').insert(row);
    }
  }
}
