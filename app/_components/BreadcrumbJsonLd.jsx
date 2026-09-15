// items: [{ name, item? }] — le dernier élément (page courante) n'a pas
// besoin d'`item` (URL), conformément aux recommandations schema.org.
export default function BreadcrumbJsonLd({ items }) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((entry, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: entry.name,
      ...(entry.item ? { item: entry.item } : {}),
    })),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}
