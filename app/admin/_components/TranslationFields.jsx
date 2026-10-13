"use client";

// Contenu FR/AR par entité (référencement, vague 1B — CLAUDE.md
// §3centquinzequadragies). Les champs habituels d'un formulaire sont dans la
// LANGUE PRINCIPALE du contenu (ContentLocaleSelect) ; l'autre langue se
// saisit dans ce bloc repliable (TranslationFields). Le slug reste commun.

export const otherContentLocale = (locale) => (locale === "fr" ? "ar" : "fr");

// Textes fixes (traduits par le traducteur de l'admin) : jamais assemblés.
const VERSION_TITLES = { ar: "Version arabe", fr: "Version française" };

export function ContentLocaleSelect({ value, onChange, disabled }) {
  return (
    <div>
      <label className="block text-sm font-medium text-zinc-700">Langue principale du contenu</label>
      <select
        disabled={disabled}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm disabled:bg-zinc-100"
      >
        <option value="ar">Arabe</option>
        <option value="fr">Français</option>
      </select>
      <p className="mt-1 text-xs text-zinc-500">
        Les champs de texte sont dans cette langue ; l&apos;autre langue se saisit dans le bloc « Version ».
      </p>
    </div>
  );
}

// fields : [{ key, label, multiline?, rows?, placeholder? }] — mêmes clés que
// le payload `translations` attendu par l'API (camelCase).
export default function TranslationFields({ locale, fields, values, onChange, disabled }) {
  const filled = fields.some((field) => String(values?.[field.key] || "").trim());
  const rtl = locale === "ar";

  return (
    <details open={filled} className="rounded-lg border border-zinc-200 bg-zinc-50 p-4">
      <summary className="cursor-pointer text-sm font-medium text-zinc-800">
        {VERSION_TITLES[locale]}
        {!filled && <span className="ms-2 text-xs font-normal text-amber-700">à compléter</span>}
      </summary>
      <div className="mt-3 space-y-3">
        {fields.map((field) => (
          <div key={field.key}>
            <label className="block text-sm font-medium text-zinc-700">{field.label}</label>
            {field.multiline ? (
              <textarea
                disabled={disabled}
                value={values?.[field.key] || ""}
                onChange={(e) => onChange({ ...values, [field.key]: e.target.value })}
                rows={field.rows || 3}
                placeholder={field.placeholder}
                dir={rtl ? "rtl" : "ltr"}
                lang={locale}
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm disabled:bg-zinc-100"
              />
            ) : (
              <input
                disabled={disabled}
                value={values?.[field.key] || ""}
                onChange={(e) => onChange({ ...values, [field.key]: e.target.value })}
                placeholder={field.placeholder}
                dir={rtl ? "rtl" : "ltr"}
                lang={locale}
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm disabled:bg-zinc-100"
              />
            )}
          </div>
        ))}
      </div>
    </details>
  );
}
