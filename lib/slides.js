import { query } from "./db";

// Lien public dérivé dynamiquement d'un programme (mêmes règles que
// HomeShowcaseCard.jsx) — jamais figé, reste correct si le slug change.
function resolveHref(slide) {
  if (slide.program_id) {
    return slide.program_family === "omra_hajj"
      ? `/omra-hajj/${slide.program_slug}`
      : `/voyages-organises/${slide.program_slug}`;
  }
  return slide.button_link || "#";
}

const SELECT_WITH_PROGRAM = `
  SELECT s.*, p.title AS program_title, p.slug AS program_slug, p.family AS program_family
  FROM slides s
  LEFT JOIN programs p ON p.id = s.program_id
`;

export async function listActiveSlides() {
  const rows = await query(
    `${SELECT_WITH_PROGRAM} WHERE s.is_active = TRUE ORDER BY s.sort_order ASC, s.id ASC`
  );
  return rows.map((s) => ({ ...s, href: resolveHref(s) }));
}

export async function listAllSlides() {
  const rows = await query(`${SELECT_WITH_PROGRAM} ORDER BY s.sort_order ASC, s.id ASC`);
  return rows.map((s) => ({ ...s, href: resolveHref(s) }));
}

export async function createSlide(data) {
  const [{ maxOrder }] = await query(
    `SELECT COALESCE(MAX(sort_order), -1) + 1 AS maxOrder FROM slides`
  );
  const result = await query(
    `INSERT INTO slides (title, subtitle, image_url, mobile_image_url, button_text, program_id, button_link, sort_order, is_active)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      data.title,
      data.subtitle || null,
      data.imageUrl || null,
      data.mobileImageUrl || null,
      data.buttonText || "Découvrir",
      data.programId || null,
      data.programId ? null : data.buttonLink || null,
      maxOrder,
      data.isActive ?? true,
    ]
  );
  return result.insertId;
}

export async function updateSlide(id, data) {
  await query(
    `UPDATE slides SET title = ?, subtitle = ?, image_url = ?, mobile_image_url = ?, button_text = ?, program_id = ?, button_link = ?, is_active = ?
     WHERE id = ?`,
    [
      data.title,
      data.subtitle || null,
      data.imageUrl || null,
      data.mobileImageUrl || null,
      data.buttonText || "Découvrir",
      data.programId || null,
      data.programId ? null : data.buttonLink || null,
      data.isActive ?? true,
      id,
    ]
  );
}

export async function deleteSlide(id) {
  await query(`DELETE FROM slides WHERE id = ?`, [id]);
}

// Échange l'ordre d'affichage avec la diapositive voisine (haut/bas) —
// pas de bibliothèque de drag-and-drop, juste deux UPDATE transactionnels.
export async function moveSlide(id, direction) {
  const rows = await query(`SELECT id, sort_order FROM slides ORDER BY sort_order ASC, id ASC`);
  const index = rows.findIndex((r) => r.id === Number(id));
  if (index === -1) return;

  const neighborIndex = direction === "up" ? index - 1 : index + 1;
  if (neighborIndex < 0 || neighborIndex >= rows.length) return;

  const current = rows[index];
  const neighbor = rows[neighborIndex];

  await query(`UPDATE slides SET sort_order = ? WHERE id = ?`, [neighbor.sort_order, current.id]);
  await query(`UPDATE slides SET sort_order = ? WHERE id = ?`, [current.sort_order, neighbor.id]);
}
