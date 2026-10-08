import { cookies } from "next/headers";
import { LOCALE_COOKIE_NAME, resolveLocale } from "./i18n/locales";

// Langue de l'espace interne (cookie, arabe par défaut) — même règle que
// app/admin/layout.js, pour les pages serveur qui adaptent leurs DONNÉES à la
// langue (ex. nom du voyageur en arabe), pas seulement leurs libellés.
export async function getAdminLocale() {
  const store = await cookies();
  return resolveLocale(store.get(LOCALE_COOKIE_NAME)?.value);
}

// En arabe : le nom arabe saisi à l'inscription s'il existe, sinon le nom
// d'origine (jamais de cellule vide).
export function displayTravelerName(row, locale) {
  return locale === "ar" && row.full_name_arabic?.trim() ? row.full_name_arabic : row.full_name;
}
