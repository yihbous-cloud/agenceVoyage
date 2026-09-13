let reservations = [];
let nextId = 1;

module.exports = {
  getAll: () => reservations,
  getById: (id) => reservations.find((r) => r.id === Number(id)),
  getByVoyage: (voyageId) =>
    reservations.filter((r) => r.voyageId === Number(voyageId)),
  create: (data) => {
    const reservation = {
      id: nextId++,
      dateReservation: new Date().toISOString(),
      statut: "en attente",
      ...data,
    };
    reservations.push(reservation);
    return reservation;
  },
  update: (id, data) => {
    const index = reservations.findIndex((r) => r.id === Number(id));
    if (index === -1) return null;
    reservations[index] = { ...reservations[index], ...data, id: Number(id) };
    return reservations[index];
  },
  remove: (id) => {
    const index = reservations.findIndex((r) => r.id === Number(id));
    if (index === -1) return false;
    reservations.splice(index, 1);
    return true;
  },
};
