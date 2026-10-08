import Link from "next/link";
import { getSession } from "@/lib/session";
import { getConversation, inboxScope } from "@/lib/whatsapp/conversations";
import { listActiveStaff, listQuickReplies } from "@/lib/whatsapp/team";
import { listApprovedTemplates } from "@/lib/whatsapp/templates";
import { listGateways } from "@/lib/payments/online";
import { hasPermission } from "@/lib/permissions";
import Icon from "../../../_components/Icon";
import AutoRefresh from "../../AutoRefresh";
import ConversationView from "./ConversationView";

export const dynamic = "force-dynamic";

export default async function ConversationPage({ params }) {
  const session = await getSession();
  if (!(await inboxScope(session))) return <p className="text-sm text-zinc-500">Accès réservé.</p>;
  const { id } = await params;
  let data;
  try {
    data = await getConversation(session, id);
  } catch (err) {
    if (err.code === "NOT_FOUND") return <p className="text-sm text-zinc-500">Conversation introuvable.</p>;
    throw err;
  }
  const [staff, quickReplies, templates] = await Promise.all([listActiveStaff(), listQuickReplies(), listApprovedTemplates()]);
  // Passerelles de paiement actives (lien de paiement depuis le panneau Dossiers).
  const paymentGateways = (await hasPermission(session, "paiements.liens")) ? (await listGateways()).filter((g) => g.isActive).map((g) => ({ provider: g.provider, label: g.label })) : [];

  return (
    <div className="space-y-4">
      <AutoRefresh seconds={5} />
      <Link href="/admin/whatsapp/conversations" className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:underline">
        <Icon name="arrow_back" size={16} className="gf-tile-arrow" />
        Conversations
      </Link>
      <ConversationView
        data={JSON.parse(JSON.stringify(data))}
        staff={staff}
        quickReplies={quickReplies}
        templates={JSON.parse(JSON.stringify(templates))}
        paymentGateways={paymentGateways}
        me={{ id: session.id, role: session.role }}
      />
    </div>
  );
}
