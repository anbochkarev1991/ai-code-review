# Frontend security notes

## Finding: unvalidated checkout redirect (mitigated)

**Severity:** HIGH (prior to fix)

**Location:** `frontend/app/dashboard/upgrade-to-pro-button.tsx`

**Issue:** The upgrade flow assigned `data.url` from the billing API directly to `window.location.href` after only a truthiness check. Without protocol and host validation, a tampered or compromised API response could send users to an arbitrary origin (phishing / open-redirect class risk).

**Mitigation:** URLs are parsed with `URL`, restricted to `https:`, and limited to Stripe Checkout hosts (`checkout.stripe.com` by default). Additional hosts may be enabled via `NEXT_PUBLIC_STRIPE_CHECKOUT_ALLOWED_HOSTS` (comma-separated), e.g. for Stripe custom checkout domains.

**Verification:** See `frontend/lib/redirect-validation.test.ts`.

## Post-auth relative redirect (`/auth/callback`)

**Mitigation:** The `next` query parameter is normalized with `getSafeRelativeRedirectPath` so values like `//evil.example` or absolute URLs are rejected; redirects are built with `new URL(safePath, origin)`.

## Stripe return URLs (server)

**Mitigation:** `POST /billing/checkout` validates `success_url` and `cancel_url` with `assertStripeCheckoutReturnUrlAllowed` (`backend/src/billing/checkout-return-url.ts`) so they must match `FRONTEND_URL` hostname and port before being passed to Stripe.
