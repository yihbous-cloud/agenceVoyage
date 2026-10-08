import { listContactMessages } from "@/lib/contactMessages";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissions";
import MessagesList from "./MessagesList";
import PageHeader from "../_components/PageHeader";

export default async function MessagesPage() {
  const [messages, session] = await Promise.all([
    listContactMessages(),
    getSession(),
  ]);

  const canManage = await hasPermission(session, "messages.manage");

  return (
    <div className="space-y-6">
      <PageHeader icon="forum" title="Messages de contact" description="Demandes reçues via le site." />
      <MessagesList initialMessages={messages} canManage={canManage} />
    </div>
  );
}
