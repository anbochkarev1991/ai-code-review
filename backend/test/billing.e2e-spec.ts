import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import Stripe from 'stripe';
import { AppModule } from '../src/app.module';

describe('BillingController (e2e)', () => {
  let app: INestApplication<App>;
  const webhookSecret = 'whsec_test_webhook_secret_for_e2e';

  beforeAll(async () => {
    process.env.STRIPE_WEBHOOK_SECRET = webhookSecret;
    process.env.STRIPE_SECRET_KEY =
      process.env.STRIPE_SECRET_KEY ?? 'sk_test_placeholder';

    app = await NestFactory.create<NestExpressApplication>(AppModule, {
      rawBody: true,
    });
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /billing/webhook', () => {
    it('returns 200 when Stripe-Signature is valid', async () => {
      const payload = {
        id: 'evt_test_webhook',
        object: 'event',
        type: 'checkout.session.completed',
      };
      const payloadString = JSON.stringify(payload);
      const stripe = new Stripe('sk_test_placeholder');
      const signature = stripe.webhooks.generateTestHeaderString({
        payload: payloadString,
        secret: webhookSecret,
      });

      const response = await request(app.getHttpServer())
        .post('/billing/webhook')
        .set('stripe-signature', signature)
        .set('content-type', 'application/json')
        .send(payloadString)
        .expect(200);

      expect(response.body).toEqual({ received: true });
    });

    it('returns 400 when Stripe-Signature is missing', async () => {
      await request(app.getHttpServer())
        .post('/billing/webhook')
        .set('content-type', 'application/json')
        .send(JSON.stringify({ id: 'evt_test' }))
        .expect(400);
    });

    it('returns 400 when signature is invalid', async () => {
      const payload = JSON.stringify({ id: 'evt_test', object: 'event' });

      await request(app.getHttpServer())
        .post('/billing/webhook')
        .set('stripe-signature', 'invalid_signature')
        .set('content-type', 'application/json')
        .send(payload)
        .expect(400);
    });
  });
});
