import { redirect } from "next/navigation";

/** The store sells one product for now, so its page is the storefront. */
export default function HomePage() {
  redirect("/products/pouncepop");
}
