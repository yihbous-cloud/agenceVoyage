import { NextResponse } from "next/server";
import { findAccountByPhoneNumberId, findAccountByWabaId, findAccountByVerifyToken, touchAccountWebhook } from "@/lib/whatsapp/accounts";
import { processWebhookChange, phoneNumberIdOfChange } from "@/lib/whatsapp/inbound";
import { verifyMetaSignature } from "@/lib/whatsapp/signature";
import { decryptSecret } from "@/lib/secrets";
import { enqueue, QUEUES, inboundJobId } from "@/lib/queue";

// Webhook WhatsApp Cloud API — COMMUN à toutes les agences : proxy.js le
// laisse passer sans résolution de sous-domaine (Meta appelle une seule URL),
// et l'agence est déduite ici du phone_number_id de chaque "change".
// Sécurité : signature X-Hub-Signature-256 vérifiée avec l'app secret du
// compte concerné (ou META_APP_SECRET, si toutes les agences partagent la
// même application Meta) — un corps non signé ou mal signé est refusé (401).
// Réponse rapide (< 2 s, WA-02) : uniquement des écritures en base ; le
// traitement se fait dans le worker.

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Abonnement : Meta envoie hub.mode=subscribe, hub.verify_token, hub.challenge.
export async function GET(request) {
  const params = request.nextUrl.searchParams;
  const mode = params.get("hub.mode");
  const token = params.get("hub.verify_token");
  const challenge = params.get("hub.challenge");
  if (mode !== "subscribe" || !token || !challenge) {
    return new NextResponse("Requête invalide", { status: 400 });
  }
  const globalToken = process.env.META_WEBHOOK_VERIFY_TOKEN;
  const ok = (globalToken && token === globalToken) || Boolean(await findAccountByVerifyToken(token));
  if (!ok) return new NextResponse("Jeton de vérification incorrect", { status: 403 });
  return new NextResponse(challenge, { status: 200, headers: { "Content-Type": "text/plain" } });
}

function appSecretOf(account) {
  try {
    return decryptSecret(account.app_secret_enc) || process.env.META_APP_SECRET || null;
  } catch {
    return process.env.META_APP_SECRET || null;
  }
}

export async function POST(request) {
  const rawBody = await request.text();
  let payload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new NextResponse("JSON invalide", { status: 400 });
  }
  if (payload?.object !== "whatsapp_business_account") {
    return NextResponse.json({ ignored: true });
  }

  const signature = request.headers.get("x-hub-signature-256");
  // Chaque « change » garde l'identifiant WABA de son entrée (entry.id) :
  // les notifications de templates n'ont pas de phone_number_id.
  const changes = (payload.entry || []).flatMap((entry) => (entry.changes || []).map((change) => ({ ...change, wabaId: entry.id })));

  // Regroupe les "changes" par compte (agence). Un numéro inconnu est ignoré
  // (réponse 200 tout de même : sinon Meta renverrait indéfiniment le webhook).
  const byAccount = new Map();
  for (const change of changes) {
    const phoneNumberId = phoneNumberIdOfChange(change);
    let entry = phoneNumberId
      ? [...byAccount.values()].find((e) => e.account.phone_number_id === String(phoneNumberId))
      : [...byAccount.values()].find((e) => e.account.waba_id && e.account.waba_id === String(change.wabaId));
    if (!entry) {
      const account = phoneNumberId ? await findAccountByPhoneNumberId(phoneNumberId) : change.wabaId ? await findAccountByWabaId(change.wabaId) : null;
      if (!account) {
        console.warn(`[webhook meta] compte inconnu (${phoneNumberId ? `phone_number_id ${phoneNumberId}` : `WABA ${change.wabaId}`}), ignoré`);
        continue;
      }
      entry = { account, changes: [] };
      byAccount.set(account.id, entry);
    }
    entry.changes.push(change);
  }

  // Un webhook sans aucun compte reconnu doit quand même être signé avec le
  // secret global, sinon on le refuse (ne pas servir d'oracle aux inconnus).
  if (byAccount.size === 0) {
    const secret = process.env.META_APP_SECRET;
    if (secret && !verifyMetaSignature(rawBody, signature, secret)) {
      return new NextResponse("Signature invalide", { status: 401 });
    }
    return NextResponse.json({ received: true });
  }

  for (const { account } of byAccount.values()) {
    const secret = appSecretOf(account);
    if (!secret || !verifyMetaSignature(rawBody, signature, secret)) {
      console.warn(`[webhook meta] signature invalide (agence ${account.agency_id})`);
      return new NextResponse("Signature invalide", { status: 401 });
    }
  }

  const toEnqueue = [];
  for (const { account, changes: accountChanges } of byAccount.values()) {
    const agencyId = account.agency_id;
    await touchAccountWebhook(account.id, agencyId);
    for (const change of accountChanges) {
      const messageIds = await processWebhookChange(agencyId, change);
      for (const messageId of messageIds) toEnqueue.push({ agencyId, messageId });
    }
  }
  // En parallèle, délai borné : si Redis est indisponible, les messages
  // restent "recu" en base et le balayage du worker les reprendra.
  await Promise.all(
    toEnqueue.map((data) => enqueue(QUEUES.inbound, "message", data, { jobId: inboundJobId(data.messageId) }))
  );

  return NextResponse.json({ received: true });
}
