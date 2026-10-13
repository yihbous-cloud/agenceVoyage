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
| **1 · S2 à S5** | **1A (livrée le 12/10) :** L2 redirections 301 gérées dans l'admin + départs terminés · L7 mise à jour immédiate des pages + IndexNow · L4 balisage `@graph` complet. **1B (prête) :** L1 contenu FR/AR par entité (un seul slug latin, commun aux langues). **1C :** L8 GA4 + source des leads dans le CRM · L12 pages légales et cookies | Piliers Omra/Hajj, fiches Ramadan, 10 guides, regroupement des programmes (D3, possible dès la vague 1A) | Recette technique (§16 du cahier) |
| **2 · S6 à S10** | L3 fiche voyage en 10 blocs · L5 outil éditorial (guides, auteurs, lexique, FAQ en base reliée à la base de connaissances de l'agent WhatsApp) · L11 santé SEO dans l'admin | 20 guides, 200 questions, lexique, avis du groupe de décembre | Recette contenu |
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
