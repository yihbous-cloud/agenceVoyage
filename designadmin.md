# designadmin.md — Charte visuelle de l'espace interne (/admin)

Référence unique du style de l'espace interne. Source : la maquette
« Tableau de bord - Golden Fantastic.html » (bundle fourni par l'agence, analysé
et reproduit ici). **Toute nouvelle page ou composant admin doit suivre ce
document** — dans les trois langues (AR / FR / EN), avec exactement les mêmes
styles ; seule la direction change (RTL en arabe).

Implémentation :

| Élément | Fichier |
|---|---|
| Jetons, styles des éléments, composants `gf-*` | `app/admin/admin-theme.css` |
| Shell (barre latérale, en-tête, palette Ctrl K) | `app/admin/_components/AdminShell.jsx` |
| Navigation (groupes, icônes, permissions) | `app/admin/layout.js` (`NAV_GROUPS`, `QUICK_ACTIONS`) |
| En-tête de page | `app/admin/_components/PageHeader.jsx` |
| Icônes | `app/admin/_components/Icon.jsx` (`ADMIN_ICON_NAMES`) |
| Modale / confirmation / tuile | `_components/Modal.jsx`, `ConfirmDialog.jsx`, `ModuleTile.jsx` |
| Page modèle complète | `app/admin/page.js` (tableau de bord), `app/admin/inscriptions/page.js` |

---

## 1. Principe d'application

1. **Palette Tailwind remappée.** Sous `html.gf-admin`, les variables Tailwind
   (`--color-zinc-*`, `--color-emerald-*`, `--color-amber-*`, `--color-red-*`,
   `--color-blue-*`, `--radius-lg/xl`, `--text-sm`, `--shadow-*`) sont redéfinies
   sur la charte. Les ~80 écrans existants, écrits en `zinc`/`emerald`, adoptent
   donc la charte **sans réécriture**. Écrire du nouveau code avec ces mêmes
   classes reste correct ; pour un rendu identique à la maquette, préférer les
   classes `gf-*` ci-dessous.
2. **Éléments génériques en `@layer base`** (champs, tableaux, cartes
   `rounded-xl border bg-white`, boutons `bg-emerald-700`) : ce sont des
   *défauts* — une classe utilitaire posée sur l'élément garde la main.
3. **Hors couche (non négociable)** : typo des `h1` de page, en-têtes de
   tableaux (`thead th`), police (Geist + Noto Kufi Arabic).

## 2. Jetons

### Couleurs

| Rôle | Valeur | Variable |
|---|---|---|
| Accent (marque) | `#0f7a55` | `--gf-accent` (= `emerald-600/700`) |
| Accent survol bouton | `filter: brightness(1.08)` | — |
| Accent doux (fond) | `#e6f4ee` | `--gf-accent-soft` |
| Fond de page | `#f6f6f4` | `--gf-bg` |
| Surface (cartes) | `#ffffff` | `--gf-surface` |
| Surface 2 (en-têtes de tableau, pieds) | `#fafaf9` | `--gf-surface-2` (= `zinc-50`) |
| Surface 3 (tags, tuiles neutres) | `#f3f3f0` | `--gf-surface-3` |
| Bordure carte | `#ebebe8` | `--gf-border` (= `zinc-200`) |
| Séparateur interne / ligne de tableau | `#f0f0ed` | `--gf-border-soft` (= `zinc-100`) |
| Bordure de champ | `#e4e4e0` | `--gf-border-input` (= `zinc-300`) |
| Texte | `#17171a` | `--gf-text` (= `zinc-900`) |
| Texte secondaire | `#3a3a40` | `--gf-text-2` (= `zinc-700`) |
| Texte atténué | `#6b6b70` | `--gf-muted` (= `zinc-500`) |
| Libellé d'en-tête de tableau | `#76767c` | `--gf-muted-2` |
| Texte discret | `#8a8a90` | `--gf-subtle` (= `zinc-400`) |
| Très discret (séparateurs ›) | `#b4b4b8` | `--gf-faint` |

Tons sémantiques (fond / texte) — utilisés pour pastilles, KPI, icônes :

| Ton | Fond | Texte | Usage |
|---|---|---|---|
| Succès / payé complet | `#e6f4ee` | `#0f6b4b` | statut `paye_complet`, accent |
| Attention / partiel | `#fff4e0` | `#a35a00` | `paye_partiel`, compte à rebours J-x |
| Danger / annulé | `#fdecec` | `#c4373b` | `annule`, solde dû, suppression |
| Info / inscrit | `#e8f0fd` | `#2b5cc4` | `inscrit` |
| Violet / confirmé | `#efe9fb` | `#6b3fc4` | `confirme` |
| Rose (avatars) | `#fde9ef` | `#b4325a` | rotation d'avatars |

