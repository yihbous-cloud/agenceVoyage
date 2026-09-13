const express = require("express");
const cors = require("cors");

const voyagesRoutes = require("./routes/voyages.routes");
const reservationsRoutes = require("./routes/reservations.routes");

const app = express();

app.use(cors({ origin: process.env.CLIENT_ORIGIN || "http://localhost:5173" }));
app.use(express.json());

app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/voyages", voyagesRoutes);
app.use("/api/reservations", reservationsRoutes);

app.use((req, res) => {
  res.status(404).json({ message: "Route introuvable" });
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ message: "Erreur serveur" });
});

module.exports = app;
