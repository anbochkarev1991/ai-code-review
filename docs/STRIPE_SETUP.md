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
7. Add to `backend/.env`:
   ```bash
   STRIPE_PRO_PRICE_ID=price_xxxxxxxxxxxxxxxxxxxxx
   ```

**Verify:** Price ID is set in env (e.g. `STRIPE_PRO_PRICE_ID`). Upcoming tasks (3.2+) will use this for checkout.

## 3.3 — Webhook (local testing)

1. Install [Stripe CLI](https://stripe.com/docs/stripe-cli)
2. Run: `stripe listen --forward-to localhost:3001/billing/webhook`
3. Copy the webhook signing secret (starts with `whsec_`) and add to `backend/.env`:
   ```bash
   STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxxxxxxxxxx
   ```
4. Restart the backend. Events forwarded by the CLI will be signed with this secret.

**Verify:** `curl` or Stripe CLI trigger to the local URL returns 200 when signature is valid.

## 3.4 — checkout.session.completed handler

The webhook handler creates/updates the `subscriptions` table when a customer completes checkout. Requires `SUPABASE_SERVICE_ROLE_KEY` in `backend/.env`.

**Verify:** Complete a test checkout (via POST `/billing/checkout` from task 3.2); the webhook will create or update a `subscriptions` row with `stripe_customer_id`, `stripe_subscription_id`, `plan=pro`, `status=active`. Ensure the checkout session includes `metadata: { user_id: <supabase_user_uuid> }`.

## 3.5 — customer.subscription.updated and customer.subscription.deleted handlers

The webhook handler updates `subscriptions` when a subscription changes or is canceled:
- `customer.subscription.updated`: Sets `plan=pro`/`status=active` when status is active/trialing; `plan=free`/`status=canceled` otherwise
- `customer.subscription.deleted`: Sets `plan=free`, `status=canceled`

**Verify:** Trigger with Stripe CLI (e.g. `stripe trigger customer.subscription.updated`, `stripe trigger customer.subscription.deleted`). Updates are idempotent; DB stays in sync with Stripe.
