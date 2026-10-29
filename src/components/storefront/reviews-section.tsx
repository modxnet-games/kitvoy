"use client";

import { usePathname } from "next/navigation";
import { useLanguage } from "@/contexts/language-context";
import { ReviewForm } from "./review-form";
import { ReviewsList } from "./reviews-list";
import type { ReviewWithUser } from "@/lib/data/reviews";
import { SignInModal } from "@/components/layout/sign-in-modal";
import { useState } from "react";

interface Customer {
  userId: string;
  fullName: string;
  email: string;
}

interface ReviewsSectionProps {
  productId: string;
  productSlug: string;
  reviews: ReviewWithUser[];
  customer: Customer | null;
  hasReviewed: boolean;
}

export function ReviewsSection({
  productId,
  productSlug,
  reviews,
  customer,
  hasReviewed,
}: ReviewsSectionProps) {
  const { t } = useLanguage();
  const pathname = usePathname();
  const [authOpen, setAuthOpen] = useState(false);

  return (
    <section className="border-t py-12">
      <h2 className="text-xl font-semibold">{t("reviews.title")}</h2>

      {!customer ? (
        <div className="mt-4 rounded-lg border bg-muted/30 p-4">
          <p className="text-sm text-muted-foreground">
            {t("reviews.loginRequired")}{" "}
            <button
              type="button"
              className="font-medium text-primary hover:underline"
              onClick={() => setAuthOpen(true)}
            >
              {t("auth.login.submit")}
            </button>
          </p>
        </div>
      ) : hasReviewed ? (
        <div className="mt-4 rounded-lg border bg-muted/30 p-4">
          <p className="text-sm text-muted-foreground">
            {t("reviews.alreadyReviewed")}
          </p>
        </div>
      ) : (
        <div className="mt-6">
          <h3 className="mb-4 text-sm font-medium">{t("reviews.writeReview")}</h3>
          <ReviewForm productId={productId} productSlug={productSlug} />
        </div>
      )}

      <div className="mt-8">
        <ReviewsList reviews={reviews} />
      </div>

      <SignInModal
        open={authOpen}
        onClose={() => setAuthOpen(false)}
        redirectUrl={pathname || "/shop"}
      />
    </section>
  );
}
