// Path: parking-app-backend/src/controllers/booking.js

const Booking = require("../models/booking");
const ParkingSpot = require("../models/parkingSpot"); // Ensure ParkingSpot model is imported to check spot ownership
const Joi = require("joi"); // Assuming Joi is used for validation

// Joi schema for creating a booking
const createBookingSchema = Joi.object({
  spotId: Joi.number().integer().positive().required(),
  // driverId is derived from req.user, not from body. Remove from schema if not expected in body.
  // If frontend explicitly sends it, Joi will flag it if .unknown(false) is used.
  startTime: Joi.date().iso().required().messages({
    "date.format": "Start time must be a valid ISO 8601 date string.",
    "any.required": "Start time is required.",
  }),
  endTime: Joi.date().iso().required().messages({
    "date.format": "End time must be a valid ISO 8601 date string.",
    "any.required": "End time is required.",
  }),
  totalPrice: Joi.number().positive().precision(2).required(),
  stripePaymentIntentId: Joi.string().max(255).allow(null, "").optional(), // Added as per DB schema
}).unknown(false); // Disallow unknown fields in the request body for security

// Joi schema for updating booking status
const updateBookingStatusSchema = Joi.object({
  // Backend expects 'status' as the key for update, consistent with DB column
  status: Joi.string()
    .valid(
      "pending",
      "confirmed",
      "rejected",
      "cancelled_by_driver",
      "cancelled_by_homeowner",
      "checked_in",
      "checked_out",
      "completed"
    )
    .required(),
  // Frontend might send these, but backend model should typically set them via NOW()
  // Include them in schema for validation if frontend sends them.
  driverCheckInTime: Joi.date().iso().optional(),
  driverCheckOutTime: Joi.date().iso().optional(),
  homeownerConfirmTime: Joi.date().iso().optional(), // Corrected from homeownerCheckInTime as per DB schema
  homeownerRejectTime: Joi.date().iso().optional(), // Corrected from homeownerCheckOutTime as per DB schema
}).unknown(false);

// Joi schema for updating payment status
const updatePaymentStatusSchema = Joi.object({
  paymentStatus: Joi.string()
    .valid("pending", "paid", "refunded", "failed")
    .required(), // Added 'failed' as per DB enum
  stripePaymentIntentId: Joi.string().max(255).optional().allow(null, ""), // If payment intent ID is updated with status
}).unknown(false);

// Controller to create a new booking
exports.createBooking = async (req, res) => {
  // driverId MUST come from the authenticated user's token, not the request body for security
  const driverId = req.user.user_id;

  // Validate request body using the schema. Frontend sends camelCase.
  const { error, value } = createBookingSchema.validate(req.body, {
    abortEarly: false,
  });
  if (error) {
    const messages = error.details.map((detail) => detail.message);
    return res.status(400).json({
      message: "Validation error: " + messages.join(", "),
      errors: error.details,
    });
  }

  // Combine validated data with the driverId from the token
  const bookingData = {
    spot_id: value.spotId, // Convert to snake_case for model (which likely uses snake_case for DB columns)
    driver_id: driverId, // Use the driverId from the token
    start_time: value.startTime, // Pass as ISO string
    end_time: value.endTime, // Pass as ISO string
    total_price: value.totalPrice, // Ensure price is number
    // payment_status will default to 'pending' in the model
    // booking_status will default to 'pending' in the model
    stripe_payment_intent_id: value.stripePaymentIntentId, // Pass through if provided
  };

  try {
    const newBooking = await Booking.create(bookingData); // Model expects snake_case for DB columns
    res
      .status(201)
      .json({ message: "Booking created successfully!", booking: newBooking });
  } catch (error) {
    // Custom error handling for conflicts/not found from model
    if (error.statusCode === 404) {
      // e.g., spot not found
      return res.status(404).json({ message: error.message });
    }
    if (error.statusCode === 409) {
      // e.g., booking overlap
      return res.status(409).json({ message: error.message });
    }
    console.error("Error creating booking:", error);
    res.status(500).json({
      message: "Server error creating booking.",
      error: error.message,
    });
  }
};

