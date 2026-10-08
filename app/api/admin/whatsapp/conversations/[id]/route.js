import { NextResponse } from "next/server";
import { whatsappRoute, readJson } from "@/lib/whatsapp/apiHelpers";
import {
  getConversation,
  takeOver,
  giveBackToAi,
  setWaiting,
  resolveConversation,
  reassign,
  sendStaffMessage,
  addStaffNote,
  approveDraft,
  rejectDraft,
  evaluateAiMessage,
  updateContact,
  manualTransfer,
  markHumanReply,
} from "@/lib/whatsapp/conversations";
import { sendTemplateToConversation } from "@/lib/whatsapp/templates";
import { TRANSFER_REASONS } from "@/lib/ai/tools";

export const dynamic = "force-dynamic";

const INBOX = ["whatsapp.conversations.all", "whatsapp.conversations.own"];

export const GET = whatsappRoute(INBOX, async (_request, { params }, session) => {
  const { id } = await params;
  return NextResponse.json(await getConversation(session, id));
});

// Toutes les actions de l'inbox sur une conversation : { action, ... }.
// L'accès à la conversation est revérifié par chaque fonction (lib).
export const POST = whatsappRoute(INBOX, async (request, { params }, session) => {
  const { id } = await params;
  const body = await readJson(request);
  switch (body.action) {
    case "message":
      await sendStaffMessage(session, id, body.text);
      break;
    case "note":
      await addStaffNote(session, id, body.text);
      break;
    case "template":
      await getConversation(session, id); // contrôle d'accès
      await sendTemplateToConversation(session, id, body.templateId, body.params || []);
      await markHumanReply(session, id, session.agencyId);
      break;
    case "takeover":
      await takeOver(session, id);
      break;
    case "giveback":
      await giveBackToAi(session, id, { copilot: body.copilot === true });
      break;
    case "waiting":
      await setWaiting(session, id);
      break;
    case "resolve":
      await resolveConversation(session, id);
      break;
    case "reassign":
      await reassign(session, id, { staffId: body.staffId ? Number(body.staffId) : null, team: body.team || null, note: body.note });
      break;
    case "transfer":
      if (!TRANSFER_REASONS.includes(body.reason)) return NextResponse.json({ message: "Motif invalide" }, { status: 400 });
      await manualTransfer(session, id, body.reason);
      break;
    case "approve-draft":
      await approveDraft(session, id, body.messageId, body.text);
      break;
    case "reject-draft":
      await rejectDraft(session, id, body.messageId);
      break;
    case "evaluate":
      await evaluateAiMessage(session, id, body.messageId, { evaluation: body.evaluation, correction: body.correction });
      break;
    case "contact":
      await updateContact(session, id, body.contact || {});
      break;
    default:
      return NextResponse.json({ message: "Action inconnue" }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
});
