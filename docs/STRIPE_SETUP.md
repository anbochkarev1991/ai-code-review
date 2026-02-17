# Stripe Setup (Day 3 — Task 3.1)

## 3.1 — Create Product "AI Code Review Pro" and monthly Price

1. Go to [Stripe Dashboard](https://dashboard.stripe.com/) (use **Test mode** for development)
2. Navigate to **Products** → **Add product**
3. Set:
   - **Name:** AI Code Review Pro
   - **Description:** (optional) Monthly subscription for Pro code reviews
4. Under **Pricing**, add a **Recurring** price:
   - **Billing period:** Monthly
   - **Price:** Set your desired amount (e.g. $19/month)
5. Click **Save product**
6. After creating, copy the **Price ID** (starts with `price_`)
7. In Stripe Dashboard → **Developers → API keys**, copy the **Secret key** (starts with `sk_test_`)
8. Add to `backend/.env`:
   ```bash
   STRIPE_SECRET_KEY=sk_test_xxxxxxxxxxxxxxxxxxxxx
   STRIPE_PRO_PRICE_ID=price_xxxxxxxxxxxxxxxxxxxxx
   ```

**Verify:** Both keys are set in env. Task 3.2+ uses these for checkout.

## 3.3 — Webhook (local testing)

1. Install [Stripe CLI](https://stripe.com/docs/stripe-cli)
2. Run: `stripe listen --forward-to localhost:3001/billing/webhook`
3. Copy the webhook signing secret (starts with `whsec_`) and add to `backend/.env`:
   ```bash
   STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxxxxxxxxxx
   ```
4. Restart the backend. Events forwarded by the CLI will be signed with this secret.

**Verify:** `curl` or Stripe CLI trigger to the local URL returns 200 when signature is valid.
