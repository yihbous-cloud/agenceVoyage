// Liens de contact du site public (fichier pur, utilisable côté client).

// Code source des boutons WhatsApp du site : le message pré-rempli se
// termine par « [SITE] », reconnu à la réception (lib/whatsapp/links.js,
// lien « SITE » créé par la migration 046) pour attribuer la source au
// contact.
export const SITE_WHATSAPP_CODE = "SITE";

// wa.me exige un numéro international sans « + » ni « 0 » initial : les
// numéros saisis dans /admin/parametres sont souvent au format marocain
// local (« 0661... ») → 212661... Repli sur les chiffres tels quels si le
// numéro est déjà international.
export function whatsappNumber(raw) {
  if (!raw) return null;
  const digits = String(raw).replace(/[^\d+]/g, "");
  if (!digits) return null;
  if (digits.startsWith("+")) return digits.slice(1);
  if (digits.startsWith("00")) return digits.slice(2);
  if (digits.startsWith("0")) return `212${digits.slice(1)}`;
  return digits;
}

// Lien WhatsApp avec message pré-rempli (le code source est ajouté à la fin).
export function whatsappUrl(raw, message) {
  const number = whatsappNumber(raw);
  if (!number) return null;
  const text = [String(message || "").trim(), `[${SITE_WHATSAPP_CODE}]`].filter(Boolean).join(" ");
  return `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
}

export function telHref(raw) {
  if (!raw) return null;
  const value = String(raw).replace(/[^\d+]/g, "");
  return value ? `tel:${value}` : null;
}

// Bouton WhatsApp flottant du site (migration 049) : message saisi dans
// « Paramètres WhatsApp », sinon texte par défaut dans la langue de la page.
// L'anglais reprend le message français. Numéro propre au bouton, sinon le
// numéro WhatsApp de l'agence. Renvoie null si le bouton est désactivé ou
// s'il n'y a aucun numéro.
export const DEFAULT_SITE_BUTTON_MESSAGES = {
  ar: "السلام عليكم، أود الحصول على معلومات حول رحلاتكم.",
  fr: "Bonjour, je souhaite avoir des informations sur vos voyages.",
};

export function siteButtonMessage(agency, locale) {
  const ar = agency?.wa_button_message_ar?.trim();
  const fr = agency?.wa_button_message_fr?.trim();
  if (locale === "ar") return ar || DEFAULT_SITE_BUTTON_MESSAGES.ar;
  return fr || DEFAULT_SITE_BUTTON_MESSAGES.fr;
}

export function siteButtonHref(agency, locale) {
  if (!agency || !Number(agency.wa_button_enabled ?? 1)) return null;
  return whatsappUrl(agency.wa_button_number || agency.whatsapp, siteButtonMessage(agency, locale));
}
