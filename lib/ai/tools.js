import { query } from "../db";
import { getProgramsByFamily, getProgramBySlug, getOpenTripsForProgram } from "../programs";
import { listPublishedFaqsForProgram } from "../programFaqs";
import { listTiersForTrip } from "../tripHotelTiers";
import { getAgencySettings } from "../agencySettings";
import { siteBaseUrl } from "../i18n/seo";
import { getAgencyById } from "../agencies";
import { getCityByIata } from "../airports";
import { maskIdentifier } from "./redact";
import { emitCrmEvent } from "../events";

// Outils de l'agent IA (exigence CL-03). Chaque outil s'appuie sur les
// fonctions CRM EXISTANTES (lib/programs.js...), toujours dans le contexte de
// l'agence de la conversation (runWithAgency, lib/agencyContext.js) : l'agent
// ne peut jamais lire une autre agence. Les prix/dates/places viennent
// exclusivement d'ici (IA-03) — le prompt interdit d'en inventer.
// Les effets de bord (transfert, envoi de médias, tâches) ne sont pas
// exécutés directement : ils sont RENDUS dans ctx.effects et appliqués par
// lib/whatsapp/aiReply.js une fois le tour de l'agent terminé — ce qui permet
// au bac à sable de tout simuler sans rien envoyer.

export const TRANSFER_REASONS = [
  "intention_achat",
  "negociation",
  "reclamation",
  "cas_particulier",
  "demande_humain",
  "question_religieuse",
  "echec_ia",
  "urgence",
  "recu_paiement",
];

