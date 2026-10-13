import Link from "./LocalizedLink";
import RichText from "./RichText";

// Questions de la banque (ia_knowledge, vague 2B du référencement) affichées
// sur /faq et les piliers : question, autres formulations (darija comprise),
// réponse, lien « En savoir plus ». Composant serveur.
export default function QuestionList({ items, tr }) {
  if (!items || items.length === 0) return null;
  return (
    <div className="space-y-4">
      {items.map((item) => (
        <div key={item.id} className="border border-gold-pale/60 bg-white p-5">
          <h3 className="font-medium text-ink">{item.question}</h3>
          {item.variants?.length > 0 && (
            <p className="mt-1 text-xs text-muted">
              <span>{tr("Autres formulations")} : </span>
              {/* <bdi> : une variante en alphabet latin (darija) reste lisible
                  dans une page en arabe, sans réordonnancement. */}
              {item.variants.map((variant, index) => (
                <span key={index}>
                  {index > 0 && " · "}
                  <bdi>{variant}</bdi>
                </span>
              ))}
            </p>
          )}
          <RichText className="mt-2 text-sm text-muted" text={item.answer} />
          {item.detailPath && (
            <Link href={item.detailPath} className="mt-2 inline-block text-sm text-[#A8863C] hover:underline">
              {tr("En savoir plus")}
            </Link>
          )}
        </div>
      ))}
    </div>
  );
}
