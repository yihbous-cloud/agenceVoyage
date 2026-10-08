import { NextResponse } from "next/server";
import { findLinkByReference, runtimeForLink } from "@/lib/payments/online";
import { checkoutForm } from "@/lib/payments/gateways/cmi";
import { getAgencyById } from "@/lib/agencies";
import { siteBaseUrl } from "@/lib/i18n/seo";
import { htmlPage, messagePage, autoSubmitPage, esc } from "@/lib/payments/publicPage";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Lien de paiement envoyé au client (public, sans session) : la référence
// aléatoire est la seule clé. Redirige vers la passerelle choisie, affiche
// le formulaire CMI, ou les instructions de virement.
export async function GET(_request, { params }) {
  const { reference } = await params;
  const link = await findLinkByReference(reference);
  if (!link) return messagePage("Lien introuvable", "Ce lien de paiement n'existe pas.", "رابط الأداء هذا غير موجود.");
  if (link.status === "paye") return messagePage("Déjà payé", "Ce paiement a déjà été effectué. Merci !", "تم أداء هذا المبلغ مسبقا. شكرا لكم !");
  if (link.status !== "cree" && link.status !== "echec") {
    return messagePage("Lien expiré", "Ce lien de paiement n'est plus valable. Contactez votre conseiller.", "رابط الأداء هذا لم يعد صالحا. المرجو التواصل مع مستشاركم.");
  }

  if (link.provider === "stripe" || link.provider === "paypal") {
    if (!link.checkout_url) return messagePage("Paiement indisponible", "Le paiement en ligne est momentanément indisponible.", "الأداء الإلكتروني غير متاح حاليا.");
    return NextResponse.redirect(link.checkout_url, 303);
  }

  const rt = await runtimeForLink(link).catch(() => null);
  if (!rt) return messagePage("Paiement indisponible", "Le paiement en ligne est momentanément indisponible.", "الأداء الإلكتروني غير متاح حاليا.");

  if (link.provider === "cmi") {
    const agency = await getAgencyById(link.agency_id);
    const base = `${siteBaseUrl(agency?.subdomain)}/api/paiement/${link.reference}`;
    const rootDomain = process.env.ROOT_DOMAIN;
    const [customer] = link.registration_id
      ? await query(
          `SELECT tr.full_name AS name, tr.email, tr.phone_whatsapp AS phone FROM registrations r JOIN travelers tr ON tr.id = r.traveler_id AND tr.agency_id = r.agency_id
           WHERE r.id = ? AND r.agency_id = ?`,
          [link.registration_id, link.agency_id]
        )
      : [{}];
    const form = checkoutForm({
      ...rt,
      amount: link.amount,
      reference: link.reference,
      successUrl: `${base}/retour?statut=ok`,
      cancelUrl: `${base}/retour?statut=annule`,
      callbackUrl: `${rootDomain ? `https://${rootDomain}` : siteBaseUrl(agency?.subdomain)}/api/webhooks/paiement/cmi`,
      customer: customer || {},
    });
    return autoSubmitPage(form.action, form.params);
  }

  // Virement : instructions + référence à indiquer.
  const amount = `${Number(link.amount).toLocaleString("fr-FR").replace(/[  ]/g, " ")} ${link.currency}`;
  return htmlPage(
    "Paiement par virement",
    `<h1>Paiement par virement</h1>
<p>Montant : <strong>${esc(amount)}</strong><br>Référence à indiquer : <strong>${esc(link.reference)}</strong></p>
<pre>${esc(rt.publicConfig.instructions || "Coordonnées bancaires communiquées par votre conseiller.")}</pre>
<p class="ar">المبلغ : ${esc(amount)} — المرجع : ${esc(link.reference)}</p>
<p class="muted">Votre paiement sera confirmé par l'agence à réception du virement.</p>`
  );
}
