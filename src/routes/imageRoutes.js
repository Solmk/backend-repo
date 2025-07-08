// Path: parking-app-backend/src/routes/imageRoutes.js

const express = require("express");
const router = express.Router();
const { protect, authorize } = require("../middleware/auth");
const uploadMiddleware = require("../middleware/upload");
const imageController = require("../controllers/imageController");

// Route to upload an image for a specific parking spot
router.post(
  "/:spotId/images",
  protect,
  authorize("homeowner", "admin"),
  uploadMiddleware, // Use the wrapped middleware here
  imageController.uploadImage
);

// Route to set a specific image as primary for a parking spot
router.patch(
  "/:spotId/images/:imageId/primary",
  protect,
  authorize("homeowner", "admin"),
  imageController.setPrimaryImage
);

// Route to delete an image from a parking spot
router.delete(
  "/:spotId/images/:imageId",
  protect,
  authorize("homeowner", "admin"),
  imageController.deleteSpotImage // Corrected function name here
);

module.exports = router;