export const TOOL_DEFINITIONS = {
  chercher_programmes: {
    name: "chercher_programmes",
    description:
      "Liste les programmes publiés de l'agence avec leurs prochains départs ouverts (dates, prix « à partir de », places restantes, ville de départ). À utiliser dès qu'un client s'intéresse à une Omra, un Hajj ou un voyage organisé, et avant de citer tout prix ou toute date.",
    input_schema: {
      type: "object",
      properties: {
        famille: {
          type: "string",
          enum: ["omra_hajj", "voyage_organise", "tous"],
          description: "omra_hajj pour Omra/Hajj, voyage_organise pour les séjours touristiques, tous si inconnu.",
        },
        mois: { type: "string", description: "Mois de départ souhaité au format AAAA-MM, si le client l'a précisé." },
        ville_depart: { type: "string", description: "Ville ou code IATA de départ au Maroc, si précisé (ex. Casablanca, RAK)." },
      },
      required: ["famille"],
      additionalProperties: false,
    },
  },
  details_programme: {
    name: "details_programme",
    description:
      "Détail complet d'un programme (identifié par son slug renvoyé par chercher_programmes) : description, chaque départ avec ses prix par type de chambre ou par formule d'hébergement, hôtels et distance au Haram, restauration, compagnie aérienne, questions fréquentes.",
    input_schema: {
      type: "object",
      properties: { slug: { type: "string", description: "Slug du programme." } },
      required: ["slug"],
      additionalProperties: false,
    },
  },
  creer_ou_maj_prospect: {
    name: "creer_ou_maj_prospect",
    description:
      "Enregistre dans le CRM les informations de qualification obtenues pendant la conversation. N'envoie que les champs connus ; peut être appelé plusieurs fois.",
    input_schema: {
      type: "object",
      properties: {
        nom: { type: "string" },
        langue: { type: "string", enum: ["darija_latin", "darija_arabe", "ar", "fr", "en"] },
        type_voyage: { type: "string", description: "omra, hajj, voyage organisé (préciser la destination)..." },
        mois: { type: "string", description: "Mois souhaité (AAAA-MM ou texte, ex. « Ramadan 2027 »)." },
        personnes: { type: "integer", minimum: 1 },
        chambre: { type: "string", enum: ["double", "triple", "quadruple", "quintuple", "indifferent"] },
        budget: { type: "string" },
        ville_depart: { type: "string" },
        programme_slug: { type: "string" },
      },
      additionalProperties: false,
    },
  },
  etat_dossier: {
    name: "etat_dossier",
    description:
      "État du ou des dossiers du client (inscription, paiements, visa, chambre, billet) — uniquement si son numéro WhatsApp correspond à un voyageur inscrit. Ne jamais divulguer un dossier à quelqu'un d'autre.",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
  },
  enregistrer_document: {
    name: "enregistrer_document",
    description:
      "Classe le dernier document (photo ou PDF) envoyé par le client après l'avoir examiné : passeport, CIN, photo d'identité, reçu de paiement. Pour un reçu, indique le montant, la date et la banque lus : une tâche de validation est créée pour la comptabilité et la conversation est transférée. Si le document est illisible, mets lisible=false puis demande une nouvelle photo nette.",
    input_schema: {
      type: "object",
      properties: {
        type_document: { type: "string", enum: ["passeport", "cin", "photo", "recu", "autre"] },
        lisible: { type: "boolean" },
        montant: { type: "number", description: "Montant lu sur le reçu." },
        devise: { type: "string" },
        date: { type: "string", description: "Date lue sur le reçu (AAAA-MM-JJ si possible)." },
        banque: { type: "string" },
        reference: { type: "string" },
        remarque: { type: "string", description: "Ce qui pose problème (flou, reflet, page coupée...)." },
      },
      required: ["type_document", "lisible"],
      additionalProperties: false,
    },
  },
  demander_humain: {
    name: "demander_humain",
    description:
      "Transfère la conversation à un conseiller humain. Le résultat indique quoi dire au client (délai ou horaires). Après cet appel, n'écris qu'un court message final au client.",
    input_schema: {
      type: "object",
      properties: {
        motif: { type: "string", enum: TRANSFER_REASONS },
        resume: { type: "string", description: "Résumé en une ou deux phrases pour le conseiller." },
      },
      required: ["motif", "resume"],
      additionalProperties: false,
    },
  },
  planifier_rappel: {
    name: "planifier_rappel",
    description: "Crée une tâche de rappel téléphonique pour un conseiller, quand le client préfère être appelé.",
    input_schema: {
      type: "object",
      properties: {
        quand: { type: "string", description: "Moment souhaité par le client (texte libre, ex. « demain après 17h »)." },
        telephone: { type: "string", description: "Numéro à appeler s'il diffère du numéro WhatsApp." },
        motif: { type: "string" },
      },
      required: ["quand", "motif"],
      additionalProperties: false,
    },
  },
  envoyer_brochure: {
    name: "envoyer_brochure",
    description: "Envoie au client l'image de présentation d'un programme avec le lien vers sa page détaillée.",
    input_schema: {
      type: "object",
      properties: { slug: { type: "string" } },
      required: ["slug"],
      additionalProperties: false,
    },
  },
  proposer_choix: {
    name: "proposer_choix",
    description:
      "Envoie au client une question avec des choix cliquables (boutons WhatsApp, ou liste au-delà de 3 choix) — à préférer aux menus numérotés, par exemple pour le type de voyage, le mois ou le type de chambre. Le message part juste avant ta réponse : n'y répète pas la question.",
    input_schema: {
      type: "object",
      properties: {
        question: { type: "string", description: "Question posée au client, dans sa langue." },
        options: {
          type: "array",
          minItems: 2,
          maxItems: 10,
          items: { type: "object", properties: { titre: { type: "string", description: "20 caractères maximum." } }, required: ["titre"], additionalProperties: false },
        },
      },
      required: ["question", "options"],
      additionalProperties: false,
    },
  },
  envoyer_localisation: {
    name: "envoyer_localisation",
    description: "Envoie au client l'adresse de l'agence et son lien de localisation (Google Maps).",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
  },
};

export function toolDefinitionsFor(enabled) {
  // Ordre FIXE (celui de TOOL_DEFINITIONS) : une liste d'outils qui change
  // d'ordre invaliderait le cache du prompt.
  return Object.keys(TOOL_DEFINITIONS)
    .filter((name) => enabled.includes(name))
    .map((name) => TOOL_DEFINITIONS[name]);
}

async function publicBaseUrl(agencyId) {
  const agency = await getAgencyById(agencyId);
  return siteBaseUrl(agency?.subdomain);
}

