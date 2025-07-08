// Path: parking-app-backend/src/controllers/spotAvailability.js

const SpotAvailability = require("../models/spotAvailability");
const ParkingSpot = require("../models/parkingSpot"); // To verify spot ownership
const Joi = require("joi"); // Import Joi for request validation

// Joi schema for creating new availability slots
const createAvailabilitySchema = Joi.object({
  startTime: Joi.date().iso().required().messages({
    "date.format":
      "Start time must be a valid ISO 8601 date string (e.g., YYYY-MM-DDTHH:mm:ssZ).",
    "any.required": "Start time is required.",
  }),
  endTime: Joi.date().iso().required().messages({
    "date.format":
      "End time must be a valid ISO 8601 date string (e.g., YYYY-MM-DDTHH:mm:ssZ).",
    "any.required": "End time is required.",
  }),
})
  .custom((value, helpers) => {
    // Custom validation: endTime must be after startTime
    if (new Date(value.startTime) >= new Date(value.endTime)) {
      return helpers.error("any.invalid", {
        message: "End time must be after start time.",
      });
    }
    // Custom validation: availability cannot be set in the past
    if (new Date(value.endTime) <= new Date()) {
      return helpers.error("any.invalid", {
        message: "Availability cannot be set in the past.",
      });
    }
    return value;
  })
  .unknown(false); // Disallow unknown fields

// Joi schema for updating an availability slot
const updateAvailabilitySchema = Joi.object({
  startTime: Joi.date().iso().optional().messages({
    "date.format": "Start time must be a valid ISO 8601 date string.",
  }),
  endTime: Joi.date().iso().optional().messages({
    "date.format": "End time must be a valid ISO 8601 date string.",
  }),
  isBooked: Joi.boolean().optional(),
})
  .min(1)
  .custom((value, helpers) => {
    // If both startTime and endTime are provided for update, validate their order
    if (value.startTime && value.endTime) {
      if (new Date(value.startTime) >= new Date(value.endTime)) {
        return helpers.error("any.invalid", {
          message: "New end time must be after new start time.",
        });
      }
    }
    // You might want to add a check here to ensure updated end time is not in the past
    // if (value.endTime && new Date(value.endTime) <= new Date()) {
    //   return helpers.error('any.invalid', { message: 'New end time cannot be in the past.' });
    // }
    return value;
  })
  .unknown(false); // At least one field required, disallow unknown fields

/**
 * Creates new availability slots for a parking spot.
 * @route POST /api/spots/:spotId/availability
 * @access Private (Homeowner)
 */
const createSpotAvailability = async (req, res) => {
  const { spotId } = req.params;
  const homeownerId = req.user.user_id;

  // 1. Validate request body using Joi
  const { error, value } = createAvailabilitySchema.validate(req.body, {
    abortEarly: false,
  });
  if (error) {
    const messages = error.details.map((detail) => detail.message);
    return res.status(400).json({
      message: "Validation error: " + messages.join(", "),
      errors: error.details,
    });
  }

  // Destructure validated values
  const { startTime, endTime } = value;

  try {
    // 2. Verify parking spot exists
    const spot = await ParkingSpot.findById(spotId);
    if (!spot) {
      return res.status(404).json({ message: "Parking spot not found." });
    }
    // 3. Ensure the authenticated user owns this spot
    if (spot.homeowner_id !== homeownerId && req.user.user_type !== "admin") {
      return res.status(403).json({
        message: "Not authorized to manage availability for this spot.",
      });
    }

    // 4. Check for overlaps with existing availability (non-booked slots)
    // Pass ISO strings directly to model; model will handle MySQL datetime conversion
    const isAvailable = await SpotAvailability.isTimeRangeAvailable(
      spotId,
      startTime, // Already validated ISO string
      endTime // Already validated ISO string
    );
    if (!isAvailable) {
      return res.status(409).json({
        message:
          "The proposed time range overlaps with existing availability for this spot.",
      });
    }

    // 5. Create the availability slot
    const newAvailability = await SpotAvailability.createAvailability({
      spotId,
      startTime: startTime, // Pass ISO string
      endTime: endTime, // Pass ISO string
    });
    res.status(201).json({
      message: "Availability added successfully!",
      availability: newAvailability,
    });
  } catch (error) {
    console.error("Error creating spot availability:", error);
    res.status(500).json({
      message: "Server error creating availability.",
      error: error.message,
    });
  }
};

/**
 * Gets availability slots for a specific parking spot.
 * @route GET /api/spots/:spotId/availability
 * @access Public
 */
