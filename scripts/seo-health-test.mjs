import { setScriptAgencyId } from "../lib/agencyContext.js";
import * as pa from "../lib/programsAdmin.js";
import * as hotels from "../lib/hotels.js";
import * as airlines from "../lib/airlines.js";
import * as faqs from "../lib/programFaqs.js";
import * as ra from "../lib/roomAssignment.js";
import * as media from "../lib/programMedia.js";
import * as reviews from "../lib/programReviews.js";
import * as authors from "../lib/authors.js";
import * as guides from "../lib/guides.js";
import * as glossary from "../lib/glossary.js";
import * as knowledge from "../lib/ai/knowledge.js";
import * as redirects from "../lib/redirects.js";
import * as ct from "../lib/contentTranslations.js";
import { getSeoHealth } from "../lib/seoHealth.js";
import { getPool } from "../lib/db.js";

// Santé SEO (référencement, vague 2C — CLAUDE.md §3centdixneufquadragies) :
// chaque contrôle est déclenché par une donnée de test dans une agence
// TEMPORAIRE, puis résolu ; les indicateurs suivent. Tout est supprimé à la
// fin.
//   npm run test:seo-health
const pool = getPool();
const q = async (sql, params = []) => (await pool.query(sql, params))[0];
const created = await q("INSERT INTO agencies (name, subdomain) VALUES (?, ?)", ["Agence santé SEO", `seo-sante-${Date.now() % 100000}`]);
const AGENCY = created.insertId;
setScriptAgencyId(AGENCY);

async function cleanup() {
  const tables = (await q("SELECT table_name n FROM information_schema.columns WHERE table_schema=DATABASE() AND column_name='agency_id'")).map((r) => r.n);
  const conn = await pool.getConnection();
  try {
    await conn.query("SET FOREIGN_KEY_CHECKS=0");
    for (const t of tables) await conn.query(`DELETE FROM ${t} WHERE agency_id = ?`, [AGENCY]);
    await conn.query("DELETE FROM agencies WHERE id = ?", [AGENCY]);
    await conn.query("SET FOREIGN_KEY_CHECKS=1");
  } finally {
    conn.release();
  }
}

let failures = 0;
const ok = (cond, label) => {
  console.log(`${cond ? "PASS" : "FAIL"}  ${label}`);
  if (!cond) failures += 1;
};
const all = (health) => health.sections.flatMap((s) => s.issues);
const has = (health, message, subject) => all(health).some((i) => i.message === message && (!subject || i.subject === subject));
const indicator = (health, key) => health.indicators.find((i) => i.key === key);
const today = new Date().toISOString().slice(0, 10);
const longAgo = "2025-01-01";
const inDays = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
const words = (n) => Array.from({ length: n }, (_, i) => `mot${i}`).join(" ");

