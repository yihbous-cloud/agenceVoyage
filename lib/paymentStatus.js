import { query } from "./db";
import { resolveAgencyId } from "./agencyContext";

// Règle unique du statut de paiement d'une inscription (CLAUDE.md) : les
// statuts « Payé partiel » / « Payé complet » ne se choisissent pas à la
// main, ils découlent TOUJOURS du montant dû et des versements :
//   - payé net ≥ dû (et > 0)          → paye_complet
//   - 0 < payé net < dû               → paye_partiel
//   - rien de payé, remboursé total   → annule
//   - gratuité totale (dû = 0)        → paye_complet
//   - rien jamais payé                → inscrit/confirme conservé (un
//     « payé » sans aucun versement redevient « inscrit »)
// « Annulé » choisi à la main reste annulé (remboursement éventuellement en
// attente), sauf lors d'un mouvement de paiement (`reactivate`) : un nouveau
// versement sur un dossier annulé le réactive.
const PAID_STATUSES = new Set(["paye_partiel", "paye_complet"]);

export function computePaymentStatus({ totalDue, totalPaid, totalRefunded, current, reactivate = false, free = false }) {
  const due = Number(totalDue) || 0;
  const paid = Number(totalPaid) || 0;
  const refunded = Number(totalRefunded) || 0;

  if (current === "annule" && !reactivate) return "annule";
  if (paid <= 0) {
    if (refunded > 0) return "annule";
    // Gratuité totale (rien à payer) : dossier réglé d'office.
    if (free && due <= 0) return "paye_complet";
    return PAID_STATUSES.has(current) || current === "annule" ? "inscrit" : current;
  }
  return paid >= due ? "paye_complet" : "paye_partiel";
}

// Inscription individuelle ; pour un membre de groupe, c'est le groupe entier
// (montant dû et versements partagés) qui est recalculé.
export async function syncRegistrationPaymentStatus(registrationId, { reactivate = false } = {}) {
  if (!registrationId) return null;
  const agencyId = await resolveAgencyId();
  const [reg] = await query(
    `SELECT r.group_id, r.status, r.total_due, r.discount_type,
            (SELECT COALESCE(SUM(p.amount), 0) FROM payments p
              WHERE p.registration_id = r.id AND p.agency_id = r.agency_id) AS total_paid,
            (SELECT COALESCE(SUM(ABS(p.amount)), 0) FROM payments p
              WHERE p.registration_id = r.id AND p.agency_id = r.agency_id AND p.amount < 0) AS total_refunded
     FROM registrations r
     WHERE r.id = ? AND r.agency_id = ?`,
    [registrationId, agencyId]
  );
  if (!reg) return null;
  if (reg.group_id) return syncGroupPaymentStatus(reg.group_id, { reactivate });

  const next = computePaymentStatus({
    totalDue: reg.total_due,
    totalPaid: reg.total_paid,
    totalRefunded: reg.total_refunded,
    current: reg.status,
    reactivate,
    free: reg.discount_type === "gratuite",
  });
  if (next !== reg.status) {
    await query(`UPDATE registrations SET status = ? WHERE id = ? AND agency_id = ?`, [next, registrationId, agencyId]);
  }
  return next;
}

// Groupe : le statut calculé sur le montant dû/les versements du groupe est
// appliqué à chaque membre actif. Un membre annulé individuellement reste
// annulé (il est exclu du montant dû du groupe) ; un remboursement total du
// groupe annule tous les membres.
export async function syncGroupPaymentStatus(groupId, { reactivate = false } = {}) {
  if (!groupId) return null;
  const agencyId = await resolveAgencyId();
  const [group] = await query(
    `SELECT rg.total_due,
            (SELECT COALESCE(SUM(p.amount), 0) FROM payments p
              WHERE p.group_id = rg.id AND p.agency_id = rg.agency_id) AS total_paid,
            (SELECT COALESCE(SUM(ABS(p.amount)), 0) FROM payments p
              WHERE p.group_id = rg.id AND p.agency_id = rg.agency_id AND p.amount < 0) AS total_refunded
     FROM registration_groups rg
     WHERE rg.id = ? AND rg.agency_id = ?`,
    [groupId, agencyId]
  );
  if (!group) return null;

  const members = await query(`SELECT id, status, discount_type FROM registrations WHERE group_id = ? AND agency_id = ?`, [
    groupId,
    agencyId,
  ]);
  const active = members.filter((m) => m.status !== "annule");
  const groupStatus = computePaymentStatus({
    totalDue: group.total_due,
    totalPaid: group.total_paid,
    totalRefunded: group.total_refunded,
    current: active[0]?.status ?? "inscrit",
    reactivate: true,
    free: active.length > 0 && active.every((m) => m.discount_type === "gratuite"),
  });

  for (const m of members) {
    let next;
    if (m.status === "annule") next = "annule";
    else if (groupStatus === "inscrit" || groupStatus === "confirme") {
      // Rien de payé : on ne garde que les statuts non financiers de chaque membre.
      next = PAID_STATUSES.has(m.status) ? "inscrit" : m.status;
    } else next = groupStatus;
    if (next !== m.status) {
      await query(`UPDATE registrations SET status = ? WHERE id = ? AND agency_id = ?`, [next, m.id, agencyId]);
    }
  }
  return groupStatus;
}

// Remet en conformité toutes les inscriptions de l'agence (rattrapage).
export async function syncAllPaymentStatuses() {
  const agencyId = await resolveAgencyId();
  const regs = await query(`SELECT id FROM registrations WHERE group_id IS NULL AND agency_id = ?`, [agencyId]);
  for (const r of regs) await syncRegistrationPaymentStatus(r.id);
  const groups = await query(`SELECT id FROM registration_groups WHERE agency_id = ?`, [agencyId]);
  for (const g of groups) await syncGroupPaymentStatus(g.id);
}
