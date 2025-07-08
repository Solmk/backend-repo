// Path: parking-app-backend/src/controllers/parkingSpotController.js

const Joi = require("joi");
const ParkingSpot = require("../models/parkingSpot"); // Ensure ParkingSpot model is imported
const User = require("../models/user"); // Assuming you need user info for some checks (already there)
const fs = require("fs/promises"); // Node's file system module for file operations
const path = require("path"); // Node's path module for path manipulation

// Joi schema for creating a parking spot - NOW EXPECTS CAMELCASE FROM FRONTEND
const createParkingSpotSchema = Joi.object({
  spotName: Joi.string().min(3).max(255).required(),
  description: Joi.string().max(1000).allow(null, ""),
  addressLine1: Joi.string().min(5).max(255).required(),
  addressLine2: Joi.string().max(255).allow(null, ""),
  city: Joi.string().min(2).max(100).required(),
  subCity: Joi.string().max(100).allow(null, ""),
  woreda: Joi.string().max(100).allow(null, ""),
  latitude: Joi.number().min(-90).max(90).required(),
  longitude: Joi.number().min(-180).max(180).required(),
  pricePerHour: Joi.number().precision(2).min(0.01).required(),
  spotType: Joi.string()
    .valid(
      "private_driveway",
      "garage",
      "parking_lot",
      "street_parking",
      "other"
    )
    .required(),
  vehicleSizeAccommodated: Joi.string()
    .valid("small", "medium", "large", "oversized")
    .required(),
  amenities: Joi.array().items(Joi.string()).allow(null).optional(),
  isAvailable: Joi.boolean().default(true),
  status: Joi.string()
    .valid("active", "inactive", "pending_verification", "rejected")
    .default("pending_verification"),
}).unknown(false); // IMPORTANT: Reject unknown fields explicitly

// Joi schema for updating a parking spot (all fields optional, still expects camelCase for consistency)
const updateParkingSpotSchema = Joi.object({
  spotName: Joi.string().min(3).max(255),
  description: Joi.string().max(1000).allow(null, ""),
  addressLine1: Joi.string().min(5).max(255),
  addressLine2: Joi.string().max(255).allow(null, ""),
  city: Joi.string().min(2).max(100),
  subCity: Joi.string().max(100).allow(null, ""),
  woreda: Joi.string().max(100).allow(null, ""),
  latitude: Joi.number().min(-90).max(90),
  longitude: Joi.number().min(-180).max(180),
  pricePerHour: Joi.number().precision(2).min(0.01),
  spotType: Joi.string().valid(
    "private_driveway",
    "garage",
    "parking_lot",
    "street_parking",
    "other"
  ),
  vehicleSizeAccommodated: Joi.string().valid(
    "small",
    "medium",
    "large",
    "oversized"
  ),
  amenities: Joi.array().items(Joi.string()).allow(null).optional(),
  isAvailable: Joi.boolean(),
  status: Joi.string().valid(
    "active",
    "inactive",
    "pending_verification",
    "rejected"
  ),
})
  .min(1)
  .unknown(false); // At least one field must be provided for update, reject unknown

/**
 * @route POST /api/parking-spots
 * @description Create a new parking spot.
 * @access Private (Homeowner)
 */
