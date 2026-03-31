import { BadRequestException } from '@nestjs/common';

function normalizeFrontendBaseUrl(): URL {
  const raw = process.env.FRONTEND_URL?.trim();
  if (!raw) {
    throw new BadRequestException('FRONTEND_URL is not configured');
  }
  const withScheme =
    raw.startsWith('http://') || raw.startsWith('https://')
      ? raw
      : `https://${raw}`;
  try {
    return new URL(withScheme);
  } catch {
    throw new BadRequestException('FRONTEND_URL is not a valid URL');
  }
}

/**
 * Ensures Stripe success/cancel URLs point at the configured frontend host only.
 */
export function assertStripeCheckoutReturnUrlAllowed(urlStr: string): void {
  let parsed: URL;
  try {
    parsed = new URL(urlStr);
  } catch {
    throw new BadRequestException('Return URL is not a valid URL');
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new BadRequestException('Return URL must use http or https');
  }

  const allowed = normalizeFrontendBaseUrl();
  if (parsed.hostname.toLowerCase() !== allowed.hostname.toLowerCase()) {
    throw new BadRequestException(
      'Return URL hostname must match configured frontend',
    );
  }

  const allowedPort =
    allowed.port || (allowed.protocol === 'https:' ? '443' : '80');
  const urlPort = parsed.port || (parsed.protocol === 'https:' ? '443' : '80');
  if (urlPort !== allowedPort) {
    throw new BadRequestException(
      'Return URL port must match configured frontend',
    );
  }
}
