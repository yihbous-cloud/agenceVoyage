import { notFound } from "next/navigation";
import { getNewsById } from "@/lib/news";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissions";
import NewsForm from "../NewsForm";

export default async function EditNewsPage({ params }) {
  const { id } = await params;

  const [post, session] = await Promise.all([getNewsById(id), getSession()]);

  if (!post) {
    notFound();
  }

  const canManage = await hasPermission(session, "actualites.manage");

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-zinc-900">{post.title}</h1>
      <NewsForm post={post} canDelete={canManage} />
    </div>
  );
}
