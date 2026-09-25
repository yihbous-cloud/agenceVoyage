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
