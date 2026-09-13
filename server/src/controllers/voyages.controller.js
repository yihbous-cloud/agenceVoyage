const voyagesStore = require("../data/voyages.data");

exports.getAllVoyages = (req, res) => {
  res.json(voyagesStore.getAll());
};

exports.getVoyageById = (req, res) => {
  const voyage = voyagesStore.getById(req.params.id);
  if (!voyage) {
    return res.status(404).json({ message: "Voyage introuvable" });
  }
  res.json(voyage);
};

exports.createVoyage = (req, res) => {
  const { destination, pays, description, prix, duree, placesDisponibles } =
    req.body;

  if (!destination || !pays || prix == null) {
    return res
      .status(400)
      .json({ message: "destination, pays et prix sont requis" });
  }

  const voyage = voyagesStore.create({
    destination,
    pays,
    description: description || "",
    prix,
    duree: duree || 1,
    placesDisponibles: placesDisponibles || 0,
    image: req.body.image || "",
  });

  res.status(201).json(voyage);
};

exports.updateVoyage = (req, res) => {
  const voyage = voyagesStore.update(req.params.id, req.body);
  if (!voyage) {
    return res.status(404).json({ message: "Voyage introuvable" });
  }
  res.json(voyage);
};

exports.deleteVoyage = (req, res) => {
  const deleted = voyagesStore.remove(req.params.id);
  if (!deleted) {
    return res.status(404).json({ message: "Voyage introuvable" });
  }
  res.status(204).send();
};