// Controller to get a single booking by ID
exports.getBookingById = async (req, res) => {
  const { id } = req.params;
  const userId = req.user.user_id;
  const userType = req.user.user_type;

  // Basic validation for ID
  if (isNaN(parseInt(id, 10))) {
    return res.status(400).json({ message: "Invalid booking ID format." });
  }

  try {
    const booking = await Booking.findById(id);
    if (!booking) {
      return res.status(404).json({ message: "Booking not found." });
    }

    // Authorization check: Only driver, homeowner of the spot, or admin can view
    if (
      booking.driver_id !== userId && // User is the driver
      booking.homeowner_id !== userId && // User is the homeowner of the spot
      userType !== "admin"
    ) {
      return res.status(403).json({
        message: "Forbidden: You are not authorized to view this booking.",
      });
    }

    res.status(200).json(booking);
  } catch (error) {
    console.error("Error fetching booking:", error);
    res.status(500).json({
      message: "Server error fetching booking.",
      error: error.message,
    });
  }
};

// Controller to get all bookings for the authenticated driver
exports.getMyBookings = async (req, res) => {
  const driverId = req.user.user_id; // Get driver ID from authenticated user
  const statusFilter = req.query.status || "all"; // Get status filter from query params

  if (req.user.user_type !== "driver") {
    return res
      .status(403)
      .json({ message: "Forbidden: Only drivers can access this resource." });
  }

  try {
    const bookings = await Booking.findByDriverId(driverId, statusFilter);
    res.status(200).json(bookings);
  } catch (error) {
    console.error("Error fetching driver's bookings:", error);
    res.status(500).json({
      message: "Server error fetching bookings.",
      error: error.message,
    });
  }
};

// Controller to get all bookings for spots owned by the authenticated homeowner
exports.getHomeownerBookings = async (req, res) => {
  const homeownerId = req.user.user_id; // Get homeowner ID from authenticated user
  const statusFilter = req.query.status || "all"; // Get status filter from query params

  if (req.user.user_type !== "homeowner") {
    return res.status(403).json({
      message: "Forbidden: Only homeowners can access this resource.",
    });
  }

  try {
    const bookings = await Booking.findByHomeownerId(homeownerId, statusFilter);
    res.status(200).json(bookings);
  } catch (error) {
    console.error("Error fetching homeowner's bookings:", error);
    res.status(500).json({
      message: "Server error fetching bookings.",
      error: error.message,
    });
  }
};

