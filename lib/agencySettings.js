import { query } from "./db";
import { resolveAgencyId } from "./agencyContext";

// Multi-agences (CLAUDE.md §3sexvicies, passe 2) : les paramètres d'une agence
// vivent dans la table `agencies` (la table agency_settings, ligne unique,
// est dépréciée — conservée en base pour l'historique, plus lue ni écrite).
// `explicitAgencyId` : pages publiques statiques (l'agence vient du segment
// d'URL [agency]) ; sinon l'agence de la requête courante.
export async function getAgencySettings(explicitAgencyId) {
  const agencyId = await resolveAgencyId(explicitAgencyId);
  const rows = await query(`SELECT * FROM agencies WHERE id = ? LIMIT 1`, [agencyId]);
  const settings = rows[0] || null;
  if (!settings) return null;
  settings.social_links = await listAgencySocialLinks(agencyId);
  return settings;
}

export async function updateAgencySettings(data) {
  const agencyId = await resolveAgencyId();
  await query(
    `UPDATE agencies SET
       name = ?, logo_url = ?, address = ?, city = ?, phone = ?, whatsapp = ?, email = ?,
       website = ?, rc = ?, tax_id = ?, ice = ?, footer_note = ?
     WHERE id = ?`,
    [
      data.name,
      data.logoUrl || null,
      data.address || null,
      data.city || null,
      data.phone || null,
      data.whatsapp || null,
      data.email || null,
      data.website || null,
      data.rc || null,
      data.taxId || null,
      data.ice || null,
      data.footerNote || null,
      agencyId,
    ]
  );
  return getAgencySettings(agencyId);
}

// Réseaux sociaux — liste extensible (n'importe quelle plateforme en texte
// libre, pas seulement un jeu figé de colonnes), affichée dans le footer
// public et éditable depuis /admin/parametres. Voir CLAUDE.md.
export async function listAgencySocialLinks(explicitAgencyId) {
  const agencyId = await resolveAgencyId(explicitAgencyId);
  return query(
    `SELECT id, platform, url FROM agency_social_links
     WHERE agency_id = ?
     ORDER BY sort_order ASC, id ASC`,
    [agencyId]
  );
}

// Remplacement complet (purge + réinsertion) — même pattern que
// setRolePermissions/setDefaultHotelsForProgram : la liste entière est
// renvoyée à chaque enregistrement du formulaire, pas de diff ligne à ligne.
export async function setAgencySocialLinks(links) {
  const agencyId = await resolveAgencyId();
  await query(`DELETE FROM agency_social_links WHERE agency_id = ?`, [agencyId]);

  const entries = (links || []).filter((l) => l.platform?.trim() && l.url?.trim());
  for (let i = 0; i < entries.length; i++) {
    await query(
      `INSERT INTO agency_social_links (agency_id, platform, url, sort_order) VALUES (?, ?, ?, ?)`,
      [agencyId, entries[i].platform.trim(), entries[i].url.trim(), i]
    );
  }

  return listAgencySocialLinks(agencyId);
}
