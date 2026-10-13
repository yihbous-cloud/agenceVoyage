"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import TranslationFields, { otherContentLocale } from "@/app/admin/_components/TranslationFields";
import { normalizeDays } from "@/lib/itineraryDays";
import { useAdminLocale } from "@/app/admin/_components/AdminLocale";

// Contenu de la fiche voyage commun à tous les départs (vague 2A — CLAUDE.md
// §3centdixseptquadragies, cahier référencement §6.4) : encadrement,
// programme jour par jour, inclus / non inclus, formalités, conditions.
// Saisi dans la langue principale du programme ; l'autre langue dans le
// bloc « Version ». Enregistrement partiel : seuls ces champs sont envoyés,
// avec la traduction COMPLÈTE de l'autre langue (titre, descriptions...
// conservés tels quels).

const TEXT_TRANSLATION_FIELDS = [
  { key: "supervision", label: "Encadrement", multiline: true, rows: 3 },
  { key: "includedItems", label: "Inclus (un élément par ligne)", multiline: true, rows: 5 },
  { key: "excludedItems", label: "Non inclus (un élément par ligne)", multiline: true, rows: 4 },
  { key: "formalities", label: "Formalités", multiline: true, rows: 5 },
  { key: "bookingConditions", label: "Conditions de réservation et d'annulation", multiline: true, rows: 5 },
];

const input = "mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm disabled:bg-zinc-100";

function DaysEditor({ days, onChange, disabled, dir }) {
  const { tr } = useAdminLocale();
  const update = (index, key, value) => onChange(days.map((d, i) => (i === index ? { ...d, [key]: value } : d)));
  const move = (index, delta) => {
    const target = index + delta;
    if (target < 0 || target >= days.length) return;
    const next = [...days];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };
  return (
    <div className="space-y-3">
      {days.map((day, index) => (
        <div key={index} className="rounded-lg border border-zinc-200 p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-zinc-500">{tr("Jour {n}", { n: index + 1 })}</span>
            {!disabled && (
              <span className="flex gap-1 text-xs">
                <button type="button" onClick={() => move(index, -1)} className="rounded border px-2 py-0.5 hover:bg-zinc-50" aria-label="Monter">
                  ↑
                </button>
                <button type="button" onClick={() => move(index, 1)} className="rounded border px-2 py-0.5 hover:bg-zinc-50" aria-label="Descendre">
                  ↓
                </button>
                <button
                  type="button"
                  onClick={() => onChange(days.filter((_, i) => i !== index))}
                  className="rounded border px-2 py-0.5 text-red-600 hover:bg-red-50"
                >
                  Retirer
                </button>
              </span>
            )}
          </div>
          <input
            disabled={disabled}
            value={day.title}
            onChange={(e) => update(index, "title", e.target.value)}
            placeholder="Titre du jour (ex. Arrivée à Médine)"
            dir={dir}
            className={input}
          />
          <textarea
            disabled={disabled}
            value={day.description}
            onChange={(e) => update(index, "description", e.target.value)}
            rows={2}
            dir={dir}
            className={input}
          />
        </div>
      ))}
      {!disabled && (
        <button
          type="button"
          onClick={() => onChange([...days, { title: "", description: "" }])}
          className="text-sm font-medium text-emerald-700 hover:underline"
        >
          + Ajouter un jour
        </button>
      )}
    </div>
  );
}

