// Path: parking-app-backend/src/routes/parkingSpot.js

const express = require("express");
const router = express.Router();
const parkingSpotController = require("../controllers/parkingSpotController");
const {
  protect,
  authorizeHomeowner,
  authorizeDriver,
} = require("../middleware/auth");
// REMOVED: const upload = require("../middleware/upload"); // Not needed here anymore, image routes moved

// Define Parking Spot Routes

// Public routes (no authentication required)
router.get("/search", parkingSpotController.searchParkingSpots);

// ====================================================================
// CRITICAL FIX: Place /my BEFORE /:id so 'my' is not interpreted as an ID
// ====================================================================

// Protected route for fetching current homeowner's parking spots
// This MUST come before router.get("/:id")
router.get("/my", protect, authorizeHomeowner, (req, res) => {
  // Explicitly pass req.user.user_id to the controller for the homeowner's spots
  parkingSpotController.getHomeownerParkingSpots(req, res, req.user.user_id);
});

// Get single parking spot by ID (General route, comes AFTER more specific ones like /my)
router.get("/:id", parkingSpotController.getParkingSpotById);

// ====================================================================
// End of CRITICAL FIX
// ====================================================================

// Protected routes (authentication required)

// Create new parking spot (Homeowner only)
router.post(
  "/",
  protect,
  authorizeHomeowner,
  parkingSpotController.createParkingSpot
);

// Get all parking spots for a specific homeowner (Legacy/Admin access, uses :homeownerId param)
// This route might eventually be deprecated if /my is sufficient, or kept for admin functions.
router.get(
  "/homeowner/:homeownerId",
  protect,
  authorizeHomeowner,
  parkingSpotController.getHomeownerParkingSpots
);

// Update a parking spot (Homeowner only, and owner of the spot)
router.put(
  "/:id",
  protect,
  authorizeHomeowner,
  parkingSpotController.updateParkingSpot
);

// Delete a parking spot (Homeowner only, and owner of the spot)
router.delete(
  "/:id",
  protect,
  authorizeHomeowner,
  parkingSpotController.deleteParkingSpot
);

// Toggle parking spot availability (Homeowner only, and owner of the spot)
router.patch(
  "/:id/toggle-availability",
  protect,
  authorizeHomeowner,
  parkingSpotController.toggleParkingSpotAvailability
);

// --- REMOVED PARKING SPOT IMAGE MANAGEMENT ROUTES FROM HERE ---
// These routes are now handled by src/routes/imageRoutes.js
// and integrated via app.use("/api/parking-spots", imageRoutes); in server.js

// REMOVED: router.get("/:id/images", ...);
// REMOVED: router.post("/:id/images", ..., upload.single("image"), ...);
// REMOVED: router.delete("/:spotId/images/:imageId", ...);
// REMOVED: router.patch("/:spotId/images/:imageId/primary", ...);

// --- Driver Specific Routes (for future use) ---
router.get(
  "/driver/:driverId/bookings",
  protect,
  authorizeDriver,
  parkingSpotController.getDriverBookings
);

module.exports = router;
