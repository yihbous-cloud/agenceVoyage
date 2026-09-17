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