// Controller to update booking status
exports.updateBookingStatus = async (req, res) => {
  const { id } = req.params;
  const { status } = req.body; // FIX: Expecting 'status' as key from frontend now
  const userId = req.user.user_id;
  const userType = req.user.user_type;

  const { error, value } = updateBookingStatusSchema.validate(
    { status },
    { abortEarly: false }
  );
  if (error) {
    const messages = error.details.map((detail) => detail.message);
    return res.status(400).json({
      message: "Validation error: " + messages.join(", "),
      errors: error.details,
    });
  }

  try {
    const booking = await Booking.findById(id);
    if (!booking) {
      return res.status(404).json({ message: "Booking not found." });
    }

    // Authorization: Only involved parties or admin can change status
    const isDriver = booking.driver_id === userId && userType === "driver";
    const isHomeowner =
      booking.homeowner_id === userId && userType === "homeowner";
    const isAdmin = userType === "admin";

    let timeFieldToUpdate = null; // Field to update with current timestamp

    switch (
      value.status // Use value.status instead of value.bookingStatus
    ) {
      case "confirmed":
        if (!isHomeowner && !isAdmin)
          return res
            .status(403)
            .json({ message: "Only homeowner or admin can confirm bookings." });
        if (booking.booking_status !== "pending")
          return res.status(400).json({
            message: "Booking can only be confirmed from 'pending' status.",
          });
        timeFieldToUpdate = "homeowner_confirm_time"; // This will set NOW() in model
        break;
      case "rejected":
        if (!isHomeowner && !isAdmin)
          return res
            .status(403)
            .json({ message: "Only homeowner or admin can reject bookings." });
        if (booking.booking_status !== "pending")
          return res.status(400).json({
            message: "Booking can only be rejected from 'pending' status.",
          });
        timeFieldToUpdate = "homeowner_reject_time"; // This will set NOW() in model
        break;
      case "cancelled_by_driver":
        if (!isDriver && !isAdmin)
          return res.status(403).json({
            message: "Only the driver or admin can cancel this booking.",
          });
        if (
          [
            "completed",
            "checked_out",
            "rejected",
            "cancelled_by_homeowner",
          ].includes(
            // Add cancelled_by_homeowner to prevent double cancellation
            booking.booking_status
          )
        )
          return res.status(400).json({
            message:
              "Cannot cancel a booking that is already completed, checked out, rejected, or cancelled.",
          });
        break;
      case "cancelled_by_homeowner":
        if (!isHomeowner && !isAdmin)
          return res.status(403).json({
            message: "Only the homeowner or admin can cancel this booking.",
          });
        if (
          [
            "completed",
            "checked_out",
            "rejected",
            "cancelled_by_driver",
          ].includes(
            // Add cancelled_by_driver to prevent double cancellation
            booking.booking_status
          )
        )
          return res.status(400).json({
            message:
              "Cannot cancel a booking that is already completed, checked out, rejected, or cancelled.",
          });
        break;
      case "checked_in":
        if (!isDriver && !isAdmin)
          return res
            .status(403)
            .json({ message: "Only the driver or admin can check-in." });
        if (
          booking.booking_status !== "confirmed" &&
          booking.booking_status !== "pending" // Allow check-in from pending if confirmation is optional
        )
          return res.status(400).json({
            message: "Booking must be 'pending' or 'confirmed' to check-in.",
          });
        timeFieldToUpdate = "driver_check_in_time"; // This will set NOW() in model
        break;
      case "checked_out":
        if (!isDriver && !isAdmin)
          return res
            .status(403)
            .json({ message: "Only the driver or admin can check-out." });
        if (booking.booking_status !== "checked_in")
          return res
            .status(400)
            .json({ message: "Booking must be 'checked_in' to check-out." });
        timeFieldToUpdate = "driver_check_out_time"; // This will set NOW() in model
        break;
      case "completed":
        // A homeowner can complete after checked_out. Admin can complete from almost any state.
        if (!isHomeowner && !isAdmin)
          return res.status(403).json({
            message:
              "Only the homeowner or admin can mark a booking as complete.",
          });
        // If not an admin, must be checked_out to complete
        if (userType !== "admin" && booking.booking_status !== "checked_out")
          return res.status(400).json({
            message:
              "Booking must be 'checked_out' to be marked complete by homeowner.",
          });
        // Admin can force complete if needed, without strict prior status
        break;
      default:
        return res
          .status(400)
          .json({ message: "Invalid booking status transition." });
    }

    // Pass timeFieldToUpdate to the model function
    const updated = await Booking.updateStatus(
      id,
      value.status, // Use value.status for the new status
      timeFieldToUpdate
    );

    if (!updated) {
      return res
        .status(400)
        .json({ message: "Failed to update booking status." });
    }
    res.status(200).json({ message: "Booking status updated successfully." });
  } catch (error) {
    console.error("Error updating booking status:", error);
    res.status(500).json({
      message: "Server error updating booking status.",
      error: error.message,
    });
  }
};

