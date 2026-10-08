import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissions";
import { getActiveSettings, getSettingsVersion, listSettingsVersions, ALL_TOOLS } from "@/lib/ai/settings";
import { isAiConfigured } from "@/lib/ai/client";
import PageHeader from "../../_components/PageHeader";
import IaSettingsForm from "./IaSettingsForm";

export const dynamic = "force-dynamic";

// Réglages de l'agent IA (exigence 8.8) — versionnés, retour arrière en un clic.
export default async function IaSettingsPage({ searchParams }) {
  const session = await getSession();
  if (!(await hasPermission(session, "ia.settings"))) return <p className="text-sm text-zinc-500">Accès réservé.</p>;
  const params = await searchParams;
  const active = await getActiveSettings();
  const shown = params.version ? (await getSettingsVersion(params.version)) || active : active;
  const versions = await listSettingsVersions();
  return (
    <div className="max-w-5xl space-y-6">
      <PageHeader
        icon="smart_toy"
        title="Agent IA — réglages"
        description="Comportement de l'assistant WhatsApp. Chaque enregistrement crée une nouvelle version ; une version précédente peut être réactivée à tout moment."
      />
      {!isAiConfigured() && (
        <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
          La clé API Claude (ANTHROPIC_API_KEY) n&apos;est pas configurée sur le serveur : tant qu&apos;elle manque, chaque
          message est transmis directement à un conseiller.
        </p>
      )}
      <IaSettingsForm
        key={shown.id}
        settings={JSON.parse(JSON.stringify(shown))}
        activeId={active.id}
        versions={JSON.parse(JSON.stringify(versions))}
        allTools={ALL_TOOLS}
      />
    </div>
  );
}
