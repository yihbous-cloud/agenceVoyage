import { query } from "./db";
import { resolveAgencyId, assertOwned } from "./agencyContext";
import { programPath } from "./programUrls";
import { applyTranslations, setTranslations } from "./contentTranslations";

// Lien public dérivé dynamiquement d'un programme (lib/programUrls.js) —
// jamais figé, reste correct si le slug ou le pilier (Omra/Hajj) change.
function resolveHref(slide) {
  if (slide.program_id) {
    return programPath({
      family: slide.program_family,
      program_type: slide.program_type_value,
      slug: slide.program_slug,
    });
  }
  return slide.button_link || "#";
}

const SELECT_WITH_PROGRAM = `
  -- agency-lint-ok: fragment de base, chaque appelant ajoute WHERE s.agency_id = ?
  SELECT s.*, p.title AS program_title, p.slug AS program_slug, p.family AS program_family,
         p.program_type AS program_type_value
  FROM slides s
  LEFT JOIN programs p ON p.id = s.program_id
`;

// locale (optionnel) : titre, sous-titre et bouton dans la langue de la page
// quand une traduction existe (vague 1B du référencement).
export async function listActiveSlides(explicitAgencyId, locale) {
  const agencyId = await resolveAgencyId(explicitAgencyId);
  const rows = await query(
    `${SELECT_WITH_PROGRAM} WHERE s.is_active = TRUE AND s.agency_id = ? ORDER BY s.sort_order ASC, s.id ASC`,
    [agencyId]
  );
  const translated = await applyTranslations("slide", rows, locale, agencyId);
  return translated.map((s) => ({ ...s, href: resolveHref(s) }));
}

export async function listAllSlides() {
  const agencyId = await resolveAgencyId();
  const rows = await query(
    `${SELECT_WITH_PROGRAM} WHERE s.agency_id = ? ORDER BY s.sort_order ASC, s.id ASC`,
    [agencyId]
  );
  return rows.map((s) => ({ ...s, href: resolveHref(s) }));
}

export async function createSlide(data) {
  const agencyId = await resolveAgencyId();
  if (data.programId) await assertOwned("programs", data.programId, agencyId);
  const [{ maxOrder }] = await query(
    `SELECT COALESCE(MAX(sort_order), -1) + 1 AS maxOrder FROM slides WHERE agency_id = ?`,
    [agencyId]
  );
  const result = await query(
    `INSERT INTO slides (title, content_locale, subtitle, image_url, mobile_image_url, button_text, program_id, button_link, sort_order, is_active, agency_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      data.title,
      data.contentLocale === "fr" ? "fr" : "ar",
      data.subtitle || null,
      data.imageUrl || null,
      data.mobileImageUrl || null,
      data.buttonText || "Découvrir",
      data.programId || null,
      data.programId ? null : data.buttonLink || null,
      maxOrder,
      data.isActive ?? true,
      agencyId,
    ]
  );
  if (data.translations !== undefined) {
    await setTranslations("slide", result.insertId, data.translations, {
      baseLocale: data.contentLocale === "fr" ? "fr" : "ar",
    }, agencyId);
  }
  return result.insertId;
}

export async function updateSlide(id, data) {
  const agencyId = await resolveAgencyId();
  await assertOwned("slides", id, agencyId);
  if (data.programId) await assertOwned("programs", data.programId, agencyId);
  await query(
    `UPDATE slides SET title = ?, content_locale = COALESCE(?, content_locale), subtitle = ?, image_url = ?, mobile_image_url = ?, button_text = ?, program_id = ?, button_link = ?, is_active = ?
     WHERE id = ? AND agency_id = ?`,
    [
      data.title,
      // Langue principale : inchangée si l'appel ne l'envoie pas (ex. bascule
      // actif/inactif depuis le tableau).
      data.contentLocale === "fr" || data.contentLocale === "ar" ? data.contentLocale : null,
      data.subtitle || null,
      data.imageUrl || null,
      data.mobileImageUrl || null,
      data.buttonText || "Découvrir",
      data.programId || null,
      data.programId ? null : data.buttonLink || null,
      data.isActive ?? true,
      id,
      agencyId,
    ]
  );
  // Autre langue : écrite seulement si l'appel l'envoie (la bascule
  // actif/inactif du tableau ne l'envoie pas et ne doit rien effacer).
  if (data.translations !== undefined) {
    const [row] = await query(`SELECT content_locale FROM slides WHERE id = ? AND agency_id = ?`, [id, agencyId]);
    await setTranslations("slide", id, data.translations, { baseLocale: row?.content_locale || "ar" }, agencyId);
  }
}

export async function deleteSlide(id) {
  const agencyId = await resolveAgencyId();
  await assertOwned("slides", id, agencyId);
  await query(`DELETE FROM slides WHERE id = ? AND agency_id = ?`, [id, agencyId]);
}

// Échange l'ordre d'affichage avec la diapositive voisine (haut/bas) —
// pas de bibliothèque de drag-and-drop, juste deux UPDATE transactionnels.
export async function moveSlide(id, direction) {
  const agencyId = await resolveAgencyId();
  await assertOwned("slides", id, agencyId);
  const rows = await query(
    `SELECT id, sort_order FROM slides WHERE agency_id = ? ORDER BY sort_order ASC, id ASC`,
    [agencyId]
  );
  const index = rows.findIndex((r) => r.id === Number(id));
  if (index === -1) return;

  const neighborIndex = direction === "up" ? index - 1 : index + 1;
  if (neighborIndex < 0 || neighborIndex >= rows.length) return;

  const current = rows[index];
  const neighbor = rows[neighborIndex];

  await query(`UPDATE slides SET sort_order = ? WHERE id = ? AND agency_id = ?`, [
    neighbor.sort_order,
    current.id,
    agencyId,
  ]);
  await query(`UPDATE slides SET sort_order = ? WHERE id = ? AND agency_id = ?`, [
    current.sort_order,
    neighbor.id,
    agencyId,
  ]);
}
