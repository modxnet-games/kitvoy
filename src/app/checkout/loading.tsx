import { CheckoutSkeleton } from "@/components/checkout/checkout-skeleton";

// Shown instantly while the checkout page (which is always rendered fresh) loads
export default function CheckoutLoading() {
  return <CheckoutSkeleton />;
}
