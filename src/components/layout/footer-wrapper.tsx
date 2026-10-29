import { getStoreSettings } from "@/lib/data/store-settings";
import { Footer } from "./footer";

export async function FooterWrapper() {
  const settings = await getStoreSettings();

  return (
    <Footer
      social={{
        whatsappEnabled: settings.whatsappEnabled,
        whatsappNumber: settings.whatsappNumber,
        whatsappLink: settings.whatsappLink,
        facebookEnabled: settings.facebookEnabled,
        facebookUrl: settings.facebookUrl,
        instagramEnabled: settings.instagramEnabled,
        instagramUrl: settings.instagramUrl,
        tiktokEnabled: settings.tiktokEnabled,
        tiktokUrl: settings.tiktokUrl,
      }}
    />
  );
}

