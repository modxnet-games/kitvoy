import type { Metadata } from "next";
import { notFound } from "next/navigation";

import {
  getProductBySlug,
  getRelatedProducts,
} from "@/lib/data/products";
import { getReviewsByProductId } from "@/lib/data/reviews";
import { findReviewByUserAndProduct } from "@/lib/data/reviews";
import { getCustomer } from "@/lib/auth/customer-session";
import { ProductPageContent } from "./product-page-content";

export const dynamic = "force-dynamic";

interface ProductPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({
  params,
}: ProductPageProps): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) return {};
  return {
    title: product.name,
    description: product.shortDescription,
  };
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { slug } = await params;

  let product;
  try {
    product = await getProductBySlug(slug);
  } catch (error) {
    console.error("Failed to fetch product:", error);
    notFound();
  }

  if (!product) notFound();

  const customer = await getCustomer();

  const [relatedProducts, reviews, existingReview] = await Promise.all([
    getRelatedProducts(product).catch(() => []),
    getReviewsByProductId(product.id).catch(() => []),
    customer
      ? findReviewByUserAndProduct(customer.userId, product.id).catch(() => null)
      : Promise.resolve(null),
  ]);

  const hasReviewed = existingReview !== null;

  return (
    <ProductPageContent
      product={product}
      relatedProducts={relatedProducts}
      reviews={reviews}
      customer={customer}
      hasReviewed={hasReviewed}
    />
  );
}
