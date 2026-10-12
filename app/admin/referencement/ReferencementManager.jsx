"use client";

import { useState } from "react";
import Icon from "../_components/Icon";
import { useConfirm } from "../_components/useConfirm";

// Origine d'une redirection (colonne redirects.source).
const SOURCE_LABELS = {
  manuel: "Manuelle",
  auto_slug: "Adresse modifiée",
  auto_depublication: "Dépublication",
  auto_suppression: "Suppression",
};

const PING_STATUS = {
  envoye: { label: "Envoyé", tone: "bg-emerald-100 text-emerald-800" },
  echec: { label: "Échec", tone: "bg-red-100 text-red-800" },
  ignore: { label: "Ignoré", tone: "bg-zinc-100 text-zinc-600" },
};

// Date MySQL « AAAA-MM-JJ HH:MM:SS » → « AAAA-MM-JJ HH:MM ».
const shortDate = (value) => (value ? String(value).replace("T", " ").slice(0, 16) : "—");

export default function ReferencementManager({ initialRedirects, pings, baseUrl }) {
  const [tab, setTab] = useState("redirections");
  const [redirects, setRedirects] = useState(initialRedirects);
  const [fromPath, setFromPath] = useState("");
  const [toPath, setToPath] = useState("");
  const [message, setMessage] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [confirm, confirmDialog] = useConfirm();

  async function handleCreate(e) {
    e.preventDefault();
    setMessage(null);
    setSubmitting(true);
    const res = await fetch("/api/admin/redirects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fromPath, toPath }),
    });
    const data = await res.json().catch(() => ({}));
    setSubmitting(false);
    if (!res.ok) {
      setMessage({ ok: false, text: data.message || "Enregistrement impossible" });
      return;
    }
    setRedirects(data);
    setFromPath("");
    setToPath("");
    setMessage({ ok: true, text: "Redirection enregistrée." });
  }

  async function handleDelete(redirect) {
    if (!(await confirm("Supprimer cette redirection ? L'ancienne adresse ne mènera plus nulle part."))) return;
    const res = await fetch(`/api/admin/redirects/${redirect.id}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    if (res.ok) setRedirects(data);
    else setMessage({ ok: false, text: data.message || "Suppression impossible" });
  }

  const tabClass = (name) =>
    `rounded-md px-4 py-2 text-sm font-medium ${
      tab === name ? "bg-emerald-700 text-white" : "bg-white text-zinc-700 hover:bg-zinc-50"
    }`;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        <button type="button" className={tabClass("redirections")} onClick={() => setTab("redirections")}>
          Redirections
        </button>
        <button type="button" className={tabClass("indexation")} onClick={() => setTab("indexation")}>
          Indexation
        </button>
      </div>

      {tab === "redirections" && (
        <div className="space-y-6">
          <form onSubmit={handleCreate} className="gf-card grid gap-3 p-5 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <label className="text-sm">
              Ancienne adresse
              <input
                required
                value={fromPath}
                onChange={(e) => setFromPath(e.target.value)}
                placeholder="/omra/ancien-programme"
                className="mt-1 w-full rounded-md border px-3 py-2 font-mono text-sm"
                dir="ltr"
              />
            </label>
            <label className="text-sm">
              Nouvelle adresse
              <input
                required
                value={toPath}
                onChange={(e) => setToPath(e.target.value)}
                placeholder="/omra/nouveau-programme"
                className="mt-1 w-full rounded-md border px-3 py-2 font-mono text-sm"
                dir="ltr"
              />
            </label>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-60"
            >
              Ajouter
            </button>
            <p className="text-xs text-zinc-500 sm:col-span-3">
              Adresse sans langue (une seule ligne couvre l&apos;arabe, le français et l&apos;anglais), ou adresse complète copiée depuis le navigateur. La nouvelle adresse peut aussi être un autre site (https://...). Les changements d&apos;adresse, dépublications et suppressions de programmes ou d&apos;actualités créent leur redirection automatiquement.
            </p>
          </form>

          {message && (
            <p className={`text-sm ${message.ok ? "text-emerald-700" : "text-red-600"}`}>{message.text}</p>
          )}

          <div className="gf-card overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-start">
                  <th className="px-4 py-3 text-start">Ancienne adresse</th>
                  <th className="px-4 py-3 text-start">Nouvelle adresse</th>
                  <th className="px-4 py-3 text-start">Origine</th>
                  <th className="px-4 py-3 text-end">Utilisations</th>
                  <th className="px-4 py-3 text-start">Dernière utilisation</th>
                  <th className="px-4 py-3 text-start">Créée le</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {redirects.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-6 text-center text-zinc-500">
                      Aucune redirection pour le moment.
                    </td>
                  </tr>
                )}
                {redirects.map((redirect) => (
                  <tr key={redirect.id} className="border-t border-zinc-100">
                    <td className="px-4 py-3 font-mono text-xs" dir="ltr">
                      <span translate="no">{redirect.from_path}</span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs" dir="ltr">
                      <a
                        href={/^https?:\/\//.test(redirect.to_path) ? redirect.to_path : `${baseUrl}${redirect.to_path}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-emerald-700 hover:underline"
                        translate="no"
                      >
                        {redirect.to_path}
                      </a>
                    </td>
                    <td className="px-4 py-3">{SOURCE_LABELS[redirect.source] || redirect.source}</td>
                    <td className="px-4 py-3 text-end">{redirect.hits}</td>
                    <td className="px-4 py-3 text-xs text-zinc-500">{shortDate(redirect.last_hit_at)}</td>
                    <td className="px-4 py-3 text-xs text-zinc-500">{shortDate(redirect.created_at)}</td>
                    <td className="px-4 py-3 text-end">
                      <button
                        type="button"
                        onClick={() => handleDelete(redirect)}
                        className="text-red-600 hover:text-red-800"
                        title="Supprimer"
                        aria-label="Supprimer"
                      >
                        <Icon name="delete" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "indexation" && (
        <div className="space-y-6">
          <div className="gf-card p-5">
            <p className="text-sm text-zinc-600">
              Chaque modification d&apos;une page publique dans l&apos;admin (programme, départ, actualité...) met la page à jour immédiatement et la signale aux moteurs compatibles IndexNow (Bing, Yandex...). Google lit le plan du site.
            </p>
            <div className="mt-4 flex flex-wrap gap-3 text-sm">
              {["/sitemap.xml", "/robots.txt", "/llms.txt", "/indexnow.txt"].map((path) => (
                <a
                  key={path}
                  href={`${baseUrl}${path}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 rounded-md border px-3 py-1.5 font-mono text-xs text-emerald-700 hover:bg-zinc-50"
                  dir="ltr"
                  translate="no"
                >
                  {path}
                  <Icon name="open_in_new" />
                </a>
              ))}
            </div>
          </div>

          <div className="gf-card overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className="px-4 py-3 text-start">Date</th>
                  <th className="px-4 py-3 text-start">Statut</th>
                  <th className="px-4 py-3 text-end">Pages</th>
                  <th className="px-4 py-3 text-start">Détail</th>
                </tr>
              </thead>
              <tbody>
                {pings.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-center text-zinc-500">
                      Aucune notification envoyée pour le moment.
                    </td>
                  </tr>
                )}
                {pings.map((ping) => {
                  const status = PING_STATUS[ping.status] || PING_STATUS.ignore;
                  // Colonne JSON : objet déjà décodé par mysql2, ou texte selon la version.
                  let urls = ping.urls;
                  if (typeof urls === "string") {
                    try {
                      urls = JSON.parse(urls);
                    } catch {
                      urls = [];
                    }
                  }
                  if (!Array.isArray(urls)) urls = [];
                  return (
                    <tr key={ping.id} className="border-t border-zinc-100 align-top">
                      <td className="px-4 py-3 text-xs text-zinc-500">{shortDate(ping.created_at)}</td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${status.tone}`}>
                          {status.label}
                        </span>
                        {ping.http_status && <span className="ms-2 text-xs text-zinc-500">HTTP {ping.http_status}</span>}
                      </td>
                      <td className="px-4 py-3 text-end">{ping.url_count}</td>
                      <td className="px-4 py-3">
                        {ping.message && <p className="text-xs text-zinc-500">{ping.message}</p>}
                        {urls.length > 0 && (
                          <details className="text-xs">
                            <summary className="cursor-pointer text-emerald-700">Voir les adresses</summary>
                            <ul className="mt-1 space-y-0.5 font-mono" dir="ltr" translate="no">
                              {urls.map((url) => (
                                <li key={url}>{url}</li>
                              ))}
                            </ul>
                          </details>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {confirmDialog}
    </div>
  );
}