const getSpotAvailability = async (req, res) => {
  const { spotId } = req.params;
  const { start, end } = req.query; // Optional filters (expected to be ISO strings)

  // Basic validation for spotId
  if (isNaN(parseInt(spotId, 10)) || parseInt(spotId, 10) <= 0) {
    return res.status(400).json({ message: "Invalid spot ID format." });
  }

  try {
    // Optionally validate start/end query parameters using Joi if strict validation is needed
    // For now, assuming model can handle valid or null values passed directly.
    const availability = await SpotAvailability.findBySpotId(
      spotId,
      start, // Pass as is; model can handle null or valid date string
      end // Pass as is; model can handle null or valid date string
    );
    res.status(200).json(availability);
  } catch (error) {
    console.error("Error fetching spot availability:", error);
    res.status(500).json({
      message: "Server error fetching availability.",
      error: error.message,
    });
  }
};

/**
 * Updates an existing availability slot.
 * @route PUT /api/spots/availability/:availabilityId
 * @access Private (Homeowner)
 */
const updateSpotAvailability = async (req, res) => {
  const { availabilityId } = req.params;
  const homeownerId = req.user.user_id;

  // 1. Validate request body using Joi
  const { error, value } = updateAvailabilitySchema.validate(req.body, {
    abortEarly: false,
  });
  if (error) {
    const messages = error.details.map((detail) => detail.message);
    return res.status(400).json({
      message: "Validation error: " + messages.join(", "),
      errors: error.details,
    });
  }

  const updateData = { ...value }; // Use the validated values directly

  try {
    // 2. Find the availability slot
    const availability = await SpotAvailability.findById(availabilityId);
    if (!availability) {
      return res.status(404).json({ message: "Availability slot not found." });
    }

    // 3. Find the associated parking spot and verify ownership
    const spot = await ParkingSpot.findById(availability.spot_id);
    if (
      !spot ||
      (spot.homeowner_id !== homeownerId && req.user.user_type !== "admin")
    ) {
      return res
        .status(403)
        .json({ message: "Not authorized to update this availability slot." });
    }

    // 4. If start/end times are updated, perform overlap check
    if (updateData.startTime || updateData.endTime) {
      // Use existing values if not updated in the current request
      const newStartTime = updateData.startTime || availability.start_time;
      const newEndTime = updateData.endTime || availability.end_time;

      // Note: Joi already handled `newStartTime >= newEndTime` if both are provided in the request body.
      // This check here is for consistency if only one date is updated, or to handle edge cases
      // with the original availability's dates.
      if (new Date(newStartTime) >= new Date(newEndTime)) {
        return res
          .status(400)
          .json({ message: "New end time must be after new start time." });
      }

      const isAvailable = await SpotAvailability.isTimeRangeAvailable(
        availability.spot_id,
        newStartTime, // Pass ISO string
        newEndTime, // Pass ISO string
        availabilityId // Exclude current slot from overlap check
      );
      if (!isAvailable) {
        return res.status(409).json({
          message:
            "The proposed time range overlaps with other availability slots.",
        });
      }
    }

    // 5. Update the availability slot
    const updated = await SpotAvailability.updateAvailability(
      availabilityId,
      updateData // Pass the validated and processed update data
    );
    if (updated) {
      res.status(200).json({ message: "Availability updated successfully!" });
    } else {
      res.status(400).json({ message: "Failed to update availability." });
    }
  } catch (error) {
    console.error("Error updating spot availability:", error);
    res.status(500).json({
      message: "Server error updating availability.",
      error: error.message,
    });
  }
};

/**
 * Deletes an availability slot.
 * @route DELETE /api/spots/availability/:availabilityId
 * @access Private (Homeowner)
 */
const deleteSpotAvailability = async (req, res) => {
  const { availabilityId } = req.params;
  const homeownerId = req.user.user_id;

  // Basic validation for availabilityId
  if (
    isNaN(parseInt(availabilityId, 10)) ||
    parseInt(availabilityId, 10) <= 0
  ) {
    return res.status(400).json({ message: "Invalid availability ID format." });
  }

  try {
    const availability = await SpotAvailability.findById(availabilityId);
    if (!availability) {
      return res.status(404).json({ message: "Availability slot not found." });
    }

    const spot = await ParkingSpot.findById(availability.spot_id);
    if (
      !spot ||
      (spot.homeowner_id !== homeownerId && req.user.user_type !== "admin")
    ) {
      return res
        .status(403)
        .json({ message: "Not authorized to delete this availability slot." });
    }

    if (availability.is_booked) {
      return res
        .status(400)
        .json({ message: "Cannot delete a booked availability slot." });
    }

    const deleted = await SpotAvailability.deleteAvailability(availabilityId);
    if (deleted) {
      res.status(200).json({ message: "Availability deleted successfully!" });
    } else {
      res.status(400).json({ message: "Failed to delete availability." });
    }
  } catch (error) {
    console.error("Error deleting spot availability:", error);
    res.status(500).json({
      message: "Server error deleting availability.",
      error: error.message,
    });
  }
};

module.exports = {
  createSpotAvailability,
  getSpotAvailability,
  updateSpotAvailability,
  deleteSpotAvailability,
};
