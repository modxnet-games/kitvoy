/**
 * Moroccan phone numbers and cities, for the cash-on-delivery form. Plain
 * data and functions with no server imports: the form and the server share
 * them.
 */

const EASTERN_DIGITS = "٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹";

/** Arabic-Indic and Persian digits typed on an Arabic keyboard, as Western ones. */
export function westernDigits(input: string): string {
  return input.replace(/[٠-٩۰-۹]/g, (d) => String(EASTERN_DIGITS.indexOf(d) % 10));
}

export interface MoroccanPhone {
  /** As dialled in Morocco: 0612345678 */
  national: string;
  /** With the country code: +212612345678 */
  e164: string;
}

/**
 * A Moroccan number however it was typed: "06 12 34 56 78", "+212 612-345678",
 * "00212612345678", "612345678". Mobile (06, 07) and fixed (05) numbers are
 * accepted; anything else is null.
 */
export function parseMoroccanPhone(input: string | null | undefined): MoroccanPhone | null {
  if (!input) return null;
  let digits = westernDigits(input).replace(/\D/g, "");
  if (digits.startsWith("00212")) digits = digits.slice(5);
  else if (digits.startsWith("212") && digits.length >= 12) digits = digits.slice(3);
  if (digits.startsWith("0")) digits = digits.slice(1);
  if (!/^[5-7]\d{8}$/.test(digits)) return null;
  return { national: "0" + digits, e164: "+212" + digits };
}

/** "06 12 34 56 78" */
export function formatMoroccanPhone(national: string): string {
  return national.replace(/(\d{2})(?=\d)/g, "$1 ").trim();
}

/** A wa.me link for a stored number, or null when it isn't a Moroccan number. */
export function whatsappLink(phone: string | null | undefined, text?: string): string | null {
  const parsed = parseMoroccanPhone(phone);
  if (!parsed) return null;
  return "https://wa.me/" + parsed.e164.slice(1) + (text ? "?text=" + encodeURIComponent(text) : "");
}

export interface City {
  /** Stored on the order and shown in the admin */
  fr: string;
  ar: string;
}

/** The cities offered first in the form, largest first; any other city can be typed. */
export const CITIES: City[] = [
  { fr: "Casablanca", ar: "الدار البيضاء" },
  { fr: "Rabat", ar: "الرباط" },
  { fr: "Salé", ar: "سلا" },
  { fr: "Témara", ar: "تمارة" },
  { fr: "Marrakech", ar: "مراكش" },
  { fr: "Fès", ar: "فاس" },
  { fr: "Meknès", ar: "مكناس" },
  { fr: "Tanger", ar: "طنجة" },
  { fr: "Tétouan", ar: "تطوان" },
  { fr: "Agadir", ar: "أكادير" },
  { fr: "Oujda", ar: "وجدة" },
  { fr: "Kénitra", ar: "القنيطرة" },
  { fr: "Mohammedia", ar: "المحمدية" },
  { fr: "El Jadida", ar: "الجديدة" },
  { fr: "Safi", ar: "آسفي" },
  { fr: "Béni Mellal", ar: "بني ملال" },
  { fr: "Nador", ar: "الناظور" },
  { fr: "Khouribga", ar: "خريبكة" },
  { fr: "Settat", ar: "سطات" },
  { fr: "Berrechid", ar: "برشيد" },
  { fr: "Khémisset", ar: "الخميسات" },
  { fr: "Larache", ar: "العرائش" },
  { fr: "Ksar El Kébir", ar: "القصر الكبير" },
  { fr: "Guelmim", ar: "كلميم" },
  { fr: "Taza", ar: "تازة" },
  { fr: "Essaouira", ar: "الصويرة" },
  { fr: "Errachidia", ar: "الرشيدية" },
  { fr: "Ouarzazate", ar: "ورزازات" },
  { fr: "Al Hoceïma", ar: "الحسيمة" },
  { fr: "Berkane", ar: "بركان" },
  { fr: "Taourirt", ar: "تاوريرت" },
  { fr: "Inezgane", ar: "إنزكان" },
  { fr: "Aït Melloul", ar: "أيت ملول" },
  { fr: "Tiznit", ar: "تزنيت" },
  { fr: "Taroudant", ar: "تارودانت" },
  { fr: "Laâyoune", ar: "العيون" },
  { fr: "Dakhla", ar: "الداخلة" },
  { fr: "Khénifra", ar: "خنيفرة" },
  { fr: "Sidi Kacem", ar: "سيدي قاسم" },
  { fr: "Sidi Slimane", ar: "سيدي سليمان" },
  { fr: "Youssoufia", ar: "اليوسفية" },
  { fr: "Fquih Ben Salah", ar: "الفقيه بن صالح" },
  { fr: "Skhirat", ar: "الصخيرات" },
  { fr: "Bouznika", ar: "بوزنيقة" },
  { fr: "Benslimane", ar: "بنسليمان" },
  { fr: "Azrou", ar: "أزرو" },
  { fr: "Ifrane", ar: "إفران" },
  { fr: "Midelt", ar: "ميدلت" },
  { fr: "Chefchaouen", ar: "شفشاون" },
  { fr: "Fnideq", ar: "الفنيدق" },
  { fr: "M'diq", ar: "المضيق" },
  { fr: "Martil", ar: "مرتيل" },
  { fr: "Ouazzane", ar: "وزان" },
  { fr: "Sefrou", ar: "صفرو" },
  { fr: "Tan-Tan", ar: "طانطان" },
  { fr: "Zagora", ar: "زاكورة" },
  { fr: "Tinghir", ar: "تنغير" },
  { fr: "Guercif", ar: "جرسيف" },
  { fr: "Oued Zem", ar: "وادي زم" },
  { fr: "El Kelaâ des Sraghna", ar: "قلعة السراغنة" },
  { fr: "Ben Guerir", ar: "ابن جرير" },
  { fr: "Sidi Bennour", ar: "سيدي بنور" },
  { fr: "Azemmour", ar: "أزمور" },
];
