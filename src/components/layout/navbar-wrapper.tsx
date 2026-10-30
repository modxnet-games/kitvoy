import { getHomepageContent } from "@/lib/data/site-content";
import { Navbar } from "./navbar";

export async function NavbarWrapper() {
  let announcementText: string | undefined;
  let announcementVisible = true;

  try {
    const content = await getHomepageContent();
    announcementText = content.announcementBar;
    announcementVisible = content.announcementBarVisible;
  } catch {
    // DB not ready — Navbar falls back to defaults
  }

  return <Navbar announcementText={announcementText} announcementVisible={announcementVisible} />;
}
