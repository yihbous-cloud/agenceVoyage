require("dotenv").config();
const app = require("./app");

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Serveur agenceVoyage démarré sur http://localhost:${PORT}`);
});
