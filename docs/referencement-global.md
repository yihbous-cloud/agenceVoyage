# Référencement global Golden Fantastic : cadrage et feuille de route

Document de cadrage du cahier des charges « Référencement global (SEO · AEO · AIO · GEO · PSEO) » du 12/10/2026, appliqué au site en ligne https://goldenfantastic.com (depuis le 08/10/2026).
Destinataires : chef de projet, consultant SEO, rédacteurs FR/AR, équipe commerciale et marketing.
Le détail technique de chaque livraison est tenu à jour dans `CLAUDE.md` (section §3centtreizequadragies pour la phase 0).

## 1. Point de départ (constats du 12/10/2026)

| Gravité | Constat | Traité en phase 0 |
|---|---|---|
| 🔴 | Les pages `/fr` et `/en` d'une fiche publiaient le même texte arabe que la version arabe, alors que les hreflang annonçaient trois langues (contenu dupliqué) | ✅ |
| 🔴 | Markdown affiché en clair (`**`) sur les fiches, dans `llms.txt` et dans l'API publique | ✅ |
| 🔴 | « OMRA CHAABAN » publié à 0,00 MAD et sans description (offre à prix 0 dans le balisage) | ✅ pour l'affichage et le balisage ; **les données restent à compléter par l'agence** |
| 🟠 | Marque « Golden Fantastic Ouled Teima » en base, au lieu de « Golden Fantastic » | ❌ à corriger par l'agence dans `/admin/parametres` |
| 🟠 | Pas d'Open Graph (aperçus WhatsApp/Facebook), favicon Next.js par défaut | ✅ |
| 🟠 | `robots.txt` limité à 5 robots IA, `/api` non bloqué | ✅ (16 robots) |
| 🟠 | Fiches programme et piliers jamais mis en cache (requête MySQL à chaque visite) | ✅ (cache ISR de 5 min) |
| 🟡 | Sitemap sans `lastmod`, anglais indexé sans contenu traduit | ✅ |
| 🟡 | Pas de fil d'Ariane visible, page 404 non habillée, compression gzip au lieu de Brotli | ✅ (Brotli : à appliquer sur le serveur) |
| ✅ | Rendu serveur, HTTPS/HSTS, redirection www, 9 robots testés tous en réponse 200 | — |

## 2. Décisions

### Prises le 12/10/2026

| N° | Décision | Écart au cahier |
|---|---|---|
| D1 | L'arabe reste la langue principale à la racine (`/`), le français est sous `/fr`. Hreflang `ar-MA` / `fr-MA`. L'anglais reste proposé aux visiteurs mais **hors index** jusqu'à la phase 2. | TECH-05 demande `/ar/` : écart assumé (le schéma est déjà en ligne et accepté par Google). |
| D2 | Omra et Hajj sont deux piliers séparés : `/omra`, `/hajj`, `/voyages-organises`. Les anciennes URL `/omra-hajj/...` redirigent définitivement. | Conforme. |
| D3 | Des programmes **permanents** (« Omra via Istanbul », « Omra Ramadan ») portent plusieurs départs datés, au lieu d'un programme par départ. Regroupement des programmes existants en phase 1, **après** la livraison de la table de redirections. D'ici là, **ne changer aucun slug**. | Conforme (§4 : une URL ne change plus). |
| D4 | Marque unique : « Golden Fantastic ». « Ouled Teima » est la ville de l'adresse. | Conforme. |

### À trancher cette semaine

| Sujet | Responsable | Impact |
|---|---|---|
| Adresse(s) exacte(s) et aéroports de départ réellement opérés (Casablanca, Marrakech, Agadir ?) | Gérant | SEO local, pages par aéroport (PSEO) |
| N° de licence (loi 31-96), raison sociale, date de création, assurance RC | Gérant | Mentions légales, balisage `Organization`, E-E-A-T |
| Domaine `.ma` (achat puis redirection vers `.com`) | Gérant | Protection de la marque |
| Bandeau cookies et déclaration CNDP (préalables à GA4) | Gérant | Mesure (lot L8) |
| CDN (Cloudflare) : oui ou non | Chef de projet | Performance (lot L9) |
| Clientèle MRE visée ou non | Gérant | Anglais et pages par pays |
| Rédacteur arabe natif, référent religieux | Gérant | Tous les contenus |
| Budget outils (Semrush/Ahrefs, suivi de positions, Screaming Frog) | Chef de projet | Mots-clés, mesure |
| Contenus intégrés au cahier absents de l'export Markdown (arborescence en 6 rubriques, planning en 5 phases) | Chef de projet | Arborescence cible |

