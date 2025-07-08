// Path: parking-app-backend/src/routes/spotAvailability.js

const express = require("express");
const { protect, authorize } = require("../middleware/auth");
const {
  createSpotAvailability,
  getSpotAvailability,
  updateSpotAvailability,
  deleteSpotAvailability,
} = require("../controllers/spotAvailability");

const router = express.Router();

// Routes for homeowner to manage availability of their spots
// :spotId is the ID of the parking spot
router.post(
  "/:spotId",
  protect,
  authorize("homeowner"),
  createSpotAvailability
);
router.get("/:spotId", getSpotAvailability); // Can be public for viewing available times
router.put(
  "/:availabilityId",
  protect,
  authorize("homeowner"),
  updateSpotAvailability
);
router.delete(
  "/:availabilityId",
  protect,
  authorize("homeowner"),
  deleteSpotAvailability
);

module.exports = router;
