import { query } from "../db";
import { getAgencySettings } from "../agencySettings";
import { getCityByIata } from "../airports";

// Champs CRM disponibles pour les variables des templates (TP-05) et des
// déclencheurs : une variable {{n}} d'un template est associée à l'un de ces
// champs ; la valeur est calculée au moment de l'envoi, pour LE destinataire.
// Ajouter un champ = une entrée ici + sa valeur dans buildCrmContext().

export const CRM_FIELDS = [
  { key: "contact.prenom", label: "Prénom du client", example: "Fatima" },
  { key: "contact.nom_complet", label: "Nom complet du client", example: "Fatima Zahra Alaoui" },
  { key: "programme.titre", label: "Titre du programme", example: "Omra Ramadan 2027" },
  { key: "voyage.date_depart", label: "Date de départ", example: "12/03/2027" },
  { key: "voyage.date_retour", label: "Date de retour", example: "26/03/2027" },
  { key: "voyage.ville_depart", label: "Ville de départ", example: "Casablanca" },
  { key: "voyage.compagnie", label: "Compagnie aérienne", example: "Saudia" },
  { key: "voyage.pnr", label: "Référence de réservation (PNR)", example: "AB12CD" },
  { key: "voyage.jours_avant_depart", label: "Nombre de jours avant le départ", example: "7" },
  { key: "inscription.reference", label: "Numéro de dossier", example: "GF-1024" },
  { key: "inscription.montant_du", label: "Montant total dû", example: "31 400 MAD" },
  { key: "inscription.montant_paye", label: "Montant déjà payé", example: "15 000 MAD" },
  { key: "inscription.solde", label: "Reste à payer", example: "16 400 MAD" },
  { key: "inscription.documents_manquants", label: "Documents manquants", example: "passeport, date d'expiration du passeport" },
  { key: "visa.statut", label: "Statut du visa", example: "en cours" },
  { key: "hebergement.hotels", label: "Hôtels (par ville)", example: "Makka : Anjoum ; Madina : Markazia" },
  { key: "paiement.montant", label: "Montant du paiement reçu", example: "5 000 MAD" },
  { key: "paiement.date", label: "Date du paiement reçu", example: "08/10/2026" },
  { key: "paiement.lien", label: "Lien de paiement en ligne", example: "https://…" },
  { key: "agence.nom", label: "Nom de l'agence", example: "Golden Fantastic" },
  { key: "agence.telephone", label: "Téléphone de l'agence", example: "05 22 00 00 00" },
  { key: "agence.adresse", label: "Adresse de l'agence", example: "12 bd Zerktouni, Casablanca" },
  { key: "texte.libre", label: "Texte saisi au moment de l'envoi", example: "…" },
];

const VISA_LABELS = { non_demande: "non demandé", en_cours: "en cours", accorde: "accordé", refuse: "refusé" };

export function formatMoney(value, currency = "MAD") {
  return `${Number(value || 0).toLocaleString("fr-FR", { maximumFractionDigits: 2 }).replace(/[  ]/g, " ")} ${currency}`;
}

export function formatDate(value) {
  if (!value) return "";
  const [y, m, d] = String(value).slice(0, 10).split("-");
  return d && m && y ? `${d}/${m}/${y}` : String(value);
}