exports.createParkingSpot = async (req, res) => {
  // Validate request body (now expects camelCase from frontend)
  const { error, value } = createParkingSpotSchema.validate(req.body, {
    abortEarly: false,
  });
  if (error) {
    const messages = error.details.map((detail) => detail.message);
    return res.status(400).json({
      message: "Validation error: " + messages.join(", "),
      errors: error.details,
    });
  }

  // Ensure only homeowners can create spots
  if (req.user.user_type !== "homeowner") {
    return res
      .status(403)
      .json({ message: "Only homeowners can create parking spots." });
  }

  const homeowner_id = req.user.user_id; // Get homeowner_id from authenticated user

  // Map validated camelCase data to snake_case for the database model
  const spotDataForModel = {
    homeowner_id, // Add homeowner_id
    spot_name: value.spotName,
    description: value.description,
    address_line_1: value.addressLine1,
    address_line_2: value.addressLine2,
    city: value.city,
    sub_city: value.subCity,
    woreda: value.woreda,
    latitude: value.latitude,
    longitude: value.longitude,
    price_per_hour: value.pricePerHour,
    spot_type: value.spotType,
    vehicle_size_accommodated: value.vehicleSizeAccommodated,
    amenities: value.amenities, // Array will be stringified in model
    is_available: value.isAvailable,
    status: value.status,
  };

  try {
    const newSpot = await ParkingSpot.createSpot(spotDataForModel); // Pass the mapped data
    res.status(201).json({
      message: "Parking spot created successfully!",
      spot: newSpot,
    });
  } catch (err) {
    console.error("[Controller] Error creating parking spot:", err);
    res.status(500).json({
      message: "Server error creating parking spot.",
      error: err.message,
    });
  }
};

/**
 * @route GET /api/parking-spots/:id
 * @description Get a parking spot by ID.
 * @access Public (but Homeowner's own spots require auth for detailed view)
 */
exports.getParkingSpotById = async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`[ParkingSpotController] Fetching spot ID: ${id}`); // DEBUG
    console.log(
      `[ParkingSpotController] Authenticated user (req.user):`,
      req.user
    ); // DEBUG

    const spot = await ParkingSpot.findById(id);

    console.log(`[ParkingSpotController] Spot data from model:`, spot); // DEBUG

    if (!spot) {
      console.log(`[ParkingSpotController] Spot ${id} not found in DB.`); // DEBUG
      return res.status(404).json({ message: "Parking spot not found." });
    }

    // If authenticated, check if user is homeowner of this spot or admin for full access
    if (req.user) {
      if (
        req.user.user_id === spot.homeowner_id ||
        req.user.user_type === "admin"
      ) {
        console.log(
          `[ParkingSpotController] User ${req.user.user_id} (Type: ${req.user.user_type}) is authorized to view full spot data for ${id}.`
        ); // DEBUG
        // Return full spot data for owner/admin
        return res.status(200).json(spot);
      }
    }

    // For public access, ensure it's active and available, and return less sensitive data if needed
    // The model's findById already fetches everything, so here we just control access.
    // If the spot is not active and available, public users should not see it.
    if (spot.status !== "active" || !spot.is_available) {
      console.log(
        `[ParkingSpotController] Spot ${id} found but not active or available for public view. Status: ${spot.status}, Available: ${spot.is_available}`
      ); // DEBUG
      return res
        .status(404)
        .json({ message: "Parking spot not found or not available." }); // Re-uses 404 for security/simplicity
    }

    // For public view, return the spot as is (assuming findById already sanitizes for public)
    // You might choose to explicitly remove sensitive info if findById returns too much for public.
    console.log(
      `[ParkingSpotController] Spot ${id} returned for public view (active and available).`
    ); // DEBUG
    res.status(200).json(spot);
  } catch (err) {
    console.error("[Controller] Error fetching parking spot:", err);
    res.status(500).json({ message: "Server error fetching parking spot." });
  }
};

/**
 * @route GET /api/parking-spots/homeowner/:homeownerId (or /api/parking-spots/my)
 * @description Get all parking spots for a specific homeowner.
 * @access Private (Homeowner)
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 * @param {number} [idFromToken] - Optional: homeowner ID passed directly from routes (for /my endpoint).
 */
