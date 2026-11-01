import { getHomepageContent } from "@/lib/data/site-content";
import { Navbar } from "./navbar";

export async function NavbarWrapper() {
  let announcementText: string | undefined;
  let announcementVisible = true;

  try {
    const content = await getHomepageContent();
    // Free US shipping on every order is published policy (config/policies.ts).
    // Legacy CMS text promising a money-back guarantee or a free-shipping
    // threshold contradicts it, so it falls back to the default.
    announcementText = /30.day|money.back|guarantee|orders over/i.test(content.announcementBar)
      ? undefined : content.announcementBar;
    announcementVisible = content.announcementBarVisible;
  } catch {
    // DB not ready — Navbar falls back to defaults
  }

  return <Navbar announcementText={announcementText} announcementVisible={announcementVisible} />;
}