export default function FicheContentCard({ program, translations = {}, canManage, onSuccess }) {
  const router = useRouter();
  const contentLocale = program.content_locale || "ar";
  const otherLocale = otherContentLocale(contentLocale);
  const dir = contentLocale === "ar" ? "rtl" : "ltr";
  const otherDir = otherLocale === "ar" ? "rtl" : "ltr";
  const baseTranslation = translations[otherLocale] || {};

  const [supervision, setSupervision] = useState(program.supervision || "");
  const [days, setDays] = useState(() => normalizeDays(program.itinerary_days) || []);
  const [includedItems, setIncludedItems] = useState(program.included_items || "");
  const [excludedItems, setExcludedItems] = useState(program.excluded_items || "");
  const [formalities, setFormalities] = useState(program.formalities || "");
  const [verifiedAt, setVerifiedAt] = useState(program.formalities_verified_at ? String(program.formalities_verified_at).slice(0, 10) : "");
  const [sourceUrl, setSourceUrl] = useState(program.formalities_source_url || "");
  const [bookingConditions, setBookingConditions] = useState(program.booking_conditions || "");
  const [translation, setTranslation] = useState(() =>
    Object.fromEntries(TEXT_TRANSLATION_FIELDS.map((f) => [f.key, baseTranslation[f.key] || ""]))
  );
  const [translatedDays, setTranslatedDays] = useState(() => normalizeDays(baseTranslation.itineraryDays) || []);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const today = new Date();
  const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/programs/${program.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supervision,
          itineraryDays: days,
          includedItems,
          excludedItems,
          formalities,
          formalitiesVerifiedAt: verifiedAt || null,
          formalitiesSourceUrl: sourceUrl || null,
          bookingConditions,
          // Traduction complète de l'autre langue : les champs gérés par la
          // carte « Informations » (titre, descriptions, SEO) sont renvoyés tels quels.
          translations: { [otherLocale]: { ...baseTranslation, ...translation, itineraryDays: translatedDays } },
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "Erreur lors de l'enregistrement");
      }
      router.refresh();
      onSuccess?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const disabled = !canManage;

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <p className="text-xs text-zinc-500">
        Contenu commun à tous les départs de ce programme, affiché sur la fiche publique. Un bloc laissé vide n&apos;apparaît pas sur le site.
      </p>

      <div>
        <label className="block text-sm font-medium text-zinc-700">Programme jour par jour</label>
        <div className="mt-2">
          <DaysEditor days={days} onChange={setDays} disabled={disabled} dir={dir} />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-700">Encadrement (guide religieux, accompagnateur)</label>
        <textarea disabled={disabled} value={supervision} onChange={(e) => setSupervision(e.target.value)} rows={3} dir={dir} className={input} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-zinc-700">Inclus (un élément par ligne)</label>
          <textarea disabled={disabled} value={includedItems} onChange={(e) => setIncludedItems(e.target.value)} rows={6} dir={dir} className={input} />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700">Non inclus (un élément par ligne)</label>
          <textarea disabled={disabled} value={excludedItems} onChange={(e) => setExcludedItems(e.target.value)} rows={6} dir={dir} className={input} />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-700">Formalités (documents, délais, conditions)</label>
        <textarea disabled={disabled} value={formalities} onChange={(e) => setFormalities(e.target.value)} rows={5} dir={dir} className={input} />
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-medium text-zinc-600">Vérifiées le</label>
            <div className="flex gap-2">
              <input type="date" disabled={disabled} value={verifiedAt} max={todayIso} onChange={(e) => setVerifiedAt(e.target.value)} className={input} />
              {!disabled && (
                <button type="button" onClick={() => setVerifiedAt(todayIso)} className="mt-1 shrink-0 rounded-lg border px-3 text-xs hover:bg-zinc-50">
                  Aujourd&apos;hui
                </button>
              )}
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-600">Lien vers la source officielle</label>
            <input type="url" disabled={disabled} value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} placeholder="https://..." dir="ltr" className={input} />
          </div>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-700">Conditions de réservation et d&apos;annulation (acompte, échéancier, annulation, modification)</label>
        <textarea disabled={disabled} value={bookingConditions} onChange={(e) => setBookingConditions(e.target.value)} rows={5} dir={dir} className={input} />
      </div>

      <TranslationFields
        locale={otherLocale}
        fields={TEXT_TRANSLATION_FIELDS}
        values={translation}
        onChange={setTranslation}
        disabled={disabled}
      />
      <details open={translatedDays.length > 0} className="rounded-lg border border-zinc-200 bg-zinc-50 p-4">
        <summary className="cursor-pointer text-sm font-medium text-zinc-800">
          {otherLocale === "ar" ? "Programme jour par jour — version arabe" : "Programme jour par jour — version française"}
        </summary>
        <div className="mt-3">
          <DaysEditor days={translatedDays} onChange={setTranslatedDays} disabled={disabled} dir={otherDir} />
        </div>
      </details>

      <p className="text-xs text-zinc-500">
        Mise en forme simple possible dans les textes : listes (- élément), gras (**texte**).
      </p>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {canManage && (
        <button
          type="submit"
          disabled={submitting}
          className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-60"
        >
          {submitting ? "Enregistrement..." : "Enregistrer"}
        </button>
      )}
    </form>
  );
}