function programUrl(base, program) {
  const prefix = program.family === "voyage_organise" ? "/fr/voyages-organises" : "/fr/omra-hajj";
  return `${base}${prefix}/${program.slug}`;
}

const money = (v, currency = "MAD") => (v == null ? null : `${Number(v).toLocaleString("fr-FR").replace(/[  ]/g, " ")} ${currency}`);

async function chercherProgrammes(input, ctx) {
  const families = input.famille === "tous" || !input.famille ? ["omra_hajj", "voyage_organise"] : [input.famille];
  const base = await publicBaseUrl(ctx.agencyId);
  const results = [];
  for (const family of families) {
    const programs = await getProgramsByFamily(family, { agencyId: ctx.agencyId });
    for (const p of programs) {
      const trips = await getOpenTripsForProgram(p.id, ctx.agencyId, "fr");
      let departs = trips;
      if (input.mois && /^\d{4}-\d{2}$/.test(input.mois)) departs = departs.filter((t) => String(t.departure_date).startsWith(input.mois));
      if (input.ville_depart) {
        const v = input.ville_depart.toLowerCase();
        departs = departs.filter((t) => {
          const city = (getCityByIata(t.origin_iata)?.city || "").toLowerCase();
          return String(t.origin_iata || "").toLowerCase() === v || (city && (city.includes(v) || v.includes(city)));
        });
      }
      if (departs.length === 0 && (input.mois || input.ville_depart)) continue;
      results.push({
        titre: p.title,
        slug: p.slug,
        famille: family,
        resume: p.short_description || null,
        lien: programUrl(base, { ...p, family }),
        departs: departs.slice(0, 6).map((t) => ({
          date_depart: t.departure_date,
          date_retour: t.return_date,
          ville_depart: getCityByIata(t.origin_iata)?.city || t.origin_iata,
          destination: t.destination_country,
          prix_a_partir_de: money(t.starting_price, t.currency),
          places_restantes: t.total_seats > 0 ? Math.max(0, Number(t.seats_remaining)) : "non communiqué",
        })),
      });
    }
  }
  if (results.length === 0) return { programmes: [], remarque: "Aucun programme ouvert ne correspond. Ne rien inventer : proposer un conseiller." };
  return { programmes: results };
}

async function detailsProgramme(input, ctx) {
  const program = await getProgramBySlug(String(input.slug || ""), ctx.agencyId);
  if (!program) return { erreur: "Programme introuvable. Utiliser chercher_programmes pour obtenir un slug valide." };
  const base = await publicBaseUrl(ctx.agencyId);
  const trips = await getOpenTripsForProgram(program.id, ctx.agencyId, "fr");
  const faqs = await listPublishedFaqsForProgram(program.id, ctx.agencyId);
  const departs = [];
  for (const t of trips) {
    const [full] = await query(
      `SELECT price_double, price_triple, price_quadruple, price_quintuple, currency FROM trips WHERE id = ? AND agency_id = ?`,
      [t.id, ctx.agencyId]
    );
    const tiers = await listTiersForTrip(t.id);
    const hotels = await query(
      `SELECT h.name, h.city, h.star_rating, h.landmark_name, h.landmark_distance_m, h.board_basis, th.check_in_date, th.check_out_date
       FROM trip_hotels th JOIN hotels h ON h.id = th.hotel_id AND h.agency_id = th.agency_id
       WHERE th.trip_id = ? AND th.agency_id = ? ORDER BY th.check_in_date`,
      [t.id, ctx.agencyId]
    );
    const flatPrices = full
      ? Object.fromEntries(
          [["double", full.price_double], ["triple", full.price_triple], ["quadruple", full.price_quadruple], ["quintuple", full.price_quintuple]]
            .filter(([, v]) => Number(v) > 0)
            .map(([k, v]) => [k, money(v, full.currency)])
        )
      : {};
    departs.push({
      date_depart: t.departure_date,
      date_retour: t.return_date,
      ville_depart: getCityByIata(t.origin_iata)?.city || t.origin_iata,
      compagnie: t.airline_name || null,
      places_restantes: t.total_seats > 0 ? Math.max(0, Number(t.seats_remaining)) : "non communiqué",
      prix_par_personne_selon_chambre: tiers.length === 0 ? flatPrices : undefined,
      formules_hebergement:
        tiers.length > 0
          ? tiers.map((tier) => ({
              formule: tier.label,
              hotel_mecque: tier.makkah_hotel_name || null,
              hotel_medine: tier.madinah_hotel_name || null,
              prix_par_personne: Object.fromEntries((tier.prices || []).map((p) => [p.room_type, money(p.price_per_person, full?.currency)])),
            }))
          : undefined,
      hotels: hotels.map((h) => ({
        nom: h.name,
        ville: h.city,
        etoiles: h.star_rating,
        repere: h.landmark_name ? `${h.landmark_distance_m} m de ${h.landmark_name}` : null,
        restauration: h.board_basis,
        du: h.check_in_date,
        au: h.check_out_date,
      })),
      restauration: (t.meal_offers || []).map((o) => `${o.title}${o.description ? ` : ${o.description}` : ""}`),
    });
  }
  return {
    titre: program.title,
    lien: programUrl(base, program),
    description: program.short_description || null,
    description_complete: program.full_description ? String(program.full_description).slice(0, 3000) : null,
    departs,
    questions_frequentes: faqs.slice(0, 15).map((f) => ({ question: f.question, reponse: f.answer })),
    remarque: departs.length === 0 ? "Aucun départ ouvert actuellement pour ce programme." : undefined,
  };
}

