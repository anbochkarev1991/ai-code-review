# Frontend security notes

## Finding: unvalidated checkout redirect (mitigated)

**Severity:** HIGH (prior to fix)

**Location:** `frontend/app/dashboard/upgrade-to-pro-button.tsx`

**Issue:** The upgrade flow assigned `data.url` from the billing API directly to `window.location.href` after only a truthiness check. Without protocol and host validation, a tampered or compromised API response could send users to an arbitrary origin (phishing / open-redirect class risk).

**Mitigation:** URLs are parsed with `URL`, restricted to `https:`, and limited to Stripe Checkout hosts (`checkout.stripe.com` by default). Additional hosts may be enabled via `NEXT_PUBLIC_STRIPE_CHECKOUT_ALLOWED_HOSTS` (comma-separated), e.g. for Stripe custom checkout domains.

**Verification:** See `frontend/lib/redirect-validation.test.ts`.
