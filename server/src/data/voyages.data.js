let voyages = [
  {
    id: 1,
    destination: "Marrakech",
    pays: "Maroc",
    description: "Découverte de la ville rouge, ses souks et ses jardins.",
    prix: 3500,
    duree: 5,
    placesDisponibles: 12,
    image: "https://images.unsplash.com/photo-1539020140153-e479b8c22e70",
  },
  {
    id: 2,
    destination: "Paris",
    pays: "France",
    description: "Séjour romantique au cœur de la ville lumière.",
    prix: 7200,
    duree: 4,
    placesDisponibles: 8,
    image: "https://images.unsplash.com/photo-1502602898657-3e91760cbb34",
  },
  {
    id: 3,
    destination: "Istanbul",
    pays: "Turquie",
    description: "Entre Orient et Occident, un voyage riche en histoire.",
    prix: 5400,
    duree: 6,
    placesDisponibles: 15,
    image: "https://images.unsplash.com/photo-1524231757912-21f4fe3a7200",
  },
];

let nextId = voyages.length + 1;

module.exports = {
  getAll: () => voyages,
  getById: (id) => voyages.find((v) => v.id === Number(id)),
  create: (data) => {
    const voyage = { id: nextId++, ...data };
    voyages.push(voyage);
    return voyage;
  },
  update: (id, data) => {
    const index = voyages.findIndex((v) => v.id === Number(id));
    if (index === -1) return null;
    voyages[index] = { ...voyages[index], ...data, id: Number(id) };
    return voyages[index];
  },
  remove: (id) => {
    const index = voyages.findIndex((v) => v.id === Number(id));
    if (index === -1) return false;
    voyages.splice(index, 1);
    return true;
  },
};