exports.getHomeownerParkingSpots = async (req, res, idFromToken) => {
  try {
    const homeownerId = req.params.homeownerId || req.user.user_id; // Prefer req.user.user_id for 'my' route

    if (!homeownerId) {
      return res.status(400).json({ message: "Homeowner ID is required." });
    }

    // Ensure the authenticated user is the homeowner they are requesting data for
    // If accessing /my endpoint, homeownerId will be req.user.user_id, so it will match.
    if (
      req.user.user_id !== parseInt(homeownerId) && // Convert param to int for strict comparison
      req.user.user_type !== "admin"
    ) {
      return res
        .status(403)
        .json({ message: "Unauthorized access to parking spots." });
    }

    const spots = await ParkingSpot.findByHomeownerId(homeownerId);
    res.status(200).json(spots);
  } catch (err) {
    console.error("[Controller] Error fetching homeowner parking spots:", err);
    res
      .status(500)
      .json({ message: "Server error fetching homeowner parking spots." });
  }
};

/**
 * @route PUT /api/parking-spots/:id
 * @description Update a parking spot.
 * @access Private (Homeowner)
 */
exports.updateParkingSpot = async (req, res) => {
  const { id } = req.params;
  const { error, value } = updateParkingSpotSchema.validate(req.body, {
    abortEarly: false,
  });
  if (error) {
    const messages = error.details.map((detail) => detail.message);
    return res.status(400).json({
      message: "Validation error: " + messages.join(", "),
      errors: error.details,
    });
  }

  try {
    const existingSpot = await ParkingSpot.findById(id);
    if (!existingSpot) {
      return res.status(404).json({ message: "Parking spot not found." });
    }

    // Ensure only the homeowner who owns the spot can update it, or an admin
    if (
      req.user.user_id !== existingSpot.homeowner_id &&
      req.user.user_type !== "admin"
    ) {
      return res.status(403).json({
        message: "Unauthorized to update this parking spot.",
      });
    }

    // Convert camelCase updateData keys to snake_case for the model/database
    const updateDataForModel = {};
    for (const key in value) {
      const snakeCaseKey = key.replace(/([A-Z])/g, "_$1").toLowerCase();
      updateDataForModel[snakeCaseKey] = value[key];
    }

    const updated = await ParkingSpot.updateSpot(id, updateDataForModel); // Pass the mapped data
    if (updated) {
      res.status(200).json({ message: "Parking spot updated successfully!" });
    } else {
      res.status(400).json({
        message: "Failed to update parking spot, or no changes provided.",
      });
    }
  } catch (err) {
    console.error("[Controller] Error updating parking spot:", err);
    res.status(500).json({ message: "Server error updating parking spot." });
  }
};

/**
 * @route DELETE /api/parking-spots/:id
 * @description Delete a parking spot.
 * @access Private (Homeowner)
 */
exports.deleteParkingSpot = async (req, res) => {
  try {
    const { id } = req.params;
    const existingSpot = await ParkingSpot.findById(id);
    if (!existingSpot) {
      return res.status(404).json({ message: "Parking spot not found." });
    }

    // Ensure only the homeowner who owns the spot can delete it, or an admin
    if (
      req.user.user_id !== existingSpot.homeowner_id &&
      req.user.user_type !== "admin"
    ) {
      return res.status(403).json({
        message: "Unauthorized to delete this parking spot.",
      });
    }

    const deleted = await ParkingSpot.deleteSpot(id);
    if (deleted) {
      res.status(200).json({ message: "Parking spot deleted successfully." });
    } else {
      res.status(400).json({ message: "Failed to delete parking spot." });
    }
  } catch (err) {
    console.error("[Controller] Error deleting parking spot:", err);
    res.status(500).json({ message: "Server error deleting parking spot." });
  }
};

/**
 * @route GET /api/parking-spots/search
 * @description Search for parking spots.
 * @access Public
 * @queryParameters city, spotType, vehicleSize, minPrice, maxPrice, latitude, longitude, radius (for spatial search)
 */