## 3. Calendrier qui presse

- **Ramadan 1448** : début vers le 8 février 2027. Le cahier veut les contenus Omra Ramadan 3 à 4 mois avant, donc **en ligne dès novembre 2026**.
- **Hajj 2027** : vers mi-mai 2027. Contenus attendus **vers mi-novembre 2026**.
- Premier groupe de retour exploitable pour les avis Google : départ du 4 au 20 décembre 2026, avis à demander fin décembre.

## 4. Feuille de route

| Phase | Développement (dans le site) | Contenu et commercial | Condition de passage |
|---|---|---|---|
| **0 · S1** (livrée) | L0 corrections + piliers `/omra` `/hajj` | Décisions restantes, Search Console + Bing, fiche Google, mots-clés, brief Ramadan | Phase 0 vérifiée en production |
| **1 · S2 à S5** | **1A (livrée le 12/10) :** L2 redirections 301 gérées dans l'admin + départs terminés · L7 mise à jour immédiate des pages + IndexNow · L4 balisage `@graph` complet. **1B (livrée le 13/10) :** L1 contenu FR/AR par entité (un seul slug latin, commun aux langues). **1C (livrée le 13/10) :** L8 GA4 (désactivé tant que l'identifiant GTM est vide) + source des demandes dans le CRM · L12 pages légales et cookies | Piliers Omra/Hajj, fiches Ramadan, 10 guides, regroupement des programmes (D3, possible dès la vague 1A) | Recette technique (§16 du cahier) |
| **2 · S6 à S10** | **2A (livrée le 13/10) :** L3 fiche voyage en 10 blocs (programme jour par jour, inclus/non inclus, formalités datées, conditions, photos, vidéo, avis, tableau des formules) · **2B (livrée le 13/10) :** L5 outil éditorial (guides, auteurs, lexique, FAQ en base reliée à la base de connaissances de l'agent WhatsApp) · **2C (prête) :** L11 santé SEO dans l'admin (problèmes à corriger et indicateurs face aux objectifs) | 20 guides, 200 questions, lexique, avis du groupe de décembre | Recette contenu |
| **3 · S11 à S16** | L6 PSEO, un gabarit à la fois, avec garde-fous · L10 GEO (baromètre des prix, `llms-full.txt`, panel de prompts) · L9 performance | Textes uniques des pages PSEO, premier panel IA | ≥ 70 % des pages PSEO indexées après 8 semaines |
| **4 · en continu** | Anglais, ajustements | Netlinking, presse, YouTube, panel mensuel | — |

Chaque lot fait l'objet d'un plan validé avant son lancement.

## 5. Actions immédiates hors code

1. Corriger le nom de l'agence en « Golden Fantastic » dans `/admin/parametres` (ville : Ouled Teima).
2. « OMRA CHAABAN » : saisir le prix et la description, ou le dépublier. Un avertissement s'affiche désormais dans la carte « Informations » de tout programme publié sans prix, sans description ou sans image.
3. Vérifier le domaine dans Google Search Console et Bing Webmaster Tools par enregistrement DNS TXT (hPanel), puis soumettre `https://goldenfantastic.com/sitemap.xml` dans les deux.
4. Créer la fiche Google Business Profile (sa validation prend du temps) : nom exact, adresse, catégorie « Agence de voyages », horaires, WhatsApp, lien vers le site.
5. Consultant : premier lot de mots-clés (priorité Omra Ramadan et Hajj 2027), collecte des questions réelles reçues sur WhatsApp.
6. Mesure de référence : PageSpeed Insights sur l'accueil, `/omra`, une fiche programme, `/voyages-organises` et `/contact` ; premier crawl complet.

## 6. Répartition des rôles (cahier §15)

| Lot | Réalise | Valide |
|---|---|---|
| Cadrage, mots-clés, banque de questions | Consultant SEO (avec l'équipe commerciale) | Chef de projet |
| Développement, balisage, robots, sitemaps | Développement | Chef de projet |
| Données des voyages dans le CRM | Équipe commerciale | Gérant |
| Contenus FR et AR | Rédacteurs | Référent religieux, chef de projet |
| SEO local, fiche Google, avis, annuaires | Équipe marketing | Chef de projet |
| GEO, presse, YouTube | Équipe marketing | Chef de projet |
| Mesure et rapport mensuel | Consultant SEO (marquage : développement) | Chef de projet |

## 7. Indicateurs de référence à relever avant la phase 1

Pages indexées (Search Console, Bing), positions sur les 50 requêtes cœur, Core Web Vitals mobile, trafic organique, nombre d'avis et note Google, leads par source (à partir du lot L8), premier passage du panel de 100 prompts IA (phase 3).

## 8. Écarts assumés au cahier

- Arabe à la racine au lieu de `/ar/` (D1).
- Anglais proposé aux visiteurs mais hors index jusqu'à la phase 2.
- En attendant les traductions par entité (lot L1), une fiche saisie dans une seule langue pointe sa balise canonical vers cette langue, sans hreflang, plutôt que de publier deux versions identiques.

## 9. Ce que la vague 1A change pour l'équipe

- **Changer l'adresse d'un programme ne casse plus rien** : quand le slug (ou le pilier Omra/Hajj) change, l'ancienne adresse redirige automatiquement vers la nouvelle. Le regroupement des programmes en programmes permanents (décision D3) peut donc commencer.
- **Dépublier ou supprimer** un programme ou une actualité redirige son adresse vers le catalogue (Omra, Hajj, Voyages organisés ou Actualités) au lieu d'afficher une page introuvable. Republier annule la redirection.
- **Programme terminé** : sa page reste en ligne avec la mention « Départ terminé » et propose la suite. Dans la carte « Informations » du programme, le champ « Programme qui prend la suite » permet de désigner la prochaine édition ; sinon le site propose automatiquement les prochains départs du même catalogue.
- **Mise à jour immédiate** : toute modification dans l'admin (prix, dates, hôtels, textes) apparaît aussitôt sur le site, et la page est signalée à Bing et aux moteurs compatibles IndexNow.
- **Nouvel écran « Référencement »** (menu Paramètres, réservé à la direction par défaut) : liste des redirections avec leur nombre d'utilisations, ajout manuel (ex. ancienne adresse d'une campagne), journal des signalements aux moteurs.
- Après chaque mise en production, un contrôle automatique vérifie toutes les pages du plan du site (balisage, adresses de référence, page 404).

## 10. Ce que la vague 1B change pour l'équipe

- **Chaque contenu a une langue principale** (programme, actualité, diapositive) : les champs habituels sont dans cette langue, l'autre langue se saisit dans le bloc « Version française » (ou « Version arabe ») juste en dessous. L'adresse (slug) reste la même dans les deux langues.
- **Une fiche n'est indexée en français que si sa version française est saisie** (titre + une description). Sans elle, la page française affiche le texte arabe et indique aux moteurs que la page de référence est la version arabe. La liste des programmes affiche pour chacun `AR ✓` / `FR —` : c'est la liste des traductions à faire.
- **FAQ** : chaque question a aussi sa version dans l'autre langue. Pour changer la langue principale d'un programme, toutes ses questions doivent d'abord avoir leur version dans la nouvelle langue (le site le signale).
- **Diapositives de l'accueil** : titre, sous-titre et texte du bouton ont leur version dans l'autre langue ; activer ou désactiver une diapositive ne touche pas à ses traductions.
- L'agent WhatsApp cite les programmes dans la langue du client quand la version existe.
- Les traductions sont saisies à la main (pas de traduction automatique) : à faire relire par un locuteur natif pour l'arabe.

## 11. Ce que la vague 1C change pour l'équipe

- **Source de chaque demande** : une inscription en ligne ou un message de contact indique désormais d'où venait le visiteur (assistant IA comme ChatGPT ou Perplexity, moteur de recherche, réseau social, publicité, campagne, autre site, accès direct). Elle s'affiche sur la fiche de l'inscription et dans les messages. Le bilan par canal est dans **Référencement → Sources des demandes** (30 jours, 90 jours, 12 mois). Les inscriptions saisies par l'équipe apparaissent comme « Saisie dans l'admin ».
- **Boutons WhatsApp du site** : le message pré-rempli se termine par `[SITE]` ; ne pas l'effacer. Il permet de compter les contacts WhatsApp venus du site. Le lien « SITE » doit rester actif dans WhatsApp → Liens & QR codes.
- **Paramètres de l'agence → Informations légales** : raison sociale, forme juridique, capital, licence d'agence de voyages (loi 31-96), date de création, directeur de la publication, assurance RC professionnelle, n° CNDP, hébergeur, et conditions générales de vente (français et arabe). Les pages Mentions légales, Confidentialité et CGV du site se remplissent automatiquement ; un champ vide n'y apparaît pas. La page CGV n'existe qu'une fois un texte saisi. **Les textes juridiques doivent être relus par un juriste.**
- **Mesure d'audience** : rien n'est mesuré tant que le champ « identifiant Google Tag Manager » est vide. Une fois rempli, un bandeau demande l'accord des visiteurs ; Google Analytics ne se charge qu'après « Accepter ».

## 12. Paramétrer Google Analytics 4 (à faire par l'agence ou son prestataire)

1. **Google Analytics** : créer une propriété GA4 (fuseau Casablanca, devise MAD) et un flux Web pour le domaine du site. Noter l'identifiant de mesure `G-XXXXXXX`.
2. **Google Tag Manager** : créer un conteneur Web. Y ajouter :
   - une balise « Google Tag » avec l'identifiant `G-XXXXXXX`, déclenchée sur « Initialization - All Pages » ;
   - une balise « Événement GA4 » par événement envoyé par le site : `clic_whatsapp`, `clic_telephone`, `demande_devis`, `reservation`. Déclencheur « Événement personnalisé » au même nom. Paramètres à transmettre (variables « Couche de données ») : `langue`, `page`, `voyage` ;
   - publier le conteneur.
3. **Site** : saisir l'identifiant du conteneur (`GTM-XXXXXXX`) dans **Paramètres de l'agence → Mesure d'audience**. Le bandeau de consentement apparaît aussitôt sur le site.
4. **Dans GA4** :
   - marquer `demande_devis`, `reservation`, `clic_whatsapp` et `clic_telephone` comme **événements clés** ;
   - créer un **groupe de canaux personnalisé** avec, en premier, un canal « Assistants IA » : source qui correspond à l'expression régulière `chatgpt|openai|perplexity|gemini|claude|copilot|mistral|deepseek|meta\.ai|grok`.
5. Le site applique le **mode de consentement v2** : stockage publicitaire toujours refusé, mesure d'audience accordée seulement après « Accepter ».

## 13. Ce que la vague 2A change pour l'équipe

- **Nouvelle tuile « Contenu de la fiche »** sur chaque programme : programme jour par jour (ajouter, retirer, réordonner les jours), encadrement (guide religieux, accompagnateur), ce qui est inclus et non inclus (un élément par ligne), formalités avec leur **date de vérification** et le lien de la source officielle, conditions de réservation et d'annulation. Saisi **une fois par programme**, valable pour tous ses départs. Version dans l'autre langue juste en dessous, comme pour les titres et descriptions.
- **Un bloc laissé vide n'apparaît pas sur le site** : rien n'est inventé. En haut de la fiche programme, l'indicateur **« Fiche publique : N/10 blocs »** liste ce qui manque et comment le compléter.
- **Formalités** : la date « Vérifiées le » est affichée aux visiteurs. La revérifier au moins tous les six mois (la santé SEO, en vague 2C, le signalera).
- **Tuile « Photos & vidéo »** : de **vraies** photos du voyage (hôtels, groupe, lieux visités), avec une légende en français et en arabe (elle décrit l'image aux moteurs de recherche), et une vidéo YouTube avec sa date de mise en ligne. La vidéo ne se charge qu'au clic du visiteur (page rapide).
- **Tuile « Avis clients »** : saisir uniquement des avis **réellement reçus** (WhatsApp, e-mail, livre d'or), tels quels. Un avis n'est publiable qu'avec le **consentement** de son auteur ; sans consentement il reste interne. Dès qu'un avis est publié, la note moyenne peut apparaître dans les résultats Google.
- **Carte « Aéroport »** : nouveau champ « Franchise bagages » (ex. « 2 × 23 kg en soute + 7 kg en cabine »), affiché dans le bloc Vol avec les escales.
- **Catalogue des hôtels** : chaque hôtel peut recevoir une photo, affichée sur la fiche des voyages qui l'utilisent.
- **Sur le site**, chaque fiche affiche désormais : durée (jours / nuits), prochain départ, prix « à partir de » TTC, places restantes, date de mise à jour, boutons Réserver / Demander un devis (formulaire pré-rempli) / WhatsApp, et pour chaque départ le vol (escales, bagages), les hôtels dans l'ordre du séjour et le **tableau des formules** (prix par type de chambre).
- **L'agent WhatsApp** répond avec les mêmes informations (programme jour par jour, inclus, formalités et leur date de vérification, conditions, bagages, escales).
- Une modification apparaît sur le site **en moins d'une seconde** après l'enregistrement.

## 14. Ce que la vague 2B change pour l'équipe

- **Nouveau groupe « Contenu » dans l'admin** : Guides, Auteurs, Lexique et Banque de questions. Accès réservé à la direction par défaut (permission « Contenus éditoriaux », attribuable aux rédacteurs dans Rôles & permissions).
- **Auteurs** : à créer en premier. Fonction et présentation en français **et** en arabe (chaque langue n'apparaît que sur la page de sa langue), nombre de voyages encadrés, photo. Cocher « Référent religieux » pour la personne qui valide les contenus religieux.
- **Guides** (`/guide/...` sur le site) : texte en Markdown (## Intertitre, - liste, **gras**, [lien](/omra)), pilier, auteur, relecteur, version dans l'autre langue, programmes dont la fiche affiche le guide. **Un guide religieux ne peut pas être publié sans un relecteur référent religieux.** Le bouton « Marquer comme relu » date la relecture, affichée sur le site (« Relu par … le … ») ; à refaire au moins tous les six mois. Changer l'adresse d'un guide publié crée une redirection automatique.
- **Lexique** (`/guide/lexique`) : un terme, sa définition en français et en arabe. Un terme n'apparaît que dans les langues où il est défini. Objectif du cahier : 50 termes.
- **Banque de questions** : ce sont les fiches de la base de connaissances de l'agent WhatsApp. En choisissant une « Page du site » (Questions fréquentes, Omra, Hajj, Voyages organisés), la fiche s'affiche aussi sur le site, dans chaque langue où la question et sa réponse existent. Les « variantes de formulation » (darija comprise) s'affichent en « Autres formulations ». Le lien « En savoir plus » renvoie vers un guide (ex. `/guide/documents-omra`). Objectif du cahier : 200 questions, 10 à 15 par pilier.
- Tant qu'aucune question n'est affectée à la page « Questions fréquentes », `/faq` garde sa liste actuelle. Tant qu'aucun guide n'est publié, `/guide` n'existe pas et le lien du pied de page n'apparaît pas.
- Les fiches programme affichent « Guides utiles » (les guides choisis, sinon les plus récents du même pilier), et chaque pilier ses guides et ses questions.

## 15. Ce que la vague 2C change pour l'équipe

- **Nouvel onglet « Santé SEO »** dans Paramètres → Référencement (ouvert par défaut). Il liste ce qui empêche le site d'être bien référencé, avec pour chaque point un lien « Corriger » qui ouvre le bon écran. Rien n'est modifié automatiquement.
- **En haut, quatre compteurs face aux objectifs du cahier** :
  - fiches complètes (10 blocs sur 10) ;
  - guides publiés (objectif 20) ;
  - questions affichées sur le site (objectif 200) ;
  - termes du lexique (objectif 50).
- **Trois niveaux** :
  - **Erreur** : à corriger tout de suite. Exemples : un départ ouvert à 0 MAD ; un guide religieux publié sans relecteur référent.
  - **Avertissement** : à traiter. Exemples : bloc de fiche manquant ; version arabe ou française absente ; titre trop long pour Google ; formalités ou guide non revérifiés depuis 6 mois ; terme ou question sans arabe ; moins de 10 questions sur un pilier ; envoi aux moteurs en échec ; redirection vers une page retirée.
  - **Information** : à garder en tête. Exemples : aucun départ ouvert ; pas de description Google saisie (une description automatique est utilisée) ; questions connues seulement de l'agent WhatsApp.
- **Usage conseillé** : un passage chaque semaine. Traiter les erreurs le jour même, puis les avertissements des programmes publiés en premier. Le bouton « Actualiser » recalcule la liste après une correction.
