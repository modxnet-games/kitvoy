import { PolicyPage, policyMetadata } from "@/components/policies/policy-page";

export const dynamic = "force-dynamic";

export const generateMetadata = () => policyMetadata("shipping");

export default function Page() {
  return <PolicyPage policy="shipping" />;
}
