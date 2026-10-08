"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const FIELDS = [
  { key: "name", label: "Nom de l'agence", required: true, span: 2 },
  { key: "address", label: "Adresse", span: 2 },
  { key: "city", label: "Ville" },
  { key: "phone", label: "Téléphone" },
  { key: "whatsapp", label: "WhatsApp" },
  { key: "email", label: "Email" },
  { key: "website", label: "Site web", span: 2 },
  { key: "rc", label: "RC (Registre de commerce)" },
  { key: "taxId", label: "IF (Identifiant fiscal)", dataKey: "tax_id" },
  { key: "ice", label: "ICE" },
  { key: "footerNote", label: "Note de bas de reçu", dataKey: "footer_note", span: 2 },
];

function toFormState(settings) {
  const state = {};
  for (const field of FIELDS) {
    const dbKey = field.dataKey || field.key;
    state[field.key] = settings?.[dbKey] || "";
  }
  return state;
}

const SOCIAL_PLATFORM_SUGGESTIONS = [
  "Facebook",
  "Instagram",
  "TikTok",
  "YouTube",
  "LinkedIn",
  "X (Twitter)",
  "WhatsApp",
  "Snapchat",
  "Pinterest",
  "Telegram",
  "Google Maps",
];

// ⚠️ Piège React rencontré en conditions réelles : la liste utilisait
// `key={index}` (position dans le tableau) — ajouter/retirer une ligne
// décale les index de toutes les lignes suivantes, et React (indexé par
// position) réutilise alors les éléments <input> DOM existants pour une
// ligne LOGIQUEMENT différente, laissant leur valeur affichée résiduelle au
// lieu de la vider. Constaté sur des données réelles : une ligne "YouTube"
// ajoutée s'est retrouvée avec l'URL Facebook déjà saisie juste avant.
// Fix : chaque ligne porte désormais une clé stable indépendante de sa
// position (`_key`, l'id réel une fois enregistrée, un id généré côté
// client sinon) — jamais l'index du tableau.
function toSocialLinksState(settings) {
  return (settings?.social_links || []).map((l) => ({
    _key: `db-${l.id}`,
    platform: l.platform,
    url: l.url,
  }));
}

function makeClientKey() {
  return `new-${Math.random().toString(36).slice(2)}-${Date.now()}`;
}

