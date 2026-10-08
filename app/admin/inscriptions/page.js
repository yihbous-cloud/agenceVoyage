import Link from "next/link";
import { listRegistrations } from "@/lib/registrations";
import SearchBar from "./SearchBar";
import { getAdminLocale, displayTravelerName } from "@/lib/adminLocale";
import { INTL_TAGS } from "@/lib/i18n/locales";
import Icon from "../_components/Icon";
import PageHeader from "../_components/PageHeader";
import { AccordionGroup, AccordionItem } from "./ProgramAccordion";
import { listOutstandingCredits } from "@/lib/credits";
import { isTripArchived } from "@/lib/tripArchive";
import { DISCOUNT_REASON_LABELS } from "@/lib/roomTypes";

const STATUS_LABELS = {
  inscrit: "Inscrit",
  confirme: "Confirmé",
  paye_partiel: "Payé partiel",
  paye_complet: "Payé complet",
  annule: "Annulé",
};

// Pastilles de statut (charte designadmin.md) : [fond, texte].
const STATUS_PILLS = {
  inscrit: ["#e8f0fd", "#2b5cc4"],
  confirme: ["#efe9fb", "#6b3fc4"],
  paye_partiel: ["#fff4e0", "#a35a00"],
  paye_complet: ["#e6f4ee", "#0f6b4b"],
  annule: ["#fdecec", "#c4373b"],
};

const VISA_DISPLAY = {
  non_demande: { label: "Non demandé", icon: "schedule", color: "#a0a0a6" },
  en_cours: { label: "En cours", icon: "hourglass_top", color: "#f5a524" },
  accorde: { label: "Accordé", icon: "verified", color: "var(--gf-accent)" },
  refuse: { label: "Refusé", icon: "block", color: "#e5484d" },
};

// Couleurs d'avatar (initiales), attribuées par position.
const AVATARS = [
  ["#e6f4ee", "#0f6b4b"],
  ["#efe9fb", "#6b3fc4"],
  ["#fdf0e1", "#a35a00"],
  ["#e8f0fd", "#2b5cc4"],
  ["#fde9ef", "#b4325a"],
];

const FILTERS = [
  ["", "Tous"],
  ["inscrit", "Inscrit"],
  ["confirme", "Confirmé"],
  ["paye_partiel", "Payé partiel"],
  ["paye_complet", "Payé complet"],
  ["annule", "Annulé"],
];

