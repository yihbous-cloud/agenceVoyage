import { listContactMessages } from "@/lib/contactMessages";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissions";
import MessagesList from "./MessagesList";

export default async function MessagesPage() {
  const [messages, session] = await Promise.all([
    listContactMessages(),
    getSession(),
  ]);

  const canManage = await hasPermission(session, "messages.manage");

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-zinc-900">Messages de contact</h1>
      <MessagesList initialMessages={messages} canManage={canManage} />
    </div>
  );
}
