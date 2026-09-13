const reservationsStore = require("../data/reservations.data");
const voyagesStore = require("../data/voyages.data");

exports.getAllReservations = (req, res) => {
  res.json(reservationsStore.getAll());
};

exports.getReservationById = (req, res) => {
  const reservation = reservationsStore.getById(req.params.id);
  if (!reservation) {
    return res.status(404).json({ message: "Réservation introuvable" });
  }
  res.json(reservation);
};

exports.createReservation = (req, res) => {
  const { voyageId, nomClient, email, telephone, nombrePersonnes } = req.body;

  if (!voyageId || !nomClient || !email) {
    return res
      .status(400)
      .json({ message: "voyageId, nomClient et email sont requis" });
  }

  const voyage = voyagesStore.getById(voyageId);
  if (!voyage) {
    return res.status(404).json({ message: "Voyage introuvable" });
  }

  const personnes = nombrePersonnes || 1;
  if (voyage.placesDisponibles < personnes) {
    return res.status(400).json({ message: "Places insuffisantes pour ce voyage" });
  }

  const reservation = reservationsStore.create({
    voyageId: Number(voyageId),
    nomClient,
    email,
    telephone: telephone || "",
    nombrePersonnes: personnes,
  });

  voyagesStore.update(voyageId, {
    placesDisponibles: voyage.placesDisponibles - personnes,
  });

  res.status(201).json(reservation);
};

exports.updateReservation = (req, res) => {
  const reservation = reservationsStore.update(req.params.id, req.body);
  if (!reservation) {
    return res.status(404).json({ message: "Réservation introuvable" });
  }
  res.json(reservation);
};

exports.deleteReservation = (req, res) => {
  const deleted = reservationsStore.remove(req.params.id);
  if (!deleted) {
    return res.status(404).json({ message: "Réservation introuvable" });
  }
  res.status(204).send();
};
