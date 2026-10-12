import { Fragment } from "react";
import { parseMarkdownBlocks, parseInline } from "@/lib/markdown";

// Rendu du Markdown léger saisi dans l'admin (lib/markdown.js) en éléments
// React — jamais de HTML injecté tel quel (pas de dangerouslySetInnerHTML).
// Composant serveur ET client (aucun état).
function Inline({ text }) {
  return parseInline(text).map((token, index) => {
    if (token.type === "strong") {
      return (
        <strong key={index} className="font-semibold text-ink">
          {token.value}
        </strong>
      );
    }
    if (token.type === "em") return <em key={index}>{token.value}</em>;
    if (token.type === "link") {
      const external = /^https?:\/\//.test(token.href);
      return (
        <a
          key={index}
          href={token.href}
          className="text-[#A8863C] underline hover:text-ink"
          {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
        >
          {token.value}
        </a>
      );
    }
    return <Fragment key={index}>{token.value}</Fragment>;
  });
}

export default function RichText({ text, className = "" }) {
  const blocks = parseMarkdownBlocks(text);
  if (blocks.length === 0) return null;

  return (
    <div className={`space-y-4 ${className}`}>
      {blocks.map((block, index) => {
        if (block.type === "h2") {
          return (
            <h2 key={index} className="pt-2 font-display text-xl font-normal text-ink">
              <Inline text={block.text} />
            </h2>
          );
        }
        if (block.type === "h3") {
          return (
            <h3 key={index} className="font-medium text-ink">
              <Inline text={block.text} />
            </h3>
          );
        }
        if (block.type === "ul" || block.type === "ol") {
          const List = block.type;
          return (
            <List
              key={index}
              className={`space-y-1 ps-5 ${block.type === "ul" ? "list-disc" : "list-decimal"}`}
            >
              {block.items.map((item, itemIndex) => (
                <li key={itemIndex}>
                  <Inline text={item} />
                </li>
              ))}
            </List>
          );
        }
        return (
          <p key={index}>
            {block.lines.map((line, lineIndex) => (
              <Fragment key={lineIndex}>
                {lineIndex > 0 && <br />}
                <Inline text={line} />
              </Fragment>
            ))}
          </p>
        );
      })}
    </div>
  );
}