Pastilles visa (point coloré) : non demandé `#a0a0a6`, en cours `#f5a524`,
accordé `#12a26b`, refusé `#e5484d`.

### Barre latérale (thème sombre)

`--sb-bg #0f1012` · `--sb-fg #ececee` · `--sb-muted #8b8b92` · lien inactif
`#a0a0a6` · `--sb-hover rgba(255,255,255,.06)` · `--sb-active rgba(255,255,255,.09)`
· `--sb-border rgba(255,255,255,.07)`.

### Rayons, ombres, densité

| Élément | Rayon |
|---|---|
| Carte, modale, palette | 16px (`--gf-radius-card`, `rounded-xl`) |
| Tuile KPI / tuile de module | 14px |
| Champ, recherche, bouton principal | 10px |
| Bouton (en-tête, contour), lien de nav | 9px (`rounded-lg`) |
| Bouton icône, bouton contour petit | 8px |
| Pastille | 20px · Tag 7px · Chip 6px |

Ombres : carte `0 1px 2px rgba(16,16,20,.04)` · survol `0 8px 24px -12px rgba(16,16,20,.18)`
(+ `translateY(-2px)`) · flottant (modale/palette) `0 30px 80px -20px rgba(0,0,0,.35)`.
Densité des lignes de tableau : `--cell-py: 12px`.

## 3. Typographie

- Police : **Geist** (latin) + **Noto Kufi Arabic** (arabe), toutes deux via
  `next/font` ; chiffres/codes : **Geist Mono** (classe `gf-mono`, numéros de
  téléphone, codes IATA, raccourcis clavier).
- Titre de page `h1` : 24px / 600 / `letter-spacing -.025em` / interligne 1.2.
- Description de page : 13.5px, `--gf-muted`, largeur max 720px.
- Titre de carte : 15px / 600 avec icône 19px `--gf-subtle`.
- Corps : 13.5px (`text-sm`). Libellé secondaire : 12.5–13px. En-tête de tableau : 12px / 500.
- Valeur KPI : 30px / 600 / `-.03em`, chiffres tabulaires.
- Libellé de groupe (barre latérale, palette) : 11px / 500 / majuscules / `.06em`.
- Arabe : `letter-spacing` neutralisé (règle globale de `globals.css`).

## 4. Icônes

Material Symbols **Rounded**, poids 300–500, `FILL 0` (actif/accent : `FILL 1`).
Composant : `<Icon name="group" size={20} fill />`. Tailles usuelles : nav 20,
boutons 18, petits boutons 16, tuile de page 24.

⚠️ La police est un **sous-ensemble** (paramètre `icon_names` de Google Fonts) :
toute nouvelle icône doit être ajoutée à `ADMIN_ICON_NAMES` (`Icon.jsx`, liste
**triée alphabétiquement**), sinon son nom s'affiche en texte brut.
Les icônes portent `translate="no"` (jamais traduites).

## 5. Structure (shell)

```
┌────────────┬───────────────────────────────────────────────┐
│ Barre      │ En-tête 60px : fil d'Ariane · Rechercher · Créer│
│ latérale   ├───────────────────────────────────────────────┤
│ 264px      │ Contenu : max 1320px, padding 28/28/64,        │
│ (68 replié)│ blocs espacés de 22px                          │
└────────────┴───────────────────────────────────────────────┘
```