exports.searchParkingSpots = async (req, res) => {
  try {
    // Joi schema for search parameters (expects camelCase from frontend query params)
    const searchSchema = Joi.object({
      city: Joi.string().min(2).max(100),
      spotType: Joi.string().valid(
        "private_driveway",
        "garage",
        "parking_lot",
        "street_parking",
        "other"
      ),
      vehicleSize: Joi.string().valid("small", "medium", "large", "oversized"),
      minPrice: Joi.number().precision(2).min(0),
      maxPrice: Joi.number().precision(2).min(0),
      latitude: Joi.number().min(-90).max(90),
      longitude: Joi.number().min(-180).max(180),
      radius: Joi.number().min(0.1), // Radius in km for spatial search
    }).unknown(false); // Reject unknown query parameters

    const { error, value } = searchSchema.validate(req.query);
    if (error) {
      return res.status(400).json({
        message:
          "Validation error: " + error.details.map((d) => d.message).join(", "),
      });
    }

    const criteria = {};
    // Map camelCase from validated query (value) to snake_case for model
    if (value.city) criteria.city = value.city;
    if (value.spotType) criteria.spot_type = value.spotType;
    if (value.vehicleSize)
      criteria.vehicle_size_accommodated = value.vehicleSize;
    if (value.minPrice !== undefined) criteria.min_price = value.minPrice; // Use !== undefined for 0
    if (value.maxPrice !== undefined) criteria.max_price = value.maxPrice; // Use !== undefined for 0
    if (value.latitude) criteria.latitude = value.latitude;
    if (value.longitude) criteria.longitude = value.longitude;
    if (value.radius) criteria.radius = value.radius;

    // IMPORTANT: If 'geom' column is removed from DB, spatial search logic needs careful review.
    if (criteria.latitude && criteria.longitude && criteria.radius) {
      console.warn(
        "[Controller] Spatial search parameters provided. Ensure 'geom' column is managed in DB/Model if spatial filtering is desired."
      );
      // For now, these criteria will be passed to searchSpots.
      // The model's searchSpots function needs to properly handle spatial filtering or ignore these.
    }

    const spots = await ParkingSpot.searchSpots(criteria);
    res.status(200).json(spots);
  } catch (err) {
    console.error("[Controller] Error searching parking spots:", err);
    res.status(500).json({ message: "Server error searching parking spots." });
  }
};

/**
 * @route PATCH /api/parking-spots/:id/toggle-availability
 * @description Toggle the availability of a parking spot.
 * @access Private (Homeowner)
 */
exports.toggleParkingSpotAvailability = async (req, res) => {
  try {
    const { id } = req.params;

    const existingSpot = await ParkingSpot.findById(id);
    if (!existingSpot) {
      return res.status(404).json({ message: "Parking spot not found." });
    }

    // Ensure only the homeowner who owns the spot can toggle availability, or an admin
    if (
      req.user.user_id !== existingSpot.homeowner_id &&
      req.user.user_type !== "admin"
    ) {
      return res.status(403).json({
        message: "Unauthorized to toggle availability for this parking spot.",
      });
    }

    // The current is_available status is existingSpot.is_available.
    // We want to toggle it, so the new status is !existingSpot.is_available.
    const newAvailabilityStatus = !existingSpot.is_available;

    const updated = await ParkingSpot.updateAvailability(
      id,
      newAvailabilityStatus
    );
    if (updated) {
      res.status(200).json({
        message: `Parking spot availability set to ${newAvailabilityStatus}.`,
      });
    } else {
      res
        .status(400)
        .json({ message: "Failed to toggle parking spot availability." });
    }
  } catch (err) {
    console.error(
      "[Controller] Error toggling parking spot availability:",
      err
    );
    res
      .status(500)
      .json({ message: "Server error toggling parking spot availability." });
  }
};

/**
 * @description Placeholder for getting driver-specific bookings.
 * You will need to implement the actual logic for this.
 * @route GET /api/parking-spots/driver/:driverId/bookings
 * @access Private (Driver)
 */