async function creerOuMajProspect(input, ctx) {
  const current = ctx.contact?.qualification
    ? typeof ctx.contact.qualification === "string"
      ? JSON.parse(ctx.contact.qualification)
      : ctx.contact.qualification
    : {};
  const { nom, langue, ...fields } = input;
  const qualification = { ...current, ...Object.fromEntries(Object.entries(fields).filter(([, v]) => v != null && v !== "")) };
  const qualified = Boolean(qualification.mois && qualification.personnes && qualification.chambre);
  if (ctx.contact) ctx.contact.qualification = qualification;
  if (!ctx.sandbox && ctx.contact?.id) {
    await query(
      `UPDATE wa_contacts SET qualification = ?, language = COALESCE(?, language),
         profile_name = COALESCE(profile_name, ?),
         stage = CASE WHEN stage = 'prospect' AND ? THEN 'qualifie' ELSE stage END
       WHERE id = ? AND agency_id = ?`,
      [JSON.stringify(qualification), langue || null, nom || null, qualified ? 1 : 0, ctx.contact.id, ctx.agencyId]
    );
  }
  if (langue) ctx.effects.language = langue;
  // Prospect devenu « qualifié » : déclencheur interne (prospect chaud, DC-10).
  if (qualified && !ctx.sandbox && ctx.contact?.id && ctx.contact.stage === "prospect") {
    ctx.contact.stage = "qualifie";
    await emitCrmEvent("prospect_qualifie", { agencyId: ctx.agencyId, contactId: ctx.contact.id });
  }
  return { enregistre: true, qualification, prospect_qualifie: qualified };
}

