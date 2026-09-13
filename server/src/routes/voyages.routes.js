const express = require("express");
const router = express.Router();
const voyagesController = require("../controllers/voyages.controller");

router.get("/", voyagesController.getAllVoyages);
router.get("/:id", voyagesController.getVoyageById);
router.post("/", voyagesController.createVoyage);
router.put("/:id", voyagesController.updateVoyage);
router.delete("/:id", voyagesController.deleteVoyage);

module.exports = router;
