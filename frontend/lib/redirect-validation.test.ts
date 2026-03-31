import { describe, expect, it, vi } from "vitest";
import {
  getSafeRelativeRedirectPath,
  validateStripeCheckoutRedirectUrl,
} from "./redirect-validation";

describe("getSafeRelativeRedirectPath", () => {
  it("allows simple paths and preserves query strings", () => {
    expect(getSafeRelativeRedirectPath("/dashboard")).toBe("/dashboard");
    expect(getSafeRelativeRedirectPath("/reviews?x=1")).toBe("/reviews?x=1");
  });

  it("rejects protocol-relative and non-relative values", () => {
    expect(getSafeRelativeRedirectPath("//evil.example")).toBe("/dashboard");
    expect(getSafeRelativeRedirectPath("https://evil.example")).toBe("/dashboard");
    expect(getSafeRelativeRedirectPath(null)).toBe("/dashboard");
    expect(getSafeRelativeRedirectPath("")).toBe("/dashboard");
  });

  it("rejects colon or backslash in path segment", () => {
    expect(getSafeRelativeRedirectPath("/foo\\bar")).toBe("/dashboard");
    expect(getSafeRelativeRedirectPath("/foo:bar")).toBe("/dashboard");
  });
});

describe("validateStripeCheckoutRedirectUrl", () => {
  it("accepts https checkout.stripe.com URL", () => {
    const result = validateStripeCheckoutRedirectUrl(
      "https://checkout.stripe.com/c/pay/cs_test_abc#fragment",
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.url.hostname).toBe("checkout.stripe.com");
      expect(result.url.protocol).toBe("https:");
    }
  });

  it("rejects http on checkout host", () => {
    const result = validateStripeCheckoutRedirectUrl(
      "http://checkout.stripe.com/c/pay/cs_test_abc",
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toContain("HTTPS");
    }
  });

  it("rejects untrusted host", () => {
    const result = validateStripeCheckoutRedirectUrl("https://evil.example/phish");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toContain("hostname");
    }
  });

  it("rejects subdomain phishing (checkout.stripe.com.evil.com)", () => {
    const result = validateStripeCheckoutRedirectUrl(
      "https://checkout.stripe.com.evil.com/c/pay/cs_test_abc",
    );
    expect(result.ok).toBe(false);
  });

  it("rejects empty and malformed URLs", () => {
    expect(validateStripeCheckoutRedirectUrl("").ok).toBe(false);
    expect(validateStripeCheckoutRedirectUrl("   ").ok).toBe(false);
    expect(validateStripeCheckoutRedirectUrl("not-a-url").ok).toBe(false);
  });

  it("rejects javascript: scheme", () => {
    const result = validateStripeCheckoutRedirectUrl(
      "javascript:alert(1)//checkout.stripe.com",
    );
    expect(result.ok).toBe(false);
  });

  it("allows extra host from NEXT_PUBLIC_STRIPE_CHECKOUT_ALLOWED_HOSTS", () => {
    vi.stubEnv(
      "NEXT_PUBLIC_STRIPE_CHECKOUT_ALLOWED_HOSTS",
      "pay.example.com, AnotherHost.ORG ",
    );
    try {
      const ok = validateStripeCheckoutRedirectUrl("https://anotherhost.org/start");
      expect(ok.ok).toBe(true);
      const bad = validateStripeCheckoutRedirectUrl("https://unlisted.org/start");
      expect(bad.ok).toBe(false);
    } finally {
      vi.unstubAllEnvs();
    }
  });
});
