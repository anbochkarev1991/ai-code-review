# Stripe Integration Guide

Complete step-by-step guide to set up Stripe for AI Code Review Pro subscriptions.

## Prerequisites

- Stripe account (create at [stripe.com](https://stripe.com))
- Backend running on `localhost:3001` (or your configured port)
- Supabase project with `subscriptions` table configured

---

## Step 1: Create Stripe Account & Enable Test Mode

1. Go to [Stripe Dashboard](https://dashboard.stripe.com/)
2. Sign up or log in
3. **Important:** Ensure you're in **Test mode** (toggle in top right)
   - Test mode uses `sk_test_` keys (safe for development)
   - Live mode uses `sk_live_` keys (for production)

---

## Step 2: Create Product & Price

1. In Stripe Dashboard, navigate to **Products** → **Add product**
2. Fill in product details:
   - **Name:** `AI Code Review Pro`
   - **Description:** (optional) `Monthly subscription for Pro code reviews`
3. Under **Pricing**, add a **Recurring** price:
   - **Billing period:** Monthly
   - **Price:** Set your desired amount (e.g., `$19.00` USD/month)
   - **Currency:** USD (or your preferred currency)
4. Click **Save product**
5. **Copy the Price ID** (starts with `price_`)
   - Example: `price_1AbCdEfGhIjKlMnOpQrStUv`

---

## Step 3: Get API Keys

1. In Stripe Dashboard, go to **Developers** → **API keys**
2. Under **Standard keys**, find:
   - **Publishable key** (starts with `pk_test_`) — not needed for backend
   - **Secret key** (starts with `sk_test_`) — **COPY THIS**
3. Click **Reveal test key** if needed
4. **Copy the Secret key** (starts with `sk_test_`)
   - Example: `sk_test_51AbCdEfGhIjKlMnOpQrStUvWxYz1234567890`

---

## Step 4: Configure Environment Variables

Add these to your `backend/.env` file:

```bash
# Stripe API Configuration
STRIPE_SECRET_KEY=sk_test_xxxxxxxxxxxxxxxxxxxxx
STRIPE_PRO_PRICE_ID=price_xxxxxxxxxxxxxxxxxxxxx
```

**Replace:**
- `sk_test_xxxxxxxxxxxxxxxxxxxxx` with your actual Secret key from Step 3
- `price_xxxxxxxxxxxxxxxxxxxxx` with your actual Price ID from Step 2

---

## Step 5: Set Up Webhooks (Local Development)

For local development, use Stripe CLI to forward webhook events to your local backend.

### 5.1 Install Stripe CLI

**macOS:**
```bash
brew install stripe/stripe-cli/stripe
```

**Linux/Windows:**
See [Stripe CLI installation guide](https://stripe.com/docs/stripe-cli)

### 5.2 Authenticate Stripe CLI

```bash
stripe login
```

This opens a browser to authenticate. Follow the prompts.

### 5.3 Forward Webhooks to Local Backend

```bash
stripe listen --forward-to localhost:3001/billing/webhook
```

**Keep this terminal running** — it will forward webhook events to your backend.

### 5.4 Get Webhook Signing Secret

After running `stripe listen`, you'll see output like:

```
> Ready! Your webhook signing secret is whsec_xxxxxxxxxxxxxxxxxxxxx
```

**Copy the webhook signing secret** (starts with `whsec_`)

### 5.5 Add Webhook Secret to Environment

Add to `backend/.env`:

```bash
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxxxxxxxxxx
```

**Important:** Each time you restart `stripe listen`, you'll get a new webhook secret. Update your `.env` file accordingly.

---

## Step 6: Set Up Webhooks (Production)

For production, configure webhooks in Stripe Dashboard:

1. In Stripe Dashboard, go to **Developers** → **Webhooks**
2. Click **Add endpoint**
3. Enter your production webhook URL:
   ```
   https://your-backend-domain.com/billing/webhook
   ```
4. Select events to listen for:
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
5. Click **Add endpoint**
6. **Copy the Signing secret** (starts with `whsec_`)
7. Add to your production environment variables:
   ```bash
   STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxxxxxxxxxx
   ```

---

## Step 7: Verify Configuration

### 7.1 Check Environment Variables

Ensure all three Stripe variables are set in `backend/.env`:

```bash
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PRO_PRICE_ID=price_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

### 7.2 Restart Backend

```bash
cd backend
npm run start:dev
```

### 7.3 Test Checkout Flow

1. Log in to your app
2. Navigate to Dashboard
3. Click **Upgrade to Pro**
4. You should be redirected to Stripe Checkout
5. Use Stripe test card: `4242 4242 4242 4242`
   - Expiry: Any future date (e.g., `12/34`)
   - CVC: Any 3 digits (e.g., `123`)
   - ZIP: Any 5 digits (e.g., `12345`)

### 7.4 Verify Webhook Processing

After completing checkout:

1. Check your `stripe listen` terminal — you should see webhook events
2. Check your Supabase `subscriptions` table — a new row should be created with:
   - `plan: 'pro'`
   - `status: 'active'`
   - `stripe_customer_id` and `stripe_subscription_id` populated

---

## Step 8: Test Webhook Events (Optional)

Use Stripe CLI to trigger test events:

```bash
# Test checkout completion
stripe trigger checkout.session.completed

# Test subscription update
stripe trigger customer.subscription.updated

# Test subscription cancellation
stripe trigger customer.subscription.deleted
```

Check your Supabase `subscriptions` table to verify updates.

---

## Troubleshooting

### Error: "Invalid API Key provided"

- **Cause:** `STRIPE_SECRET_KEY` is missing, incorrect, or uses wrong mode (test vs live)
- **Fix:** 
  1. Verify key starts with `sk_test_` (test mode) or `sk_live_` (production)
  2. Ensure key is copied completely (no extra spaces)
  3. Restart backend after updating `.env`

### Error: "Stripe Pro price is not configured"

- **Cause:** `STRIPE_PRO_PRICE_ID` is missing or incorrect
- **Fix:** Copy the Price ID from Stripe Dashboard → Products → Your Product → Pricing

### Error: "Stripe webhook secret not configured"

- **Cause:** `STRIPE_WEBHOOK_SECRET` is missing
- **Fix:** Run `stripe listen` and copy the `whsec_` secret to `.env`

### Webhooks Not Receiving Events

- **Local:** Ensure `stripe listen` is running and forwarding to correct port
- **Production:** Verify webhook URL is correct and accessible
- Check backend logs for webhook signature verification errors

### Checkout Redirects but No Subscription Created

- Verify `SUPABASE_SERVICE_ROLE_KEY` is set (required for webhook to write to database)
- Check webhook logs in Stripe Dashboard → Developers → Webhooks
- Verify `checkout.session.completed` event is being sent

---

## Production Checklist

Before going live:

- [ ] Switch Stripe Dashboard to **Live mode**
- [ ] Create product and price in **Live mode**
- [ ] Get **Live** API keys (`sk_live_...`)
- [ ] Set up production webhook endpoint
- [ ] Update production environment variables:
  - `STRIPE_SECRET_KEY` (live key)
  - `STRIPE_PRO_PRICE_ID` (live price ID)
  - `STRIPE_WEBHOOK_SECRET` (production webhook secret)
- [ ] Test checkout flow with real card (use small amount)
- [ ] Verify webhook events are received in production

---

## Additional Resources

- [Stripe API Documentation](https://stripe.com/docs/api)
- [Stripe Checkout Documentation](https://stripe.com/docs/payments/checkout)
- [Stripe Webhooks Guide](https://stripe.com/docs/webhooks)
- [Stripe Test Cards](https://stripe.com/docs/testing)
