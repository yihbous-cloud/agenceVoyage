import { findLinkByReference, runtimeForLink, confirmLinkPayment } from "@/lib/payments/online";
import { captureOrder } from "@/lib/payments/gateways/paypal";
import { messagePage } from "@/lib/payments/publicPage";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Retour du client après la passerelle. Ce retour NE CONFIRME RIEN par
// lui-même (Stripe et CMI notifient le serveur séparément), sauf PayPal :
// la commande est « capturée » ici, côté serveur, et c'est la réponse de
// PayPal — pas le navigateur — qui fait foi.
export async function GET(request, { params }) {
  const { reference } = await params;
  const statut = request.nextUrl.searchParams.get("statut");
  const link = await findLinkByReference(reference);
  if (!link) return messagePage("Lien introuvable", "Ce lien de paiement n'existe pas.", "رابط الأداء هذا غير موجود.");
  if (statut !== "ok") {
    return messagePage("Paiement non effectué", "Le paiement a été annulé. Vous pouvez réessayer avec le même lien.", "تم إلغاء الأداء. يمكنكم إعادة المحاولة بنفس الرابط.");
  }
  if (link.provider === "paypal" && link.status !== "paye") {
    try {
      const rt = await runtimeForLink(link);
      const orderId = request.nextUrl.searchParams.get("token") || link.external_id;
      const capture = await captureOrder({ ...rt, orderId });
      if (capture.paid && capture.reference === link.reference) {
        await confirmLinkPayment(link, { amount: link.amount, externalId: orderId, event: capture.event });
      } else {
        return messagePage("Paiement non confirmé", "PayPal n'a pas confirmé le paiement. Contactez votre conseiller.", "لم يؤكد PayPal الأداء. المرجو التواصل مع مستشاركم.");
      }
    } catch {
      return messagePage("Vérification en cours", "Nous vérifions votre paiement ; votre conseiller vous confirmera sa réception.", "نتحقق من أدائكم، وسيؤكد لكم مستشاركم التوصل به.");
    }
  }
  return messagePage(
    "Merci !",
    "Votre paiement est en cours de vérification. Vous recevrez une confirmation sur WhatsApp.",
    "أداؤكم قيد التحقق. ستتوصلون بتأكيد على واتساب."
  );
}