try {
  // --- Programme : déclencheurs ---
  const programId = await pa.createProgram({
    title: "Programme santé SEO", slug: "programme-sante", family: "omra_hajj", programType: "omra", isPublished: true,
    contentLocale: "fr", shortDescription: "Description du programme de test.",
    metaTitle: "Un titre beaucoup trop long pour Google, qui dépasse soixante caractères",
  });
  // Les champs de la fiche ne sont écrits que par la mise à jour (carte « Contenu de la fiche »).
  await pa.updateProgram(programId, { formalities: "Passeport valide.", formalitiesVerifiedAt: longAgo });
  let h = await getSeoHealth(AGENCY);
  ok(has(h, "Aucun départ ouvert : la fiche affiche « Départ terminé »"), "programme sans départ ouvert signalé");
  ok(has(h, "Version arabe manquante", "Programme santé SEO"), "version arabe manquante signalée");
  ok(has(h, "Titre (version française) de {length} caractères dans Google ({max} max.) : saisir un « Meta title » plus court"), "titre trop long signalé");
  ok(has(h, "Aucune description pour Google (version française) : une description automatique est utilisée"), "description absente signalée (information)");
  ok(has(h, "Formalités vérifiées le {date} : à revérifier (plus de 6 mois)"), "formalités vérifiées il y a plus de 6 mois signalées");
  ok(has(h, "Fiche : {score}/{total} blocs — à compléter : {blocks}"), "blocs manquants signalés");
  ok(indicator(h, "fiches").value === 0 && indicator(h, "fiches").target === 1, "indicateur : 0 fiche complète sur 1");

  const tripId = await pa.createTrip(programId, {
    referenceCode: "SANTE-1", departureDate: inDays(30), returnDate: inDays(44), status: "ouvert", totalSeats: 20,
  });
  h = await getSeoHealth(AGENCY);
  ok(has(h, "Départ {ref} : prix à 0 (le site affiche « Prix sur demande »)"), "prix à 0 sur un départ ouvert signalé (erreur)");
  ok(!has(h, "Aucun départ ouvert : la fiche affiche « Départ terminé »"), "départ ouvert : plus de signalement « départ terminé »");

  // --- Programme : tout résoudre (fiche 10/10) ---
  await pa.updateProgram(programId, {
    metaTitle: "Omra santé SEO",
    metaDescription: "Une description de test d'une longueur raisonnable pour Google.",
    formalitiesVerifiedAt: today,
    itineraryDays: [{ title: "Jour d'arrivée", description: "Accueil." }],
    includedItems: "Vol\nHôtel",
    excludedItems: "Dépenses personnelles",
    bookingConditions: "Acompte de 30 %.",
  });
  await ct.setTranslations("program", programId, {
    ar: { title: "برنامج", shortDescription: "وصف", metaTitle: "عمرة", metaDescription: "وصف قصير لمحرك البحث." },
  }, { baseLocale: "fr" });
  const airlineId = await airlines.createAirline({ name: "Compagnie santé" });
  await pa.updateTrip(tripId, { priceDouble: 20000, priceTriple: 18000, priceQuadruple: 17000, priceQuintuple: 16000, airlineId, baggageAllowance: "2 × 23 kg" });
  const hotelId = await hotels.createHotel({ name: "Hôtel santé", city: "Makka" });
  await ra.addTripHotel(tripId, hotelId, inDays(31), inDays(40));
  for (let i = 0; i < 5; i++) await faqs.createFaq(programId, { question: `Question ${i} ?`, answer: "Réponse." });
  for (let i = 0; i < 3; i++) await media.createProgramMedia(programId, { kind: "photo", url: `/uploads/agencies/${AGENCY}/programs/p${i}.jpg` });
  await reviews.createReview(programId, { authorName: "Client", rating: 5, body: "Très bien.", reviewDate: today, consentGiven: true, isPublished: true }, null);
  h = await getSeoHealth(AGENCY);
  const programIssues = h.sections.find((s) => s.key === "programmes").issues;
  ok(programIssues.length === 0, `programme : plus aucun problème (${programIssues.map((i) => i.message + " " + JSON.stringify(i.params)).join(" | ") || "aucun"})`);
  ok(indicator(h, "fiches").value === 1, "indicateur : 1 fiche complète sur 1");

  // --- Guides ---
  const writer = await authors.createAuthor({ name: "Auteur santé" });
  const imam = await authors.createAuthor({ name: "Référent santé", isReligiousReferent: true });
  const guideId = await guides.createGuide({
    title: "Guide santé", slug: "guide-sante", pillar: "omra", isReligious: true, reviewerId: imam, status: "publie",
    excerpt: "Un guide court.", contentLocale: "fr", reviewedAt: longAgo,
  });
  // Relecteur retiré après publication (cas que le formulaire n'autorise pas).
  await q("UPDATE guides SET reviewer_id = NULL WHERE id = ? AND agency_id = ?", [guideId, AGENCY]);
  h = await getSeoHealth(AGENCY);
  ok(has(h, "Guide religieux sans relecteur référent religieux"), "guide religieux sans relecteur signalé (erreur)");
  ok(has(h, "Aucun auteur : l'encadré auteur n'est pas affiché"), "guide sans auteur signalé");
  ok(has(h, "Relu le {date} : à relire (plus de 6 mois)"), "guide relu il y a plus de 6 mois signalé");
  ok(has(h, "Texte court : {words} mots ({min} recommandés)"), "texte trop court signalé");
  ok(has(h, "Version arabe manquante", "Guide santé"), "version arabe du guide manquante signalée");
  ok(indicator(h, "guides").value === 1 && indicator(h, "guides").target === 20, "indicateur : 1 guide sur 20");
  await guides.updateGuide(guideId, {
    title: "Guide santé", slug: "guide-sante", pillar: "omra", isReligious: true, reviewerId: imam, authorId: writer,
    status: "publie", excerpt: "Un guide complet.", content: words(320), contentLocale: "fr", reviewedAt: today,
  });
  await ct.setTranslations("guide", guideId, { ar: { title: "دليل", excerpt: "ملخص" } }, { baseLocale: "fr" });
  h = await getSeoHealth(AGENCY);
  ok(h.sections.find((s) => s.key === "guides").issues.length === 0, "guide : plus aucun problème");

  // --- Lexique et banque de questions ---
  await glossary.createTerm({ termFr: "Ihram", definitionFr: "État de sacralisation.", slug: "ihram", status: "publie" });
  await knowledge.createKnowledge({ question: "Question agent ?", answerFr: "Réponse.", status: "publie" }, null);
  h = await getSeoHealth(AGENCY);
  ok(has(h, "{count} terme(s) sans version arabe : {names}"), "terme sans version arabe signalé");
  ok(has(h, "{count} question(s) publiée(s) sans réponse en arabe : {names}"), "question sans réponse arabe signalée");
  ok(has(h, "{count} question(s) publiée(s) connue(s) seulement de l'agent WhatsApp : choisir une « Page du site » pour les afficher"), "question absente du site signalée (information)");
  ok(has(h, "{count} question(s) affichée(s) sur ce pilier ({min} à 15 recommandées)", "Pilier Omra"), "pilier Omra avec moins de 10 questions signalé");
  ok(!all(h).some((i) => i.subject === "Pilier Hajj"), "pilier Hajj sans programme : pas de signalement");
  ok(indicator(h, "termes").value === 1 && indicator(h, "questions").value === 0, "indicateurs : 1 terme, 0 question affichée");
  const terms = await glossary.listAllTerms();
  await glossary.updateTerm(terms[0].id, { termFr: "Ihram", termAr: "الإحرام", definitionFr: "État de sacralisation.", definitionAr: "حالة الإحرام.", slug: "ihram", status: "publie" });
  const [agentQuestion] = (await knowledge.listKnowledge()).filter((k) => k.question === "Question agent ?");
  await knowledge.updateKnowledge(agentQuestion.id, { question: "Question agent ?", answerFr: "Réponse.", answerAr: "جواب.", status: "publie", sitePage: "faq" });
  for (let i = 0; i < 10; i++) {
    await knowledge.createKnowledge({ question: `Omra ${i} ?`, answerFr: "Réponse.", answerAr: "جواب.", status: "publie", sitePage: "omra" }, null);
  }
  h = await getSeoHealth(AGENCY);
  ok(h.sections.find((s) => s.key === "contenus").issues.length === 0, "lexique et banque : plus aucun problème");
  ok(indicator(h, "questions").value === 11, "indicateur : 11 questions affichées sur le site");

  // --- Technique ---
  await q("INSERT INTO seo_indexnow_pings (agency_id, url_count, urls, status, message) VALUES (?, 1, '[]', 'echec', 'HTTP 422')", [AGENCY]);
  await redirects.createRedirect({ fromPath: "/omra/ancien", toPath: "/omra/jamais-publie" });
  h = await getSeoHealth(AGENCY);
  ok(has(h, "{count} signalement(s) aux moteurs en échec sur 7 jours"), "échec IndexNow signalé");
  ok(has(h, "Redirige vers {target}, qui n'est pas publié (le visiteur arrive sur une page introuvable)"), "redirection vers un contenu non publié signalée");
  await q("DELETE FROM seo_indexnow_pings WHERE agency_id = ?", [AGENCY]);
  await q("UPDATE redirects SET to_path = '/omra/programme-sante' WHERE agency_id = ?", [AGENCY]);
  h = await getSeoHealth(AGENCY);
  ok(h.sections.find((s) => s.key === "technique").issues.length === 0, "technique : plus aucun problème");
  ok(h.counts.erreur === 0 && h.counts.avertissement === 0 && h.counts.info === 0, "plus aucun problème nulle part");

  // --- Isolation : l'agence 1 ne voit rien de l'agence de test ---
  setScriptAgencyId(1);
  const own = await getSeoHealth(1);
  ok(!all(own).some((i) => ["Programme santé SEO", "Omra santé SEO", "Guide santé"].includes(i.subject)), "agence 1 : aucun problème de l'agence de test");
} catch (err) {
  console.error("ERREUR", err);
  failures += 1;
} finally {
  await cleanup();
  await pool.end();
}
console.log(failures === 0 ? "\nTOUS LES CONTRÔLES PASSENT" : `\n${failures} ÉCHEC(S)`);
process.exit(failures ? 1 : 0);
