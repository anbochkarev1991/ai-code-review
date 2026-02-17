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