exports.getDriverBookings = async (req, res) => {
  try {
    const { driverId } = req.params;
    // Ensure the authenticated user is the driver they are requesting data for
    if (
      req.user.user_id !== parseInt(driverId) &&
      req.user.user_type !== "admin"
    ) {
      return res
        .status(403)
        .json({ message: "Unauthorized access to driver bookings." });
    }

    // TODO: Implement actual logic to fetch bookings for the given driverId
    // Example: const bookings = await Booking.findByDriverId(driverId);
    const mockBookings = []; // Replace with actual database fetch
    res.status(200).json(mockBookings);
  } catch (err) {
    console.error("[Controller] Error fetching driver bookings:", err);
    res.status(500).json({
      message: "Server error fetching driver bookings.",
      error: err.message,
    });
  }
};

// --- NEW: Joi schema for image upload ---
const imageUploadSchema = Joi.object({
  isPrimary: Joi.boolean().default(false), // Optional field if sent by frontend, defaults to false
});

/**
 * @route GET /api/parking-spots/:id/images
 * @description Get all images for a specific parking spot.
 * @access Private (Homeowner of spot or Admin)
 */
exports.getSpotImages = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.user_id;
    const userType = req.user.user_type;

    // Check if the spot exists and if the user is authorized to view its images
    const spot = await ParkingSpot.findById(id);
    if (!spot) {
      return res.status(404).json({ message: "Parking spot not found." });
    }

    if (spot.homeowner_id !== userId && userType !== "admin") {
      return res.status(403).json({
        message:
          "Forbidden: You are not authorized to view images for this spot.",
      });
    }

    const images = await ParkingSpot.findImagesBySpotId(id); // Assuming model has this
    res.status(200).json(images);
  } catch (err) {
    console.error("[Controller] Error fetching spot images:", err);
    res.status(500).json({ message: "Server error fetching spot images." });
  }
};

/**
 * @route POST /api/parking-spots/:id/images
 * @description Upload a new image for a parking spot.
 * @access Private (Homeowner of spot)
 */
exports.uploadSpotImage = async (req, res) => {
  const { id } = req.params; // spotId
  const userId = req.user.user_id;
  const userType = req.user.user_type;

  // Validate the file upload. Multer puts file info on req.file
  if (!req.file) {
    return res.status(400).json({ message: "No image file provided." });
  }

  // Optional: validate if isPrimary is sent in body
  const { error, value } = imageUploadSchema.validate(req.body);
  if (error) {
    return res.status(400).json({ message: error.details[0].message });
  }

  try {
    const spot = await ParkingSpot.findById(id);
    if (!spot) {
      // If spot not found, delete the uploaded file as it's orphaned
      await fs.unlink(req.file.path);
      return res.status(404).json({ message: "Parking spot not found." });
    }

    if (spot.homeowner_id !== userId && userType !== "admin") {
      // If unauthorized, delete the uploaded file
      await fs.unlink(req.file.path);
      return res.status(403).json({
        message:
          "Forbidden: You are not authorized to upload images for this spot.",
      });
    }

    // Determine if this new image should be primary.
    // If client explicitly sets it, respect that. Otherwise, default to false.
    // If no primary exists, make this the primary.
    let isPrimary = value.isPrimary || false;
    const existingImages = await ParkingSpot.findImagesBySpotId(id);
    if (existingImages.length === 0) {
      isPrimary = true; // Make the first uploaded image primary automatically
    } else if (isPrimary) {
      // If a new image is explicitly set as primary, demote existing primary
      await ParkingSpot.unsetPrimaryImage(id);
    }

    // Move the uploaded file from temp directory to permanent public directory
    const newFileName = req.file.filename; // Multer generates a unique filename
    const newFilePath = path.join("uploads", newFileName); // Path relative to public directory
    const publicUploadsDir = path.join(__dirname, "../../public/uploads");

    // Ensure the uploads directory exists
    await fs.mkdir(publicUploadsDir, { recursive: true });

    await fs.rename(req.file.path, path.join(publicUploadsDir, newFileName));

    const image = await ParkingSpot.addImage(id, newFilePath, isPrimary); // Store relative path

    res.status(201).json({ message: "Image uploaded successfully!", image });
  } catch (err) {
    console.error("[Controller] Error uploading spot image:", err);
    // Attempt to delete the file if an error occurred after successful upload but before DB write
    if (req.file && req.file.path) {
      await fs
        .unlink(req.file.path)
        .catch((e) => console.error("Error deleting temp file:", e));
    }
    res
      .status(500)
      .json({ message: "Server error uploading image.", error: err.message });
  }
};

