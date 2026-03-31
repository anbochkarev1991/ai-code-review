import { BadRequestException } from '@nestjs/common';
import { assertStripeCheckoutReturnUrlAllowed } from './checkout-return-url';

describe('assertStripeCheckoutReturnUrlAllowed', () => {
  const prev = process.env.FRONTEND_URL;

  afterEach(() => {
    process.env.FRONTEND_URL = prev;
  });

  it('accepts same host and port as FRONTEND_URL', () => {
    process.env.FRONTEND_URL = 'http://localhost:3000';
    expect(() =>
      assertStripeCheckoutReturnUrlAllowed(
        'http://localhost:3000/billing/success',
      ),
    ).not.toThrow();
  });

  it('rejects different hostname', () => {
    process.env.FRONTEND_URL = 'http://localhost:3000';
    expect(() =>
      assertStripeCheckoutReturnUrlAllowed(
        'http://evil.example/billing/success',
      ),
    ).toThrow(BadRequestException);
  });

  it('rejects when FRONTEND_URL is unset', () => {
    delete process.env.FRONTEND_URL;
    expect(() =>
      assertStripeCheckoutReturnUrlAllowed('http://localhost:3000/x'),
    ).toThrow(BadRequestException);
  });

  it('rejects non-http(s) scheme', () => {
    process.env.FRONTEND_URL = 'http://localhost:3000';
    expect(() =>
      assertStripeCheckoutReturnUrlAllowed('javascript:alert(1)'),
    ).toThrow(BadRequestException);
  });
});
