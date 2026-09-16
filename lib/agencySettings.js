import { query } from "./db";

export async function getAgencySettings() {
  const rows = await query(`SELECT * FROM agency_settings WHERE id = 1 LIMIT 1`);
  return rows[0] || null;
}

export async function updateAgencySettings(data) {
  await query(
    `UPDATE agency_settings SET
       name = ?, logo_url = ?, address = ?, city = ?, phone = ?, whatsapp = ?, email = ?,
       website = ?, rc = ?, tax_id = ?, ice = ?, footer_note = ?
     WHERE id = 1`,
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
    ]
  );
  return getAgencySettings();
}