// Controller to update booking payment status
exports.updatePaymentStatus = async (req, res) => {
  const { id } = req.params;
  const { paymentStatus, stripePaymentIntentId } = req.body; // Allow stripePaymentIntentId update here
  const userId = req.user.user_id;
  const userType = req.user.user_type;

  const { error, value } = updatePaymentStatusSchema.validate(
    { paymentStatus, stripePaymentIntentId },
    { abortEarly: false }
  );
  if (error) {
    const messages = error.details.map((detail) => detail.message);
    return res.status(400).json({
      message: "Validation error: " + messages.join(", "),
      errors: error.details,
    });
  }

  try {
    const booking = await Booking.findById(id);
    if (!booking) {
      return res.status(404).json({ message: "Booking not found." });
    }

    // Only homeowner or admin can update payment status
    if (booking.homeowner_id !== userId && userType !== "admin") {
      return res.status(403).json({
        message:
          "Forbidden: You are not authorized to update payment status for this booking.",
      });
    }

    // Prepare fields to update. Booking.updatePaymentStatus in model should accept these.
    const updateFields = { payment_status: value.paymentStatus };
    if (value.stripePaymentIntentId !== undefined) {
      updateFields.stripe_payment_intent_id = value.stripePaymentIntentId;
    }

    // Assuming Booking.updatePaymentStatus now accepts an object for updates
    const updated = await Booking.updatePaymentStatus(id, updateFields);

    if (!updated) {
      return res
        .status(400)
        .json({ message: "Failed to update payment status." });
    }
    res.status(200).json({ message: "Payment status updated successfully." });
  } catch (error) {
    console.error("Error updating payment status:", error);
    res.status(500).json({
      message: "Server error updating payment status.",
      error: error.message,
    });
  }
};

// --- Controller to get all bookings for a specific parking spot ---
// This is used by the frontend to display availability on the booking page.
exports.getBookingsForSpot = async (req, res) => {
  const { spotId } = req.params;
  const userId = req.user.user_id;
  const userType = req.user.user_type;

  if (isNaN(parseInt(spotId, 10))) {
    return res.status(400).json({ message: "Invalid spot ID format." });
  }

  try {
    // First, verify the spot exists and is accessible.
    const spot = await ParkingSpot.findById(spotId);

    if (!spot) {
      return res.status(404).json({ message: "Parking spot not found." });
    }

    // Authorization check: Only the homeowner of the spot or an admin should see ALL detailed bookings.
    // A regular driver accessing this endpoint for availability *might* not need this full authorization,
    // but it's safer to ensure they only see availability that is 'public' or if they are involved.
    // For general availability on booking page, we should ensure the data returned by findBySpotId is safe.
    // If you need more granular control, you might fetch different data based on userType here.
    if (spot.homeowner_id !== userId && userType !== "admin") {
      // If the user is not the homeowner or admin, but is a driver trying to book,
      // they should still get *some* availability info, but perhaps not all booking details.
      // The current findBySpotId in the model only returns booking_id, start_time, end_time, status,
      // which is generally safe for availability display.
      // If you want stricter access and only show a "contact homeowner for availability" message
      // for non-authorized users, then keep this 403. For the purpose of the booking calendar,
      // a driver needs to see already booked times.
      // So, for this specific API, allowing any authenticated user to view the times for availability
      // is reasonable, as the data itself is not sensitive.
      // We will remove the 403 authorization for this specific endpoint, allowing any logged-in user to fetch.
      // The crucial part is that the data returned by findBySpotId should be limited to availability info.
      // For a driver, only public availability (start_time, end_time, status) is relevant.
    }

    // Fetch bookings for the spot. The model function should handle the details returned.
    const bookings = await Booking.findBySpotId(spotId);
    res.status(200).json(bookings);
  } catch (error) {
    console.error("Error fetching bookings for spot:", error);
    res.status(500).json({
      message: "Server error fetching bookings for spot.",
      error: error.message,
    });
  }
};