function daysUntil(date) {
  if (!date) return "";
  const target = new Date(`${String(date).slice(0, 10)}T00:00:00Z`);
  const today = new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00Z`);
  return String(Math.round((target - today) / 86400000));
}

// Valeurs de tous les champs pour un destinataire. `registrationId` et/ou
// `contactId` ; `extra` complète ou remplace (montant d'un paiement, lien,
// texte libre...). Agence toujours explicite.
export async function buildCrmContext(agencyId, { registrationId = null, contactId = null, extra = {} } = {}) {
  const values = {};
  const agency = await getAgencySettings(agencyId);
  values["agence.nom"] = agency?.name || "";
  values["agence.telephone"] = agency?.phone || "";
  values["agence.adresse"] = [agency?.address, agency?.city].filter(Boolean).join(", ");

  if (contactId) {
    const [contact] = await query(`SELECT profile_name FROM wa_contacts WHERE id = ? AND agency_id = ?`, [contactId, agencyId]);
    if (contact?.profile_name) {
      values["contact.nom_complet"] = contact.profile_name;
      values["contact.prenom"] = contact.profile_name.split(/\s+/)[0];
    }
  }

  if (registrationId) {
    const [r] = await query(
      `SELECT r.id, r.total_due, r.visa_status, r.group_id, rg.total_due AS group_total_due,
         tr.full_name, tr.passport_number, tr.passport_expiry_date, tr.phone_whatsapp,
         t.departure_date, t.return_date, t.origin_iata, t.pnr, a.name AS airline_name, p.title AS program_title
       FROM registrations r
       JOIN travelers tr ON tr.id = r.traveler_id AND tr.agency_id = r.agency_id
       JOIN trips t ON t.id = r.trip_id AND t.agency_id = r.agency_id
       JOIN programs p ON p.id = t.program_id AND p.agency_id = r.agency_id
       LEFT JOIN airlines a ON a.id = t.airline_id AND a.agency_id = r.agency_id
       LEFT JOIN registration_groups rg ON rg.id = r.group_id AND rg.agency_id = r.agency_id
       WHERE r.id = ? AND r.agency_id = ?`,
      [registrationId, agencyId]
    );
    if (r) {
      const [paid] = r.group_id
        ? await query(`SELECT COALESCE(SUM(amount), 0) AS paid FROM payments WHERE group_id = ? AND agency_id = ?`, [r.group_id, agencyId])
        : await query(`SELECT COALESCE(SUM(amount), 0) AS paid FROM payments WHERE registration_id = ? AND agency_id = ?`, [r.id, agencyId]);
      const due = Number(r.group_id ? r.group_total_due : r.total_due) || 0;
      // Dernier versement (positif) : variables « paiement reçu ».
      const [lastPayment] = r.group_id
        ? await query(`SELECT amount, payment_date FROM payments WHERE group_id = ? AND agency_id = ? AND amount > 0 ORDER BY id DESC LIMIT 1`, [r.group_id, agencyId])
        : await query(`SELECT amount, payment_date FROM payments WHERE registration_id = ? AND agency_id = ? AND amount > 0 ORDER BY id DESC LIMIT 1`, [r.id, agencyId]);
      if (lastPayment) {
        values["paiement.montant"] = formatMoney(lastPayment.amount);
        values["paiement.date"] = formatDate(lastPayment.payment_date);
      }
      const missing = [];
      if (!r.passport_number) missing.push("passeport");
      if (!r.passport_expiry_date) missing.push("date d'expiration du passeport");
      const hotels = await query(
        `SELECT rra.city, h.name FROM registration_room_assignments rra
         JOIN rooms rm ON rm.id = rra.room_id AND rm.agency_id = rra.agency_id
         JOIN trip_hotels th ON th.id = rm.trip_hotel_id AND th.agency_id = rra.agency_id
         JOIN hotels h ON h.id = th.hotel_id AND h.agency_id = rra.agency_id
         WHERE rra.registration_id = ? AND rra.agency_id = ?`,
        [r.id, agencyId]
      );
      Object.assign(values, {
        "contact.nom_complet": r.full_name,
        "contact.prenom": String(r.full_name || "").split(/\s+/)[0],
        "programme.titre": r.program_title,
        "voyage.date_depart": formatDate(r.departure_date),
        "voyage.date_retour": formatDate(r.return_date),
        "voyage.ville_depart": getCityByIata(r.origin_iata)?.city || r.origin_iata || "",
        "voyage.compagnie": r.airline_name || "",
        "voyage.pnr": r.pnr || "",
        "voyage.jours_avant_depart": daysUntil(r.departure_date),
        "inscription.reference": `GF-${r.id}`,
        "inscription.montant_du": formatMoney(due),
        "inscription.montant_paye": formatMoney(paid?.paid || 0),
        "inscription.solde": formatMoney(Math.max(0, due - Number(paid?.paid || 0))),
        "inscription.documents_manquants": missing.join(", ") || "aucun",
        "visa.statut": VISA_LABELS[r.visa_status] || r.visa_status || "",
        "hebergement.hotels": hotels.map((h) => `${h.city} : ${h.name}`).join(" ; "),
      });
    }
  }
  return { ...values, ...extra };
}

// Exemple d'affichage d'un champ (aperçu et exemples exigés par Meta).
export function exampleFor(key) {
  return CRM_FIELDS.find((f) => f.key === key)?.example || "…";
}
