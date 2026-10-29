import { prisma } from "@/lib/db";

export interface StoreSocialSettings {
  whatsappEnabled: boolean;
  whatsappNumber: string;
  whatsappLink: string;

  facebookEnabled: boolean;
  facebookUrl: string;

  instagramEnabled: boolean;
  instagramUrl: string;

  tiktokEnabled: boolean;
  tiktokUrl: string;

  supportEmail: string;
  supportPhone: string;
}

const STORE_SETTINGS_KEY = "storeSettings";

const STORE_SETTINGS_DEFAULTS: StoreSocialSettings = {
  whatsappEnabled: false,
  whatsappNumber: "",
  whatsappLink: "",

  facebookEnabled: false,
  facebookUrl: "",

  instagramEnabled: false,
  instagramUrl: "",

  tiktokEnabled: false,
  tiktokUrl: "",

  supportEmail: "",
  supportPhone: "",
};

export async function getStoreSettings(): Promise<StoreSocialSettings> {
  try {
    const row = await prisma.siteContent.findUnique({
      where: { key: STORE_SETTINGS_KEY },
    });
    if (!row) return { ...STORE_SETTINGS_DEFAULTS };
    return {
      ...STORE_SETTINGS_DEFAULTS,
      ...(row.value as Partial<StoreSocialSettings>),
    };
  } catch {
    return { ...STORE_SETTINGS_DEFAULTS };
  }
}

export async function upsertStoreSettings(
  data: Partial<StoreSocialSettings>,
): Promise<StoreSocialSettings> {
  const current = await getStoreSettings();
  const merged: StoreSocialSettings = { ...current };

  for (const key of Object.keys(data) as (keyof StoreSocialSettings)[]) {
    const v = data[key];
    if (typeof v === "boolean") {
      (merged as unknown as Record<string, unknown>)[key] = v;
    } else if (typeof v === "string") {
      (merged as unknown as Record<string, unknown>)[key] = v.trim();
    }
  }

  const json = JSON.parse(JSON.stringify(merged));

  await prisma.siteContent.upsert({
    where: { key: STORE_SETTINGS_KEY },
    update: { value: json },
    create: { key: STORE_SETTINGS_KEY, value: json },
  });

  return merged;
}

