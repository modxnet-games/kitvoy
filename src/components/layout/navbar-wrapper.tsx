import { getHomepageContent } from "@/lib/data/site-content";
import { Navbar } from "./navbar";

export async function NavbarWrapper() {
  let announcementText: string | undefined;
  let announcementVisible = true;

  try {
    const content = await getHomepageContent();
    // Suppress the legacy, unapproved returns/shipping promise until the
    // merchant supplies policy-backed announcement copy in the CMS.
    announcementText = /30.day|money.back|guarantee|free.*shipping/i.test(content.announcementBar)
      ? undefined : content.announcementBar;
    announcementVisible = content.announcementBarVisible;
  } catch {
    // DB not ready — Navbar falls back to defaults
  }

  return <Navbar announcementText={announcementText} announcementVisible={announcementVisible} />;
}
