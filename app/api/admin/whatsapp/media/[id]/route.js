import fs from "node:fs/promises";
import path from "node:path";
import { whatsappRoute } from "@/lib/whatsapp/apiHelpers";
import { getMediaForStaff } from "@/lib/whatsapp/conversations";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const INBOX = ["whatsapp.conversations.all", "whatsapp.conversations.own"];

// Médias reçus sur WhatsApp (passeports, reçus...) : stockés hors de public/
// et servis UNIQUEMENT par cette route, après contrôle de la session et de
// l'accès à la conversation (NF-09). Jamais mis en cache par le navigateur.
export const GET = whatsappRoute(INBOX, async (_request, { params }, session) => {
  const { id } = await params;
  const media = await getMediaForStaff(session, id);
  const root = path.resolve(/* turbopackIgnore: true */ process.env.WA_MEDIA_DIR || "storage/wa-media");
  const file = path.resolve(root, media.storage_path);
  if (!file.startsWith(root + path.sep)) return new Response("Chemin invalide", { status: 400 });
  const buffer = await fs.readFile(/* turbopackIgnore: true */ file);
  return new Response(buffer, {
    headers: {
      "Content-Type": media.mime_type || "application/octet-stream",
      "Content-Disposition": `inline; filename="whatsapp-${media.id}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
});
