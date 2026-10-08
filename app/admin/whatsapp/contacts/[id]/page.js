import Link from "next/link";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissions";
import { getContactDetail } from "@/lib/whatsapp/contacts";
import { listActiveStaff } from "@/lib/whatsapp/team";
import PageHeader from "../../../_components/PageHeader";
import Icon from "../../../_components/Icon";
import { STAGES, CONVERSATION_STATUS, formatDateTime } from "../../labels";
import ContactEditor from "./ContactEditor";

export const dynamic = "force-dynamic";

const QUALIF = { type_voyage: "Voyage", mois: "Mois", personnes: "Personnes", chambre: "Chambre", budget: "Budget", ville_depart: "Ville de départ", programme_slug: "Programme" };

// Fiche contact WhatsApp (cahier §8.5).
export default async function ContactPage({ params }) {
  const session = await getSession();
  const canView = await hasPermission(session, "whatsapp.contacts");
  const canData = await hasPermission(session, "whatsapp.data");
  if (!canView && !canData) return <p className="text-sm text-zinc-500">Accès réservé.</p>;
  const { id } = await params;
  let detail;
  try {
    detail = await getContactDetail(Number(id));
  } catch (err) {
    if (err.code === "NOT_FOUND") return <p className="text-sm text-zinc-500">Contact introuvable.</p>;
    throw err;
  }
  const { contact: c, consents, conversations, registrations, media, templates } = detail;
  const staff = await listActiveStaff();
  let qualification = c.qualification;
  if (typeof qualification === "string") {
    try {
      qualification = JSON.parse(qualification);
    } catch {
      qualification = null;
    }
  }

  return (
    <div className="max-w-5xl space-y-5">
      <PageHeader icon="person" title={c.profile_name || `+${c.phone}`} titleTranslate="no" description={`+${c.phone} · ${STAGES[c.stage] || c.stage} · créé le ${formatDateTime(c.created_at)}`}>
        <Link href="/admin/whatsapp/contacts" className="gf-btn-outline">
          <Icon name="arrow_back" size={16} />
          Contacts
        </Link>
      </PageHeader>

      <div className="gf-grid-cards">
        <ContactEditor contact={JSON.parse(JSON.stringify(c))} staff={staff.map((s) => ({ id: s.id, name: s.full_name }))} canEdit={canView} canData={canData} />

        <div className="space-y-5">
          <div className="gf-card p-5 text-sm">
            <div className="gf-card-title mb-3">
              <Icon name="verified" />
              Qualification
            </div>
            {qualification && Object.keys(qualification).length ? (
              <dl className="grid grid-cols-2 gap-x-4 gap-y-1">
                {Object.entries(qualification).map(([k, v]) => (
                  <div key={k} className="contents">
                    <dt className="text-zinc-500">{QUALIF[k] || k}</dt>
                    <dd translate="no">{String(v)}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="text-zinc-500">Pas encore qualifié.</p>
            )}
          </div>

          <div className="gf-card p-5 text-sm">
            <div className="gf-card-title mb-3">
              <Icon name="luggage" />
              Dossiers du CRM
            </div>
            {registrations.length === 0 ? (
              <p className="text-zinc-500">Aucun dossier lié.</p>
            ) : (
              <ul className="space-y-1">
                {registrations.map((r) => (
                  <li key={r.id}>
                    <Link href={r.group_id ? `/admin/groupes/${r.group_id}` : `/admin/inscriptions/${r.id}`} translate="no">
                      {r.program_title}
                    </Link>
                    <span className="text-zinc-500">{` — ${r.status}, départ ${r.departure_date || "—"}`}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      <div className="gf-grid-cards">
        <div className="gf-card overflow-hidden">
          <div className="gf-card-head gf-divided">
            <div className="gf-card-title">
              <Icon name="forum" />
              Conversations
            </div>
          </div>
          <table className="gf-table w-full">
            <tbody>
              {conversations.map((v) => (
                <tr key={v.id}>
                  <td>
                    <Link href={`/admin/whatsapp/conversations/${v.id}`}>{`#${v.id}`}</Link>
                  </td>
                  <td>{CONVERSATION_STATUS[v.status]?.label || v.status}</td>
                  <td>{formatDateTime(v.opened_at)}</td>
                </tr>
              ))}
              {conversations.length === 0 && (
                <tr>
                  <td className="text-zinc-500">Aucune conversation.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="gf-card overflow-hidden">
          <div className="gf-card-head gf-divided">
            <div className="gf-card-title">
              <Icon name="history" />
              Historique du consentement marketing
            </div>
          </div>
          <table className="gf-table w-full">
            <tbody>
              {consents.map((k, i) => (
                <tr key={i}>
                  <td>{k.action === "accord" ? "Accord" : "Retrait"}</td>
                  <td translate="no">{k.source || "—"}</td>
                  <td className="text-xs" translate="no">{k.text_shown || ""}</td>
                  <td>{formatDateTime(k.created_at)}</td>
                </tr>
              ))}
              {consents.length === 0 && (
                <tr>
                  <td className="text-zinc-500">Aucun consentement enregistré.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="gf-grid-cards">
        <div className="gf-card overflow-hidden">
          <div className="gf-card-head gf-divided">
            <div className="gf-card-title">
              <Icon name="description" />
              Templates reçus
            </div>
          </div>
          <table className="gf-table w-full">
            <tbody>
              {templates.map((t, i) => (
                <tr key={i}>
                  <td className="font-mono text-xs" translate="no">{t.name || "—"}</td>
                  <td translate="no">{t.campaign_name || ""}</td>
                  <td>{t.status}</td>
                  <td>{formatDateTime(t.created_at)}</td>
                </tr>
              ))}
              {templates.length === 0 && (
                <tr>
                  <td className="text-zinc-500">Aucun template envoyé.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="gf-card overflow-hidden">
          <div className="gf-card-head gf-divided">
            <div className="gf-card-title">
              <Icon name="inventory_2" />
              Médias reçus
            </div>
          </div>
          <table className="gf-table w-full">
            <tbody>
              {media.map((m) => (
                <tr key={m.id}>
                  <td>{m.doc_type || m.kind}</td>
                  <td>{formatDateTime(m.created_at)}</td>
                  <td>{m.purge_at ? "supprimé (conservation)" : m.validated_at ? "validé" : ""}</td>
                </tr>
              ))}
              {media.length === 0 && (
                <tr>
                  <td className="text-zinc-500">Aucun média.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
