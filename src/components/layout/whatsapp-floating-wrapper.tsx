import { getStoreSettings } from "@/lib/data/store-settings";
import { getLocale } from "@/lib/locale-server";
import { getMessages } from "@/messages";
import { WhatsappFloatingButton } from "./whatsapp-floating-button";

export async function WhatsappFloatingWrapper() {
  const [settings, locale] = await Promise.all([getStoreSettings(), getLocale()]);

  return (
    <WhatsappFloatingButton
      enabled={settings.whatsappEnabled}
      label={getMessages(locale).whatsapp.label}
      whatsappLink={settings.whatsappLink}
      whatsappNumber={settings.whatsappNumber}
    />
  );
}