async function etatDossier(_input, ctx) {
  const travelerId = ctx.contact?.traveler_id;
  if (!travelerId) {
    return { dossier: null, remarque: "Ce numéro WhatsApp ne correspond à aucun voyageur inscrit. Ne donner aucune information de dossier ; proposer un conseiller si besoin." };
  }
  const rows = await query(
    `SELECT r.id, r.status, r.visa_status, r.total_due, r.group_id, rg.label AS group_label, rg.total_due AS group_total_due,
       t.departure_date, t.return_date, t.pnr, p.title AS program_title, tr.full_name, tr.passport_number, tr.passport_expiry_date
     FROM registrations r
     JOIN travelers tr ON tr.id = r.traveler_id AND tr.agency_id = r.agency_id
     JOIN trips t ON t.id = r.trip_id AND t.agency_id = r.agency_id
     JOIN programs p ON p.id = t.program_id AND p.agency_id = r.agency_id
     LEFT JOIN registration_groups rg ON rg.id = r.group_id AND rg.agency_id = r.agency_id
     WHERE r.agency_id = ? AND r.traveler_id = ? AND r.status <> 'annule'
     ORDER BY t.departure_date DESC LIMIT 5`,
    [ctx.agencyId, travelerId]
  );
  const dossiers = [];
  for (const r of rows) {
    const [paid] = r.group_id
      ? await query(`SELECT COALESCE(SUM(amount), 0) AS paid FROM payments WHERE group_id = ? AND agency_id = ?`, [r.group_id, ctx.agencyId])
      : await query(`SELECT COALESCE(SUM(amount), 0) AS paid FROM payments WHERE registration_id = ? AND agency_id = ?`, [r.id, ctx.agencyId]);
    const due = Number(r.group_id ? r.group_total_due : r.total_due) || 0;
    const rooms = await query(
      `SELECT rra.city, h.name AS hotel, rm.room_number FROM registration_room_assignments rra
       JOIN rooms rm ON rm.id = rra.room_id AND rm.agency_id = rra.agency_id
       JOIN trip_hotels th ON th.id = rm.trip_hotel_id AND th.agency_id = rra.agency_id
       JOIN hotels h ON h.id = th.hotel_id AND h.agency_id = rra.agency_id
       WHERE rra.registration_id = ? AND rra.agency_id = ?`,
      [r.id, ctx.agencyId]
    );
    const tickets = await query(
      `SELECT fb.status, fbp.ticket_number FROM flight_booking_passengers fbp
       JOIN flight_bookings fb ON fb.id = fbp.flight_booking_id AND fb.agency_id = ?
       WHERE fbp.registration_id = ? AND fbp.agency_id = ?`,
      [ctx.agencyId, r.id, ctx.agencyId]
    );
    dossiers.push({
      voyageur: r.full_name,
      programme: r.program_title,
      depart: r.departure_date,
      retour: r.return_date,
      statut_inscription: r.status,
      statut_visa: r.visa_status,
      groupe: r.group_label || null,
      montant_du: money(due),
      montant_paye: money(paid?.paid || 0),
      reste_a_payer: money(Math.max(0, due - Number(paid?.paid || 0))),
      passeport: r.passport_number ? `enregistré (${maskIdentifier(r.passport_number)}), expire le ${r.passport_expiry_date || "?"}` : "non renseigné",
      hebergement: rooms.map((x) => `${x.city} : ${x.hotel}, chambre ${x.room_number}`),
      billet: tickets.some((t) => t.status === "confirme") ? "émis" : r.pnr ? "réservation groupe en cours" : "pas encore émis",
    });
  }
  return { dossiers };
}

async function enregistrerDocument(input, ctx) {
  const media = ctx.latestMedia;
  if (!media) return { erreur: "Aucun document reçu récemment dans cette conversation." };
  if (!ctx.sandbox) {
    await query(`UPDATE wa_media SET doc_type = ? WHERE id = ? AND agency_id = ?`, [input.type_document, media.id, ctx.agencyId]);
  }
  if (!input.lisible) {
    return { enregistre: true, lisible: false, consigne: "Demander poliment une nouvelle photo nette, bien éclairée, document entier, sans reflet." };
  }
  if (input.type_document === "recu") {
    ctx.effects.tasks.push({
      type: "validation_paiement",
      team: "comptabilite",
      mediaId: media.id,
      title: `Reçu de paiement à valider${input.montant ? ` : ${input.montant} ${input.devise || "MAD"}` : ""}`,
      details: { montant: input.montant ?? null, devise: input.devise || null, date: input.date || null, banque: input.banque || null, reference: input.reference || null },
    });
    ctx.effects.transfer = ctx.effects.transfer || { reason: "recu_paiement", summary: `Reçu de paiement reçu (${input.montant ?? "montant illisible"} ${input.devise || ""}, ${input.banque || "banque ?"}, ${input.date || "date ?"}). À valider par la comptabilité.` };
    return {
      enregistre: true,
      transfert: true,
      consigne: "Remercier le client : le reçu est transmis à la comptabilité, qui confirmera après vérification. Ne jamais confirmer le paiement soi-même.",
    };
  }
  if (input.type_document === "passeport" || input.type_document === "cin" || input.type_document === "photo") {
    ctx.effects.tasks.push({
      type: "document",
      team: "suivi",
      mediaId: media.id,
      title: `Document reçu (${input.type_document}) à vérifier et rattacher au dossier`,
      details: { remarque: input.remarque || null },
    });
  }
  return { enregistre: true, lisible: true, consigne: "Confirmer la bonne réception au client sans recopier les numéros du document." };
}

