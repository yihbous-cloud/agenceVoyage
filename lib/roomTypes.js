// Chaque type de chambre est strictement attaché à une capacité fixe — règle
// métier, pas une coïncidence de valeurs par défaut (voir CLAUDE.md
// §3terdecies). Partagé entre HebergementManager (création de chambre) et
// les formulaires d'inscription (préférence exprimée par le voyageur).
export const ROOM_TYPE_CAPACITY = {
  simple: 1,
  double: 2,
  triple: 3,
  quadruple: 4,
  quintuple: 5,
};

export const ROOM_TYPES = Object.keys(ROOM_TYPE_CAPACITY);

// "simple" n'est plus proposé nulle part côté personnel : ni comme
// préférence à l'inscription (NewRegistrationForm.jsx, EditRegistrationForm.jsx),
// ni comme type créable en hébergement (HebergementManager.jsx) — cohérent
// avec le fait qu'il n'a pas de palier de prix (voir PRICE_TIER_FIELD/
// pickTripPrice ci-dessous, CLAUDE.md). `ROOM_TYPE_CAPACITY`/`ROOM_TYPES`
// gardent "simple" tel quel : c'est la référence de capacité complète, pas
// la liste de ce qui est proposé à l'écran.
export const BOOKABLE_ROOM_TYPES = ROOM_TYPES.filter((t) => t !== "simple");

// Chaque voyage porte 4 prix (double/binôme à quintuple, voir CLAUDE.md) —
// "simple" n'a volontairement pas de palier de prix. Le prix affiché au
// public est toujours le plus bas des quatre (en pratique le quintuple).
export const PRICE_TIER_FIELD = {
  double: "price_double",
  triple: "price_triple",
  quadruple: "price_quadruple",
  quintuple: "price_quintuple",
};

// trip : objet portant price_double/triple/quadruple/quintuple (ligne SQL ou
// réponse API). roomType : préférence du voyageur — peut être "simple"
// (sans palier), vide, ou absent — repli sur le prix le plus bas dans ce cas.
export function pickTripPrice(trip, roomType) {
  const tiers = [trip.price_double, trip.price_triple, trip.price_quadruple, trip.price_quintuple].map(
    Number
  );
  const lowest = Math.min(...tiers);
  const field = PRICE_TIER_FIELD[roomType];
  const tierValue = field ? Number(trip[field]) : NaN;
  return Number.isNaN(tierValue) ? lowest : tierValue;
}

// Analogue à pickTripPrice mais à partir des lignes de prix d'un tarif
// d'hébergement (trip_hotel_tier_prices, via lib/tripHotelTiers.js::
// listTiersForTrip) plutôt que des colonnes plates de `trips` — un tarif
// Omra/Hajj (voir CLAUDE.md) peut avoir un prix par type de chambre. Reste
// dans ce fichier (aucun import de ./db) pour rester importable depuis un
// composant client (NewRegistrationForm.jsx) sans entraîner mysql2 dans le
// bundle navigateur.
export function pickTierPrice(tierPriceRows, roomType) {
  if (!Array.isArray(tierPriceRows) || tierPriceRows.length === 0) return null;
  const numeric = tierPriceRows.map((r) => Number(r.price_per_person));
  const lowest = Math.min(...numeric);
  const match = tierPriceRows.find((r) => r.room_type === roomType);
  return match ? Number(match.price_per_person) : lowest;
}
