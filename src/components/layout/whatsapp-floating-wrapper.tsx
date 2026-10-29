import { getStoreSettings } from "@/lib/data/store-settings";
import { WhatsappFloatingButton } from "./whatsapp-floating-button";

export async function WhatsappFloatingWrapper() {
  const settings = await getStoreSettings();

  return (
    <WhatsappFloatingButton
      enabled={settings.whatsappEnabled}
      whatsappLink={settings.whatsappLink}
      whatsappNumber={settings.whatsappNumber}
    />
  );
}

