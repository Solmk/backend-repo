// Path: parking-app-backend/src/controllers/review.js

const Review = require("../models/review");
const Booking = require("../models/booking");
const Joi = require("joi"); // Import Joi for validation

// Joi schema for creating a review
const createReviewSchema = Joi.object({
  bookingId: Joi.number().integer().positive().required(),
  rating: Joi.number().integer().min(1).max(5).required().messages({
    "number.base": "Rating must be a number.",
    "number.integer": "Rating must be an integer.",
    "number.min": "Rating must be at least 1.",
    "number.max": "Rating cannot be more than 5.",
    "any.required": "Rating is required.",
  }),
  comment: Joi.string().max(1000).allow(null, "").optional(), // Comment is optional, max 1000 chars
}).unknown(false); // Disallow any other fields in the request body

/**
 * Creates a new review for a completed booking.
 * @route POST /api/reviews
 * @access Private (Driver)
 */
const createReview = async (req, res) => {
  const reviewerId = req.user.user_id; // Authenticated driver ID (from token)

  // 1. Validate request body using Joi
  const { error, value } = createReviewSchema.validate(req.body, {
    abortEarly: false,
  });
  if (error) {
    const messages = error.details.map((detail) => detail.message);
    return res
      .status(400)
      .json({
        message: "Validation error: " + messages.join(", "),
        errors: error.details,
      });
  }

  // Destructure validated values
  const { bookingId, rating, comment } = value;

  try {
    // 2. Verify booking exists
    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return res.status(404).json({ message: "Booking not found." });
    }

    // 3. Ensure reviewer is the driver for this booking
    if (booking.driver_id !== reviewerId) {
      return res
        .status(403)
        .json({ message: "Not authorized to review this booking." });
    }

    // 4. Ensure booking is completed
    if (booking.booking_status !== "completed") {
      return res
        .status(400)
        .json({ message: "Only completed bookings can be reviewed." });
    }

    // 5. Check if a review already exists for this booking (due to unique constraint on booking_id)
    const existingReview = await Review.findByBookingId(bookingId);
    if (existingReview) {
      return res
        .status(409) // Conflict status
        .json({ message: "A review for this booking already exists." });
    }

    // 6. Create the review
    const newReview = await Review.createReview({
      bookingId,
      reviewerId,
      spotId: booking.spot_id, // Get spot ID from booking for consistency
      rating,
      comment: comment || null, // Ensure comment is null if empty string for DB
    });

    res
      .status(201)
      .json({ message: "Review created successfully!", review: newReview });
  } catch (error) {
    console.error("Error creating review:", error);
    res
      .status(500)
      .json({ message: "Server error creating review.", error: error.message });
  }
};

/**
 * Gets reviews for a specific parking spot.
 * @route GET /api/reviews/spot/:spotId
 * @access Public (or private based on design)
 */
const getReviewsForSpot = async (req, res) => {
  const { spotId } = req.params;

  // Basic validation for spotId
  if (isNaN(parseInt(spotId, 10)) || parseInt(spotId, 10) <= 0) {
    return res.status(400).json({ message: "Invalid spot ID format." });
  }

  try {
    // Optional: Check if spot exists if you want to return 404 for non-existent spots
    // const spot = await ParkingSpot.findById(spotId);
    // if (!spot) {
    //   return res.status(404).json({ message: "Parking spot not found." });
    // }

    const reviews = await Review.findBySpotId(spotId);
    res.status(200).json(reviews);
  } catch (error) {
    console.error("Error fetching reviews for spot:", error);
    res.status(500).json({
      message: "Server error fetching reviews.",
      error: error.message,
    });
  }
};

/**
 * Gets reviews made by the authenticated user (driver).
 * @route GET /api/reviews/my
 * @access Private (Driver)
 */
const getMyReviews = async (req, res) => {
  const reviewerId = req.user.user_id; // Authenticated user ID (driver)
  try {
    const reviews = await Review.findByReviewerId(reviewerId);
    res.status(200).json(reviews);
  } catch (error) {
    console.error("Error fetching my reviews:", error);
    res.status(500).json({
      message: "Server error fetching reviews.",
      error: error.message,
    });
  }
};

module.exports = {
  createReview,
  getReviewsForSpot,
  getMyReviews,
};
