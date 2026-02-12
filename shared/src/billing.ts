export interface UsageResponse {
  review_count: number;
  limit: number;
  plan: 'free' | 'pro';
}

export interface CheckoutBody {
  success_url: string;
  cancel_url: string;
}

export interface CheckoutResponse {
  url: string;
}
