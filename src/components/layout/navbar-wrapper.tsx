import { getHomepageContent } from "@/lib/data/site-content";
import { Navbar } from "./navbar";

export async function NavbarWrapper() {
  let announcementVisible = true;

  try {
    announcementVisible = (await getHomepageContent()).announcementBarVisible;
  } catch {
    // DB not ready — Navbar falls back to defaults
  }

  return <Navbar announcementVisible={announcementVisible} />;
}
