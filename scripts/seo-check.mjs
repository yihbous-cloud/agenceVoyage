#!/usr/bin/env node
// Contrôle automatique du référencement d'un site déployé ou local
// (cahier des charges §10 et §16, CLAUDE.md §3centquatorzequadragies).
//
//   node scripts/seo-check.mjs [URL de base] [en-tête Host]
//   npm run test:seo -- https://goldenfantastic.com
//   npm run test:seo -- http://127.0.0.1:3100 goldenfantastic.localhost:3100
//
// Sans argument : NEXT_PUBLIC_SITE_URL (lancé par scripts/deploy.sh avec
// --env-file=.env). Parcourt toutes les pages du sitemap et vérifie :
//   - réponse 200 ;
//   - UN SEUL bloc JSON-LD, JSON valide, @graph, @id uniques, propriétés
//     obligatoires par type, aucune offre à prix nul ;
//   - balise canonical présente, hreflang cohérents (x-default, URL absolues) ;
//   - aucun « ** » de Markdown visible ;
//   - titre ≤ 60 et description ≤ 155 caractères (avertissement seulement).
// Code de sortie 1 s'il y a au moins une erreur (les avertissements ne
// comptent pas).
import http from "node:http";
import https from "node:https";

const base = (process.argv[2] || process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/+$/, "");
const hostHeader = process.argv[3] || null;

function fetchText(url, attempt = 1) {
  return new Promise((resolve, reject) => {
    const target = new URL(url);
    const client = target.protocol === "https:" ? https : http;
    const req = client.get(
      target,
      { headers: { ...(hostHeader ? { host: hostHeader } : {}), "user-agent": "GoldenFantastic-SEO-Check/1.0" }, timeout: 20000 },
      (res) => {
        let body = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => (body += chunk));
        res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, body }));
      }
    );
    req.on("timeout", () => req.destroy(new Error("délai dépassé")));
    req.on("error", (err) => {
      // Juste après un redémarrage (deploy.sh), l'application peut mettre
      // quelques secondes à répondre.
      if (attempt < 6) setTimeout(() => fetchText(url, attempt + 1).then(resolve, reject), 5000);
      else reject(err);
    });
  });
}

const pick = (html, re) => [...html.matchAll(re)].map((m) => m[1]);
const decode = (s) =>
  String(s || "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");

const REQUIRED = {
  TravelAgency: ["name", "url"],
  WebSite: ["url", "name"],
  WebPage: ["url", "inLanguage"],
  ItemPage: ["url", "inLanguage"],
  CollectionPage: ["url", "inLanguage"],
  AboutPage: ["url", "inLanguage"],
  ContactPage: ["url", "inLanguage"],
  BreadcrumbList: ["itemListElement"],
  TouristTrip: ["name", "url", "provider"],
  FAQPage: ["mainEntity"],
  NewsArticle: ["headline", "url", "publisher"],
  ItemList: ["itemListElement"],
  VideoObject: ["name", "thumbnailUrl", "uploadDate", "embedUrl"],
  Product: ["name", "aggregateRating"],
};

