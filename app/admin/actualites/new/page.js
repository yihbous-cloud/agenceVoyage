import NewsForm from "../NewsForm";

export default function NewNewsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-zinc-900">Nouvelle actualité</h1>
      <NewsForm />
    </div>
  );
}