export default function AgencySettingsForm({ settings, canEdit }) {
  const router = useRouter();
  const [values, setValues] = useState(() => toFormState(settings));
  const [logoUrl, setLogoUrl] = useState(settings?.logo_url || "");
  const [socialLinks, setSocialLinks] = useState(() => toSocialLinksState(settings));
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);

  const handleChange = (key) => (e) => {
    setValues((v) => ({ ...v, [key]: e.target.value }));
    setSuccess(false);
  };

  const handleSocialLinkChange = (clientKey, field) => (e) => {
    setSocialLinks((links) =>
      links.map((l) => (l._key === clientKey ? { ...l, [field]: e.target.value } : l))
    );
    setSuccess(false);
  };

  const addSocialLink = () => {
    setSocialLinks((links) => [...links, { _key: makeClientKey(), platform: "", url: "" }]);
    setSuccess(false);
  };

  const removeSocialLink = (clientKey) => {
    setSocialLinks((links) => links.filter((l) => l._key !== clientKey));
    setSuccess(false);
  };

  const handleLogoFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setUploadError(null);

    try {
      const body = new FormData();
      body.append("file", file);
      body.append("folder", "agency");
      const res = await fetch("/api/admin/upload", { method: "POST", body });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Erreur lors de l'envoi du logo");
      }

      setLogoUrl(data.url);
      setSuccess(false);
    } catch (err) {
      setUploadError(err.message);
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccess(false);

    try {
      const res = await fetch("/api/admin/agency-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...values,
          logoUrl: logoUrl || null,
          socialLinks: socialLinks.map(({ platform, url }) => ({ platform, url })),
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Erreur lors de l'enregistrement");
      }
      setSuccess(true);
      router.refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 rounded-xl border border-zinc-200 bg-white p-6"
    >
      {!canEdit && (
        <p className="text-xs text-zinc-400">
          Lecture seule — réservé au rôle direction.
        </p>
      )}

      <div>
        <label className="block text-sm font-medium text-zinc-700">Logo de l&apos;agence</label>

        {logoUrl && (
          <div className="mt-2 flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={logoUrl}
              alt=""
              className="h-20 w-20 rounded-lg border border-zinc-200 object-contain bg-white p-1"
            />
            {canEdit && (
              <button
                type="button"
                onClick={() => {
                  setLogoUrl("");
                  setSuccess(false);
                }}
                className="text-sm text-red-600 hover:underline"
              >
                Supprimer le logo
              </button>
            )}
          </div>
        )}

        {canEdit && (
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            onChange={handleLogoFileChange}
            disabled={uploading}
            className="mt-2 block w-full text-sm text-zinc-600 file:me-3 file:rounded-lg file:border-0 file:bg-emerald-700 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-emerald-800"
          />
        )}
        {uploading && <p className="mt-1 text-sm text-zinc-500">Envoi en cours...</p>}
        {uploadError && <p className="mt-1 text-sm text-red-600">{uploadError}</p>}
        <p className="mt-1 text-xs text-zinc-500">
          JPG, PNG, WEBP ou GIF — 5 Mo maximum. Apparaîtra en en-tête des reçus imprimables.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {FIELDS.map((field) => (
          <div key={field.key} className={field.span === 2 ? "col-span-2" : ""}>
            <label className="block text-sm font-medium text-zinc-700">
              {field.label}
            </label>
            <input
              required={field.required}
              disabled={!canEdit}
              value={values[field.key]}
              onChange={handleChange(field.key)}
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm disabled:bg-zinc-100"
            />
          </div>
        ))}
      </div>

      <div className="border-t border-zinc-200 pt-4">
        <label className="block text-sm font-medium text-zinc-700">Réseaux sociaux</label>
        <p className="mt-1 text-xs text-zinc-500">
          Affichés dans le footer du site public. Nom libre (ex. Facebook,
          Instagram, TikTok...) — une icône dédiée s&apos;affiche pour les
          plateformes courantes, une icône générique sinon. Ajoutez
          &laquo; Google Maps &raquo; avec le lien vers la fiche de l&apos;agence
          pour l&apos;afficher aussi comme un réseau social.
        </p>

        <datalist id="social-platform-suggestions">
          {SOCIAL_PLATFORM_SUGGESTIONS.map((name) => (
            <option key={name} value={name} />
          ))}
        </datalist>

        <div className="mt-3 space-y-2">
          {socialLinks.map((link) => (
            <div key={link._key} className="flex gap-2">
              <input
                list="social-platform-suggestions"
                placeholder="Plateforme (ex. Facebook)"
                disabled={!canEdit}
                value={link.platform}
                onChange={handleSocialLinkChange(link._key, "platform")}
                className="w-1/3 rounded-lg border border-zinc-300 px-3 py-2 text-sm disabled:bg-zinc-100"
              />
              <input
                type="url"
                placeholder="https://..."
                disabled={!canEdit}
                value={link.url}
                onChange={handleSocialLinkChange(link._key, "url")}
                className="flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm disabled:bg-zinc-100"
              />
              {canEdit && (
                <button
                  type="button"
                  onClick={() => removeSocialLink(link._key)}
                  className="shrink-0 rounded-lg border border-zinc-300 px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                >
                  Retirer
                </button>
              )}
            </div>
          ))}
        </div>

        {canEdit && (
          <button
            type="button"
            onClick={addSocialLink}
            className="mt-3 text-sm font-medium text-emerald-700 hover:underline"
          >
            + Ajouter un réseau social
          </button>
        )}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {success && <p className="text-sm text-emerald-700">Paramètres enregistrés.</p>}

      {canEdit && (
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