function checkPage(path, html) {
  const errors = [];
  const warnings = [];

  const blocks = pick(html, /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g);
  if (blocks.length !== 1) errors.push(`${blocks.length} blocs JSON-LD (1 attendu)`);
  for (const raw of blocks) {
    let data;
    try {
      data = JSON.parse(raw);
    } catch (err) {
      errors.push(`JSON-LD invalide : ${err.message}`);
      continue;
    }
    const graph = data["@graph"];
    if (!Array.isArray(graph) || graph.length === 0) {
      errors.push("JSON-LD sans @graph");
      continue;
    }
    const ids = graph.map((n) => n["@id"]).filter(Boolean);
    const duplicates = ids.filter((id, i) => ids.indexOf(id) !== i);
    if (duplicates.length) errors.push(`@id en double : ${[...new Set(duplicates)].join(", ")}`);
    for (const node of graph) {
      const types = [].concat(node["@type"] || []);
      for (const type of types) {
        for (const prop of REQUIRED[type] || []) {
          const value = node[prop];
          if (value == null || (Array.isArray(value) && value.length === 0)) {
            errors.push(`${type} sans « ${prop} »`);
          }
        }
      }
      if (types.includes("TouristTrip") || types.includes("Product")) {
        for (const offer of [].concat(node.offers || [])) {
          if (!(Number(offer.price) > 0)) errors.push("offre à prix nul ou absent");
          if (!offer.priceCurrency) errors.push("offre sans devise");
        }
      }
      if (types.includes("Product")) {
        const rating = node.aggregateRating || {};
        if (!(Number(rating.reviewCount) > 0)) errors.push("Product : aggregateRating sans avis");
        if (!(Number(rating.ratingValue) >= 1 && Number(rating.ratingValue) <= 5)) errors.push("Product : note hors de 1 à 5");
      }
      if (types.includes("BreadcrumbList")) {
        (node.itemListElement || []).forEach((item, i) => {
          if (item.position !== i + 1) errors.push("fil d'Ariane : positions non consécutives");
        });
      }
    }
  }

  const canonical = pick(html, /<link rel="canonical" href="([^"]*)"/g)[0];
  if (!canonical) errors.push("balise canonical absente");
  else if (!/^https?:\/\//.test(canonical)) errors.push(`canonical non absolue : ${canonical}`);

  const hreflangs = [...html.matchAll(/<link rel="alternate" hrefLang="([^"]*)" href="([^"]*)"/g)];
  if (hreflangs.length > 0) {
    if (!hreflangs.some((m) => m[1] === "x-default")) errors.push("hreflang sans x-default");
    if (hreflangs.some((m) => !/^https?:\/\//.test(m[2]))) errors.push("hreflang avec URL non absolue");
  }

  const visible = html.replace(/<script[\s\S]*?<\/script>/g, "").replace(/<[^>]+>/g, " ");
  if (visible.includes("**")) errors.push("Markdown « ** » visible dans la page");

  const title = decode(pick(html, /<title>([^<]*)<\/title>/g)[0]);
  const description = decode(pick(html, /<meta name="description" content="([^"]*)"/g)[0]);
  if (!title) errors.push("titre absent");
  else if ([...title].length > 60) warnings.push(`titre de ${[...title].length} caractères (> 60)`);
  if (!description) warnings.push("meta description absente");
  else if ([...description].length > 155) warnings.push(`description de ${[...description].length} caractères (> 155)`);
  if (!/<meta property="og:title"/.test(html)) warnings.push("og:title absent");

  return { errors, warnings };
}

const sitemap = await fetchText(`${base}/sitemap.xml`);
if (sitemap.status !== 200) {
  console.error(`Sitemap inaccessible (${sitemap.status}) sur ${base}`);
  process.exit(1);
}
const locs = pick(sitemap.body, /<loc>([^<]+)<\/loc>/g).map(decode);
// Les URL du sitemap portent le domaine public : on garde leur chemin et on
// interroge le serveur visé (utile en local).
const paths = [...new Set(locs.map((loc) => new URL(loc).pathname + new URL(loc).search))];

let errorCount = 0;
let warningCount = 0;
console.log(`Contrôle SEO de ${base} — ${paths.length} pages du sitemap\n`);
for (const path of paths) {
  const res = await fetchText(`${base}${path}`);
  if (res.status !== 200) {
    console.log(`✗ ${path} → HTTP ${res.status}`);
    errorCount++;
    continue;
  }
  const { errors, warnings } = checkPage(path, res.body);
  errorCount += errors.length;
  warningCount += warnings.length;
  const mark = errors.length ? "✗" : warnings.length ? "!" : "✓";
  console.log(`${mark} ${path}`);
  errors.forEach((e) => console.log(`    erreur : ${e}`));
  warnings.forEach((w) => console.log(`    avertissement : ${w}`));
}

// Une adresse inconnue doit répondre un vrai 404 (pas de « soft 404 »).
const missing = await fetchText(`${base}/page-inexistante-controle-seo`);
if (missing.status !== 404) {
  console.log(`✗ page inexistante → HTTP ${missing.status} (404 attendu)`);
  errorCount++;
}

console.log(`\n${errorCount} erreur(s), ${warningCount} avertissement(s).`);
process.exit(errorCount > 0 ? 1 : 0);
