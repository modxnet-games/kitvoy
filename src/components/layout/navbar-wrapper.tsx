import { getHomepageContent } from "@/lib/data/site-content";
import { getCategoriesForNav } from "@/lib/data/categories";
import { getCustomer } from "@/lib/auth/customer-session";
import { Navbar } from "./navbar";
import { prisma } from "@/lib/db";

export async function NavbarWrapper() {
  let announcementText: string | undefined;
  let announcementVisible = true;
  let categories: { name: string; slug: string }[] = [];
  let isLoggedIn = false;
  let customerImageUrl: string | null = null;

  try {
    const [content, cats, customer] = await Promise.all([
      getHomepageContent(),
      getCategoriesForNav(),
      getCustomer(),
    ]);
    announcementText = content.announcementBar;
    announcementVisible = content.announcementBarVisible;
    categories = cats;
    isLoggedIn = customer !== null;

    if (customer) {
      const user = await prisma.user.findUnique({
        where: { id: customer.userId },
        select: { image: true },
      });
      customerImageUrl = user?.image ?? null;
    }
  } catch {
    // DB not ready — Navbar falls back to defaults
  }

  return (
    <Navbar
      announcementText={announcementText}
      announcementVisible={announcementVisible}
      categories={categories}
      isLoggedIn={isLoggedIn}
      customerImageUrl={customerImageUrl}
    />
  );
}
