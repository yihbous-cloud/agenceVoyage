"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Icon from "../_components/Icon";
import { useAdminLocale } from "../_components/AdminLocale";

// Santé SEO (référencement, vague 2C — CLAUDE.md §3centdixneufquadragies) :
// indicateurs face aux objectifs du cahier des charges, puis problèmes
// détectés par section, chacun avec un lien « Corriger ». Données calculées
// côté serveur (lib/seoHealth.js).

const SEVERITY = {
  erreur: { label: "Erreur", tone: "bg-red-100 text-red-800" },
  avertissement: { label: "Avertissement", tone: "bg-amber-100 text-amber-800" },
  info: { label: "Information", tone: "bg-zinc-100 text-zinc-600" },
};

function Indicator({ indicator, tr }) {
  const { value, target } = indicator;
  const percent = target > 0 ? Math.min(100, Math.round((value / target) * 100)) : 0;
  const tone = percent >= 100 ? "bg-emerald-600" : percent >= 50 ? "bg-amber-500" : "bg-red-500";
  return (
    <div className="gf-card p-4">
      <p className="text-xs text-zinc-500">{indicator.label}</p>
      <p className="mt-1 text-2xl font-semibold text-zinc-900" translate="no">
        <bdi dir="ltr">
          {value} <span className="text-base font-normal text-zinc-400">/ {target}</span>
        </bdi>
      </p>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-zinc-100" aria-hidden="true">
        <div className={`h-full ${tone}`} style={{ width: `${percent}%` }} />
      </div>
      <p className="mt-1 text-xs text-zinc-500">{tr("{percent} % de l'objectif", { percent })}</p>
    </div>
  );
}

export default function SeoHealthPanel({ health }) {
  const router = useRouter();
  const { tr, locale } = useAdminLocale();
  const separator = locale === "ar" ? "، " : ", ";
  const [severity, setSeverity] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  // Message source français + variables ; une variable tableau est une liste
  // de libellés traduits un à un.
  const render = (item) =>
    tr(
      item.message,
      Object.fromEntries(
        Object.entries(item.params || {}).map(([key, value]) => [key, Array.isArray(value) ? value.map((v) => tr(v)).join(separator) : value])
      )
    );

  const refresh = () => {
    setRefreshing(true);
    router.refresh();
    setTimeout(() => setRefreshing(false), 800);
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {health.indicators.map((indicator) => (
          <Indicator key={indicator.key} indicator={indicator} tr={tr} />
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-zinc-600">
          {tr("{errors} erreur(s) · {warnings} avertissement(s) · {infos} information(s)", {
            errors: health.counts.erreur,
            warnings: health.counts.avertissement,
            infos: health.counts.info,
          })}
        </p>
        <div className="flex gap-2">
          <select value={severity} onChange={(e) => setSeverity(e.target.value)} className="rounded-md border px-2 py-1.5 text-sm">
            <option value="">Tout afficher</option>
            <option value="erreur">Erreurs</option>
            <option value="avertissement">Avertissements</option>
            <option value="info">Informations</option>
          </select>
          <button type="button" onClick={refresh} disabled={refreshing} className="gf-btn-outline">
            <Icon name="history" size={16} />
            Actualiser
          </button>
        </div>
      </div>

      {health.sections.map((section) => {
        const items = section.issues.filter((i) => !severity || i.severity === severity);
        return (
          <section key={section.key} className="gf-card overflow-hidden">
            <div className="gf-card-head gf-divided">
              <h2 className="gf-card-title">{tr(section.title)}</h2>
              <span className="text-xs text-zinc-500">{tr("{count} point(s) à revoir", { count: items.length })}</span>
            </div>
            {items.length === 0 ? (
              <div className="gf-empty">Rien à signaler.</div>
            ) : (
              <ul className="divide-y divide-zinc-100">
                {items.map((item, index) => (
                  <li key={index} className="flex items-start justify-between gap-3 px-5 py-3 text-sm">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${SEVERITY[item.severity].tone}`}>
                          {SEVERITY[item.severity].label}
                        </span>
                        <span className="font-medium text-zinc-900" translate="no" dir="auto">
                          {tr(item.subject)}
                        </span>
                      </div>
                      <p className="mt-1 text-zinc-600" translate="no">
                        {render(item)}
                      </p>
                    </div>
                    <Link href={item.href} className="shrink-0 text-emerald-700 hover:underline">
                      Corriger
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}
