import Link from "next/link";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissions";
import { listContacts } from "@/lib/whatsapp/contacts";
import PageHeader from "../../_components/PageHeader";
import Icon from "../../_components/Icon";
import { STAGES, formatDateTime } from "../labels";
import ContactsToolbar from "./ContactsToolbar";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;
const LANGUAGES = { darija_latin: "Darija (latin)", darija_arabe: "Darija (arabe)", ar: "Arabe", fr: "Français", en: "Anglais" };

// Contacts et prospects WhatsApp (cahier §8.5).
export default async function ContactsPage({ searchParams }) {
  const session = await getSession();
  if (!(await hasPermission(session, "whatsapp.contacts"))) return <p className="text-sm text-zinc-500">Accès réservé.</p>;
  const params = await searchParams;
  const filters = Object.fromEntries(["q", "stage", "source", "language", "consent", "blocked"].map((k) => [k, params?.[k] || undefined]));
  const page = Math.max(1, Number(params?.page) || 1);
  const { total, rows, sources } = await listContacts(filters, { limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE });
  const query = new URLSearchParams(Object.entries(filters).filter(([, v]) => v));
  const pageHref = (p) => `/admin/whatsapp/contacts?${new URLSearchParams({ ...Object.fromEntries(query), page: String(p) })}`;

  return (
    <div className="space-y-5">
      <PageHeader icon="contacts" title="Contacts WhatsApp" description="Prospects et clients ayant écrit à l'agence ou importés avec leur consentement.">
        <ContactsToolbar exportHref={`/api/admin/whatsapp/contacts?${query}&format=csv`} />
      </PageHeader>

      <form className="gf-card flex flex-wrap items-end gap-2 p-4" method="get">
        <input name="q" defaultValue={filters.q || ""} placeholder="Nom ou numéro" className="rounded-md border px-3 py-2 text-sm" />
        <select name="stage" defaultValue={filters.stage || ""} className="rounded-md border px-2 py-2 text-sm">
          <option value="">Toutes les étapes</option>
          {Object.entries(STAGES).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <select name="source" defaultValue={filters.source || ""} className="rounded-md border px-2 py-2 text-sm">
          <option value="">Toutes les sources</option>
          {sources.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select name="language" defaultValue={filters.language || ""} className="rounded-md border px-2 py-2 text-sm">
          <option value="">Toutes les langues</option>
          {Object.entries(LANGUAGES).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <select name="consent" defaultValue={filters.consent || ""} className="rounded-md border px-2 py-2 text-sm">
          <option value="">Consentement : tous</option>
          <option value="oui">Consentement marketing</option>
          <option value="non">Sans consentement</option>
        </select>
        <button type="submit" className="gf-btn-outline">
          <Icon name="search" size={16} />
          Filtrer
        </button>
      </form>

      <div className="gf-card overflow-hidden">
        {rows.length === 0 ? (
          <div className="gf-empty">Aucun contact.</div>
        ) : (
          <table className="gf-table w-full">
            <thead>
              <tr>
                <th>Contact</th>
                <th>Étape</th>
                <th>Langue</th>
                <th>Source</th>
                <th>Marketing</th>
                <th>Conseiller</th>
                <th>Dernier message</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id}>
                  <td>
                    <Link href={`/admin/whatsapp/contacts/${c.id}`} translate="no">
                      {c.profile_name || `+${c.phone}`}
                    </Link>
                    <div className="gf-phone text-xs text-zinc-500" translate="no" dir="ltr">{`+${c.phone}`}</div>
                  </td>
                  <td>
                    {STAGES[c.stage] || c.stage}
                    {Boolean(c.blocked) && <span className="gf-chip ms-1" style={{ color: "var(--gf-danger)" }}>bloqué</span>}
                  </td>
                  <td>{LANGUAGES[c.language] || "—"}</td>
                  <td translate="no">{c.source || "—"}</td>
                  <td>{c.marketing_opt_in ? <Icon name="check_circle" size={18} className="text-emerald-600" /> : "—"}</td>
                  <td translate="no">{c.advisor_name || "—"}</td>
                  <td>{c.last_inbound_at ? formatDateTime(c.last_inbound_at) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <div className="flex items-center justify-between text-sm text-zinc-600">
        <span>{`${total} contact(s)`}</span>
        <div className="flex gap-2">
          {page > 1 && (
            <Link href={pageHref(page - 1)} className="gf-btn-outline">
              Précédent
            </Link>
          )}
          {page * PAGE_SIZE < total && (
            <Link href={pageHref(page + 1)} className="gf-btn-outline">
              Suivant
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