/**
 * @route DELETE /api/parking-spots/:spotId/images/:imageId
 * @description Delete a specific image from a parking spot.
 * @access Private (Homeowner of spot)
 */
exports.deleteSpotImage = async (req, res) => {
  const { spotId, imageId } = req.params;
  const userId = req.user.user_id;
  const userType = req.user.user_type;

  try {
    const spot = await ParkingSpot.findById(spotId);
    if (!spot) {
      return res.status(404).json({ message: "Parking spot not found." });
    }

    if (spot.homeowner_id !== userId && userType !== "admin") {
      return res.status(403).json({
        message:
          "Forbidden: You are not authorized to delete images for this spot.",
      });
    }

    const image = await ParkingSpot.findImageById(imageId); // Find image to get its path
    if (!image || image.spot_id !== parseInt(spotId)) {
      // Ensure image belongs to this spot
      return res
        .status(404)
        .json({ message: "Image not found for this spot." });
    }

    const deleted = await ParkingSpot.deleteImage(imageId);
    if (deleted) {
      // Delete the actual file from the file system
      const filePath = path.join(__dirname, "../../public", image.image_url); // Reconstruct full path
      await fs
        .unlink(filePath)
        .catch((err) =>
          console.error("Error deleting physical image file:", err)
        );
      res.status(200).json({ message: "Image deleted successfully." });
    } else {
      res.status(400).json({ message: "Failed to delete image." });
    }
  } catch (err) {
    console.error("[Controller] Error deleting spot image:", err);
    res
      .status(500)
      .json({ message: "Server error deleting image.", error: err.message });
  }
};

/**
 * @route PATCH /api/parking-spots/:spotId/images/:imageId/primary
 * @description Set a specific image as the primary image for a parking spot.
 * @access Private (Homeowner of spot)
 */
exports.setPrimaryImage = async (req, res) => {
  const { spotId, imageId } = req.params;
  const userId = req.user.user_id;
  const userType = req.user.user_type;

  try {
    const spot = await ParkingSpot.findById(spotId);
    if (!spot) {
      return res.status(404).json({ message: "Parking spot not found." });
    }

    if (spot.homeowner_id !== userId && userType !== "admin") {
      return res.status(403).json({
        message:
          "Forbidden: You are not authorized to manage images for this spot.",
      });
    }

    // Ensure the image exists and belongs to this spot
    const imageToSetPrimary = await ParkingSpot.findImageById(imageId);
    if (!imageToSetPrimary || imageToSetPrimary.spot_id !== parseInt(spotId)) {
      return res
        .status(404)
        .json({ message: "Image not found for this spot." });
    }

    // 1. Unset any current primary image for this spot
    await ParkingSpot.unsetPrimaryImage(spotId);

    // 2. Set the specified image as primary
    const updated = await ParkingSpot.setPrimaryImage(imageId);

    if (updated) {
      res.status(200).json({ message: "Primary image set successfully." });
    } else {
      res.status(400).json({ message: "Failed to set primary image." });
    }
  } catch (err) {
    console.error("[Controller] Error setting primary image:", err);
    res.status(500).json({
      message: "Server error setting primary image.",
      error: err.message,
    });
  }
};
