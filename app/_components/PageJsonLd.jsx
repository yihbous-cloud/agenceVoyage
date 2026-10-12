import { getAgencySettings } from "@/lib/agencySettings";
import { siteBaseUrl } from "@/lib/i18n/seo";
import { localizePath } from "@/lib/i18n/locales";
import { makeTranslator } from "@/lib/i18n/translate";
import {
  buildGraph,
  serializeJsonLd,
  organizationNode,
  websiteNode,
  webPageNode,
  breadcrumbNode,
} from "@/lib/seo/jsonLd";

// UN SEUL bloc JSON-LD par page publique (cahier des charges référencement
// §10, CLAUDE.md §3centquatorzequadragies) : organisation + site + page
// (+ fil d'Ariane) + les nœuds propres à la page (voyage, FAQ, article,
// liste...), reliés par des @id stables. Composant serveur.
//
// Props :
//   agency        { id, name, subdomain } (ligne agencies)
//   locale        langue de la page
//   path          chemin SANS préfixe de langue (ex. "/omra/x")
//   canonicalLocale  langue de l'URL canonique si elle diffère (contenu
//                 saisi dans une seule langue, voir pageAlternates)
//   name, description, pageType ("WebPage", "CollectionPage", "AboutPage"...)
//   breadcrumb    [{ name, href? }] — les mêmes éléments que <Breadcrumbs>
//   nodes         (url, baseUrl) => [nœuds] — nœuds propres à la page
//   mainEntity    "trip" | "faq" | "article" | "list" — nœud principal
export default async function PageJsonLd({
  agency,
  locale,
  path,
  canonicalLocale,
  name,
  description,
  pageType = "WebPage",
  breadcrumb,
  nodes,
  mainEntity,
  dateModified,
}) {
  const settings = await getAgencySettings(agency.id).catch(() => null);
  const baseUrl = siteBaseUrl(agency.subdomain);
  const url = `${baseUrl}${localizePath(path, canonicalLocale || locale)}`;
  const tr = makeTranslator(locale, "public", { brandName: agency.name });

  const extraNodes = nodes ? nodes(url, baseUrl) : [];
  const graph = buildGraph([
    organizationNode({
      settings,
      agencyName: agency.name,
      baseUrl,
      description: tr(
        "Agence de voyages spécialisée dans l'organisation d'Omra, de Hajj et de séjours touristiques."
      ),
      knowsAbout: [tr("Omra"), tr("Hajj"), tr("Voyages organisés")],
    }),
    websiteNode({ baseUrl, name: agency.name, locale }),
    webPageNode({
      url,
      name: name || agency.name,
      description,
      locale,
      baseUrl,
      type: pageType,
      hasBreadcrumb: Boolean(breadcrumb?.length),
      mainEntityId: mainEntity ? `${url}#${mainEntity}` : undefined,
      dateModified,
    }),
    breadcrumb?.length
      ? breadcrumbNode(
          url,
          breadcrumb.map((entry) => ({
            name: entry.name,
            url: entry.href ? `${baseUrl}${localizePath(entry.href, locale)}` : undefined,
          }))
        )
      : null,
    ...extraNodes,
  ]);

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: serializeJsonLd(graph) }}
    />
  );
}