function initialsOf(name) {
  return (name || "")
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function filterHref({ tripId, q, status, view }) {
  const params = new URLSearchParams();
  if (view === "archives") params.set("view", "archives");
  if (tripId) params.set("tripId", tripId);
  if (q) params.set("q", q);
  if (status) params.set("status", status);
  const qs = params.toString();
  return qs ? `/admin/inscriptions?${qs}` : "/admin/inscriptions";
}

export default async function InscriptionsPage({ searchParams }) {
  const params = await searchParams;
  const tripId = params?.tripId || undefined;
  const status = params?.status || undefined;
  const q = params?.q || undefined;
  // Deux vues séparées : voyages EN COURS (par défaut) et voyages CLÔTURÉS
  // (archives, lib/tripArchive.js). Un voyage filtré (?tripId=) s'affiche
  // quel que soit son état, dans la vue qui lui correspond.
  const view = params?.view === "archives" ? "archives" : "current";
  const archivedFilter = tripId ? undefined : view === "archives";

  const locale = await getAdminLocale();
  // Une seule requête (sans filtre de statut) : sert aux compteurs du filtre
  // segmenté ET, filtrée ici, à la liste affichée.
  const [allRegistrations, archiveCredits, currentCount, archivedCount] = await Promise.all([
    listRegistrations({ tripId, q, archived: archivedFilter }),
    view === "archives" ? listOutstandingCredits({ archived: true }) : Promise.resolve([]),
    listRegistrations({ archived: false }).then((r) => r.length),
    listRegistrations({ archived: true }).then((r) => r.length),
  ]);
  const creditsTotal = archiveCredits.reduce((sum, c) => sum + c.balance, 0);
  const registrations = status ? allRegistrations.filter((r) => r.status === status) : allRegistrations;
  const countFor = (key) => (key ? allRegistrations.filter((r) => r.status === key).length : allRegistrations.length);

  // Regroupement par voyage (donc par programme) — la requête est déjà triée
  // par programme puis date de départ.
  const tripSections = [];
  for (const reg of registrations) {
    let section = tripSections[tripSections.length - 1];
    if (!section || section.tripId !== reg.trip_id) {
      section = {
        tripId: reg.trip_id,
        programTitle: reg.program_title,
        departureDate: reg.departure_date,
        archived: isTripArchived({ status: reg.trip_status, return_date: reg.return_date, departure_date: reg.departure_date }),
        rows: [],
      };
      tripSections.push(section);
    }
    section.rows.push(reg);
  }

  // Toutes les sections sont fermées à l'ouverture de la page ; seule exception :
  // un lien qui cible un voyage précis (?tripId=, ex. depuis le tableau de bord)
  // ouvre directement ce voyage.
  const defaultOpenTripId =
    (tripId && tripSections.find((sec) => String(sec.tripId) === String(tripId))?.tripId) || null;
  const countIn = (section, key) => section.rows.filter((r) => r.status === key).length;
  const pillOf = (key) => ({ bg: STATUS_PILLS[key][0], fg: STATUS_PILLS[key][1] });

  return (
    <div className="flex flex-col gap-[22px]">
      <PageHeader icon="group" title="Inscrits" description="Voyageurs inscrits, regroupés par départ.">
        <Link href="/admin/inscriptions/new" className="gf-btn-primary">
          <Icon name="add" size={19} />
          Nouvelle inscription
        </Link>
      </PageHeader>

      {/* En cours / Archives : les inscrits des programmes clôturés sont séparés */}
      <div className="gf-segmented self-start">
        <Link href="/admin/inscriptions" data-active={view === "current"} scroll={false}>
          <Icon name="group" size={16} />
          En cours
          <span className="gf-count">{currentCount}</span>
        </Link>
        <Link href="/admin/inscriptions?view=archives" data-active={view === "archives"} scroll={false}>
          <Icon name="inventory_2" size={16} />
          Archives (programmes clôturés)
          <span className="gf-count">{archivedCount}</span>
        </Link>
      </div>

      {view === "archives" && (
        <section className="gf-card overflow-hidden" style={{ borderColor: archiveCredits.length ? "#f7cfd0" : undefined }}>
          <div className="gf-card-head gf-divided">
            <div className="gf-card-title">
              <Icon name="account_balance_wallet" style={{ color: "#c4373b" }} />
              Crédits en cours — programmes clôturés
            </div>
            <span className="gf-pill" style={{ background: creditsTotal > 0 ? "#fdecec" : "#e6f4ee", color: creditsTotal > 0 ? "#c4373b" : "#0f6b4b" }}>
              {`${formatAmount(creditsTotal)} MAD`}
            </span>
          </div>
          {archiveCredits.length === 0 ? (
            <div className="gf-empty" style={{ padding: "24px 12px" }}>
              <Icon name="check_circle" />
              Aucun crédit en cours : tous les voyageurs des programmes clôturés ont soldé.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="gf-table" style={{ minWidth: 820 }}>
                <thead>
                  <tr>
                    <th>Débiteur</th>
                    <th>Programme</th>
                    <th>N° WhatsApp</th>
                    <th style={{ textAlign: "end" }}>Dû</th>
                    <th style={{ textAlign: "end" }}>Payé</th>
                    <th style={{ textAlign: "end" }}>Reste dû</th>
                    <th>Dernier versement</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {archiveCredits.map((c) => {
                    const href = c.kind === "groupe" ? `/admin/groupes/${c.id}` : `/admin/inscriptions/${c.id}`;
                    return (
                      <tr key={`${c.kind}-${c.id}`}>
                        <td>
                          <span style={{ fontWeight: 500 }} translate="no">
                            {c.kind === "individuel" ? displayTravelerName({ full_name: c.name, full_name_arabic: c.name_arabic }, locale) : c.name}
                          </span>
                          {c.kind === "groupe" && <span className="gf-chip ms-2">Groupe</span>}
                        </td>
                        <td>
                          <span translate="no">{c.program_title}</span>
                          <div style={{ fontSize: 12, color: "var(--gf-subtle)" }}>
                            {new Date(c.departure_date).toLocaleDateString(INTL_TAGS[locale] || "fr-FR")}
                          </div>
                        </td>
                        <td className="gf-phone" translate="no">
                          {c.phone_whatsapp || "—"}
                        </td>
                        <td style={{ textAlign: "end", whiteSpace: "nowrap" }}>{formatAmount(c.total_due)} MAD</td>
                        <td style={{ textAlign: "end", whiteSpace: "nowrap", color: "var(--gf-accent)" }}>
                          {formatAmount(c.total_paid)} MAD
                        </td>
                        <td style={{ textAlign: "end", whiteSpace: "nowrap", fontWeight: 600, color: "#c4373b" }}>
                          {formatAmount(c.balance)} MAD
                        </td>
                        <td style={{ whiteSpace: "nowrap", color: "var(--gf-muted)" }}>
                          {c.last_payment_date
                            ? new Date(c.last_payment_date).toLocaleDateString(INTL_TAGS[locale] || "fr-FR")
                            : "—"}
                        </td>
                        <td className="gf-actions">
                          <Link href={href} title="Afficher" className="gf-btn-icon">
                            <Icon name="visibility" size={18} />
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      <div className="flex flex-wrap items-center gap-2.5">
        <SearchBar initialQuery={q} />
        <div className="gf-segmented">
          {FILTERS.map(([key, label]) => (
            <Link
              key={key || "all"}
              href={filterHref({ tripId, q, status: key, view })}
              data-active={(status || "") === key}
              scroll={false}
            >
              {label}
              <span className="gf-count">{countFor(key)}</span>
            </Link>
          ))}
        </div>
      </div>

      {(tripId || status || q) && (
        <p className="text-sm text-zinc-500">
          {q && <>Recherche : &laquo; {q} &raquo;</>}
          {q && (tripId || status) && " · "}
          {tripId && <>Filtré par voyage #{tripId}</>}
          {tripId && status && " · "}
          {status && (
            <>
              Filtré par statut :{" "}
              <span className="font-medium text-zinc-700">
                {STATUS_LABELS[status] || status}
              </span>
            </>
          )}
          {" — "}
          <Link href={filterHref({ view })} className="text-emerald-700 hover:underline">
            réinitialiser
          </Link>
          {tripId && (
            <>
              {" · "}
              <Link
                href={`/admin/voyages/${tripId}/hebergement`}
                className="text-emerald-700 hover:underline"
              >
                gérer l&apos;hébergement
              </Link>
              {" · "}
              <Link
                href={`/admin/voyages/${tripId}/listes`}
                className="text-emerald-700 hover:underline"
              >
                listes
              </Link>
              {" · "}
              <Link
                href={`/admin/voyages/${tripId}/billets`}
                className="text-emerald-700 hover:underline"
              >
                billets d&apos;avion
              </Link>
            </>
          )}
        </p>
      )}

      {registrations.length === 0 && (
        <div className="gf-card">
          <div className="gf-empty">
            <Icon name="inbox" />
            Aucune inscription.
          </div>
        </div>
      )}

      {/* Un tableau par programme/voyage : nom du programme en haut à gauche,
          puis le détail des inscrits numérotés. */}
      {tripSections.length > 0 && (
        // key : un changement de filtre/recherche réinitialise la section ouverte.
        <AccordionGroup key={`${tripId || ""}|${status || ""}|${q || ""}`} defaultOpenId={defaultOpenTripId}>
      {tripSections.map((section) => (
        <AccordionItem
          key={section.tripId}
          id={section.tripId}
          title={section.programTitle}
          date={new Date(section.departureDate).toLocaleDateString(INTL_TAGS[locale] || "fr-FR")}
          count={section.rows.length}
          archived={section.archived}
          stats={[
            { label: "Payé complet", value: countIn(section, "paye_complet"), ...pillOf("paye_complet") },
            { label: "Payé partiel", value: countIn(section, "paye_partiel"), ...pillOf("paye_partiel") },
            // Avantages tarifaires repérables dès l'en-tête du programme.
            {
              label: "Gratuits",
              value: section.rows.filter((r) => r.discount_type === "gratuite").length,
              bg: "#efe9fb",
              fg: "#6b3fc4",
            },
            {
              label: "Réductions",
              value: section.rows.filter((r) => r.discount_type === "montant" || r.discount_type === "pourcentage").length,
              bg: "#fdf0e6",
              fg: "#b4541a",
            },
          ]}
        >
          <div className="overflow-x-auto">
            <table className="gf-table" style={{ minWidth: 820 }}>
              <thead>
                <tr>
                  <th style={{ width: 48 }}>N°</th>
                  <th>Nom Complet</th>
                  <th>N° WhatsApp</th>
                  <th>N° Tél</th>
                  <th>Statut</th>
                  <th>Visa</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {section.rows.map((reg, index) => {
                  const name = displayTravelerName(reg, locale);
                  const [avBg, avFg] = AVATARS[index % AVATARS.length];
                  const [pillBg, pillFg] = STATUS_PILLS[reg.status] || ["#f1f1ee", "#5a5a60"];
                  const visa = VISA_DISPLAY[reg.visa_status];
                  const viewHref = reg.group_id ? `/admin/groupes/${reg.group_id}` : `/admin/inscriptions/${reg.id}`;
                  return (
                    <tr key={reg.id}>
                      <td className="gf-num">{index + 1}</td>
                      <td>
                        <div className="flex items-center gap-2.5">
                          <span className="gf-avatar" style={{ background: avBg, color: avFg }} translate="no">
                            {initialsOf(reg.full_name)}
                          </span>
                          <span style={{ fontWeight: 500 }} translate="no">
                            {name}
                          </span>
                          {reg.group_label && (
                            <Link
                              href={`/admin/groupes/${reg.group_id}`}
                              className="gf-chip"
                              title="Accéder au groupe (montant dû, paiements, tous les membres)"
                            >
                              <span translate="no">{reg.group_label}</span>
                            </Link>
                          )}
                          {reg.discount_type === "gratuite" && (
                            <span
                              className="gf-pill"
                              style={{ background: "#efe9fb", color: "#6b3fc4", gap: 4 }}
                              title={DISCOUNT_REASON_LABELS[reg.discount_reason] || undefined}
                            >
                              <Icon name="redeem" size={14} />
                              Gratuit
                            </span>
                          )}
                          {(reg.discount_type === "montant" || reg.discount_type === "pourcentage") && (
                            <span
                              className="gf-pill"
                              style={{ background: "#fdf0e6", color: "#b4541a", gap: 4 }}
                              title={DISCOUNT_REASON_LABELS[reg.discount_reason] || undefined}
                            >
                              <Icon name="sell" size={14} />
                              <span translate="no" dir="ltr">
                                {reg.discount_type === "pourcentage"
                                  ? `−${Number(reg.discount_value)} %`
                                  : `−${formatAmount(reg.discount_amount)} MAD`}
                              </span>
                            </span>
                          )}
                          {reg.package_type === "vol_seul" && (
                            <span className="gf-pill" style={{ background: "#e8f0fd", color: "#2b5cc4" }}>
                              Vol seul
                            </span>
                          )}
                          {reg.package_type === "hebergement_seul" && (
                            <span className="gf-pill" style={{ background: "#fff4e0", color: "#a35a00" }}>
                              Hébergement seul
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="gf-phone" translate="no">
                        {reg.phone_whatsapp}
                      </td>
                      <td className="gf-phone" style={{ color: "var(--gf-subtle)" }} translate="no">
                        {reg.phone || "—"}
                      </td>
                      <td>
                        <span className="gf-pill" style={{ background: pillBg, color: pillFg }}>
                          {STATUS_LABELS[reg.status] || reg.status}
                        </span>
                      </td>
                      <td>
                        {visa ? (
                          <span className="inline-flex items-center gap-[5px]" style={{ fontSize: 12.5, color: "var(--gf-text-2)" }}>
                            <Icon name={visa.icon} size={16} fill style={{ color: visa.color }} />
                            {visa.label}
                          </span>
                        ) : (
                          reg.visa_status
                        )}
                      </td>
                      <td className="gf-actions">
                        <Link href={viewHref} title="Afficher" className="gf-btn-icon">
                          <Icon name="visibility" size={18} />
                        </Link>
                        <Link href={`${viewHref}?mode=edit`} title="Modifier" className="gf-btn-icon">
                          <Icon name="edit" size={18} />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </AccordionItem>
      ))}
        </AccordionGroup>
      )}
    </div>
  );
}

function formatAmount(value) {
  return Number(value || 0)
    .toLocaleString("fr-FR", { maximumFractionDigits: 2 })
    .replace(/[\u202f\u00a0]/g, " ");
}
