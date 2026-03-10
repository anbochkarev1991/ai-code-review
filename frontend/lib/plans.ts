export type PlanId = "free" | "pro";

export interface PlanFeature {
  text: string;
}

export interface Plan {
  id: PlanId;
  name: string;
  price: string;
  priceValue: number;
  features: PlanFeature[];
  recommended?: boolean;
}

export const plans: Plan[] = [
  {
    id: "free",
    name: "Free",
    price: "$0",
    priceValue: 0,
    features: [
      { text: "10 reviews per month" },
      { text: "Code Quality analysis" },
      { text: "Basic findings" },
    ],
  },
  {
    id: "pro",
    name: "Pro",
    price: "$19.99",
    priceValue: 19.99,
    recommended: true,
    features: [
      { text: "200 reviews per month" },
      { text: "Priority processing" },
      { text: "Code Quality analysis" },
      { text: "Architecture review" },
      { text: "Performance optimization" },
      { text: "Security scanning" },
      { text: "Aggregated findings with severity levels" },
    ],
  },
];