- **Barre latérale** : logo (tuile 34px, dégradé accent, initiales de l'agence),
  nom + « ville · Espace interne », bouton replier (état mémorisé dans le
  navigateur), bouton recherche (ouvre la palette, `Ctrl K`), navigation
  **groupée** (Général / Visa & voyages / Contenu / Gestion / Paramètres),
  lien actif = fond `--sb-active`, icône pleine accent, barre accent de 3px sur
  le bord de départ ; pastille de compteur (Inscrits). Pied : avatar, nom, rôle,
  langue (AR/FR/EN), déconnexion.
- **En-tête** : « Espace interne › Section », bouton doux « Rechercher Ctrl K »,
  bouton sombre « + Créer » (action principale de la section courante).
- **Palette de commandes** (`Ctrl/Cmd + K`) : actions rapides puis pages, flèches
  ↑↓, Entrée, Échap.
- **Mobile (≤ 900px)** : barre latérale en tiroir (bouton menu dans l'en-tête),
  voile flouté, contenu en padding 16px.
- Changement de page : fondu + translation de 8px (260ms).

## 6. Composants (classes)

| Besoin | Classe / composant |
|---|---|
| En-tête de page (tuile icône 44px + titre + description + actions) | `<PageHeader icon title description>{actions}</PageHeader>` |
| Bouton principal | `gf-btn-primary` (38px, accent) |
| Bouton secondaire (contour) | `gf-btn-outline` (32px) |
| Bouton sombre | `gf-btn-dark` (34px) |
| Bouton doux accent | `gf-btn-soft` |
| Bouton icône (actions de ligne) | `gf-btn-icon` (+ `gf-danger` pour supprimer) |
| Carte | `gf-card` ; en-tête `gf-card-head` (+ `gf-divided`), titre `gf-card-title`, lien `gf-card-link` |
| Carte mise en avant (bordure dégradée) | `gf-card-ai` (+ `gf-live-dot`) |
| Grille de cartes | `gf-grid-cards` (colonnes min 420px) |
| KPI | `gf-kpis` > `gf-kpi` (`gf-kpi-label`, `gf-kpi-icon`, `gf-kpi-value`) |
| Statistique compacte | `gf-stat` (`gf-stat-label`, `gf-stat-value`, `gf-dot`) |
| Pastille de statut | `gf-pill` (fond/texte selon le ton, point automatique) |
| Tag / chip | `gf-tag` / `gf-chip` |
| Avatar initiales | `gf-avatar` (28px, rotation des 5 tons) |
| Tableau | `gf-table` (+ `gf-num`, `gf-phone`, `gf-actions`), entête de section `gf-section-head` |
| Recherche | `gf-search` (label + icône + input) |
| Filtre segmenté | `gf-segmented` > liens avec `data-active` + `gf-count` |
| Barre de remplissage | `gf-progress` + `gf-legend` (`gf-legend-swatch`) |
| Tuile date | `gf-date-tile` (mois accent + jour) |
| État vide | `gf-empty` (icône 28px + texte) |
| Modale | `<Modal title size="sm|md|lg">` (`gf-overlay`, `gf-dialog`) |
| Confirmation | `useConfirm()` → `ConfirmDialog` |
| Tuile de module (fiches) | `<ModuleTile icon title subtitle meta badge>` (`gf-tile`, grille `gf-tiles`) |
| Accordéon (un seul ouvert) | `AccordionGroup` / `AccordionItem` (`app/admin/inscriptions/ProgramAccordion.jsx`, `gf-accordion`) |
| Fiche : avatar + récapitulatif | `gf-avatar-lg`, `gf-info-grid` > `gf-info-cell` (`gf-info-label`, `gf-info-value`) |
| Libellés/tons de statut | `app/admin/_components/statusStyles.js` |

Champs de formulaire : aucun style à ajouter — fond blanc, bordure `#e4e4e0`,
rayon 9px, focus = bordure accent + halo `3px` accent à 14%. Désactivé : fond
`#f3f3f0`. Cases à cocher : `accent-color` accent.

## 7. Langues et RTL

- Mêmes styles dans les trois langues. Direction posée par le layout
  (`<html dir>`), aucune règle propre à une langue sauf la police arabe.
- **Toujours des propriétés logiques** : `ms-/me-/ps-/pe-/start-/end-`,
  `text-start/end`, `border-s/e`, `inset-inline-*`. Jamais `left/right/ml/mr`.
- Flèches directionnelles inversées en arabe (`arrow_forward` ↔ `arrow_back`,
  `chevron_right` ↔ `chevron_left`).
- Libellés : texte source français ; traduction par `tr()` (composants client
  via `useAdminLocale()`, pages serveur via `makeTranslator(locale, "admin")`)
  ou par le traducteur DOM. **Tout nouveau libellé doit être ajouté à
  `lib/i18n/translations/admin.ar.js` et `admin.en.js`.**
- Données (noms, codes, téléphones, titres de programme) : `translate="no"`.

## 8. À ne pas faire

- Ajouter une bibliothèque d'UI ou d'icônes : tout passe par `admin-theme.css` et `Icon`.
- Coder une couleur hors des jetons ci-dessus.
- Créer une modale « à la main » : utiliser `Modal.jsx`.
- Ajouter une fonctionnalité factice de la maquette : l'« Assistant IA » et les
  notifications de la maquette ne sont **pas** implémentés (aucune IA dans le
  système) ; la carte « Suggestions de l'assistant » est devenue « À traiter »,
  calculée à partir de données réelles (paiements partiels, PNR manquants,
  places disponibles).