function demanderHumain(input, ctx) {
  const reason = TRANSFER_REASONS.includes(input.motif) ? input.motif : "demande_humain";
  ctx.effects.transfer = { reason, summary: String(input.resume || "").slice(0, 1000) };
  return { transfert: true, a_dire_au_client: ctx.transferHint || "Un conseiller va prendre le relais." };
}

function planifierRappel(input, ctx) {
  ctx.effects.tasks.push({
    type: "rappel",
    team: "ventes",
    title: `Rappeler le client : ${input.quand}`,
    details: { quand: input.quand, telephone: input.telephone || null, motif: input.motif },
  });
  return { enregistre: true, consigne: "Confirmer au client qu'un conseiller l'appellera au moment souhaité, sans promettre d'heure exacte." };
}

async function envoyerBrochure(input, ctx) {
  const program = await getProgramBySlug(String(input.slug || ""), ctx.agencyId);
  if (!program) return { erreur: "Programme introuvable." };
  const base = await publicBaseUrl(ctx.agencyId);
  const link = programUrl(base, program);
  const image = program.cover_image_url ? `${base}${program.cover_image_url}` : null;
  ctx.effects.outbound.push(image ? { kind: "image", url: image, caption: `${program.title}\n${link}` } : { kind: "text", text: `${program.title}\n${link}` });
  return { envoye: true, lien: link, remarque: "La brochure est envoyée juste avant ta réponse : ne recopie pas le lien." };
}

async function envoyerLocalisation(_input, ctx) {
  const settings = await getAgencySettings(ctx.agencyId);
  const maps = (settings?.social_links || []).find((l) => /google\s*maps|maps/i.test(l.platform));
  const address = [settings?.address, settings?.city].filter(Boolean).join(", ");
  if (!address && !maps) return { erreur: "Adresse de l'agence non renseignée. Proposer un conseiller." };
  ctx.effects.outbound.push({ kind: "text", text: [settings?.name, address, maps?.url].filter(Boolean).join("\n") });
  return { envoye: true, adresse: address, remarque: "L'adresse est envoyée juste avant ta réponse." };
}

function proposerChoix(input, ctx) {
  const options = (input.options || []).map((o) => ({ titre: String(o.titre || "").slice(0, 20) })).filter((o) => o.titre).slice(0, 10);
  if (!input.question || options.length < 2) return { erreur: "Une question et au moins 2 choix sont nécessaires." };
  ctx.effects.outbound.push({ kind: "interactive", body: String(input.question).slice(0, 1000), options });
  return { envoye: true, remarque: "Les choix sont envoyés. Attends la réponse du client ; n'ajoute qu'un texte très court, ou rien." };
}

const EXECUTORS = {
  chercher_programmes: chercherProgrammes,
  details_programme: detailsProgramme,
  creer_ou_maj_prospect: creerOuMajProspect,
  etat_dossier: etatDossier,
  enregistrer_document: enregistrerDocument,
  demander_humain: demanderHumain,
  planifier_rappel: planifierRappel,
  envoyer_brochure: envoyerBrochure,
  envoyer_localisation: envoyerLocalisation,
  proposer_choix: proposerChoix,
};

export async function executeTool(name, input, ctx) {
  const executor = EXECUTORS[name];
  if (!executor || !ctx.enabledTools.includes(name)) return { erreur: `Outil indisponible : ${name}` };
  return executor(input && typeof input === "object" ? input : {}, ctx);
}
