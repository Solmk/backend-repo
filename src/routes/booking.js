// Path: parking-app-backend/src/routes/booking.js

const express = require("express");
const { protect, authorize } = require("../middleware/auth"); // Assuming these exist
const {
  createBooking,
  getBookingById,
  getMyBookings,
  getHomeownerBookings,
  updateBookingStatus,
  updatePaymentStatus,
  getBookingsForSpot, // Import the new controller function
} = require("../controllers/booking"); // Ensure this path correctly exports the functions directly

const router = express.Router();

// Driver-specific routes
router.post("/", protect, authorize("driver"), createBooking); // Create a new booking
router.get("/my", protect, authorize("driver"), getMyBookings); // Get bookings made by the driver

// Get bookings for a specific spot (useful for availability calendar view)
// This should be PROTECTED and accessible by driver (to check availability before booking)
// and homeowner of the spot or admin (for management).
// The controller will need to implement authorization logic for getBookingsForSpot.
router.get("/spot/:spotId", protect, getBookingsForSpot); // NEW ROUTE (used by frontend booking page)

// Homeowner-specific routes
router.get(
  "/homeowner-spots",
  protect,
  authorize("homeowner"),
  getHomeownerBookings
); // Changed from /homeowner to /homeowner-spots for clarity and conflict avoidance

// Common routes for both driver/homeowner/admin for specific booking
router.get("/:id", protect, getBookingById); // Get a specific booking by ID (accessible by driver, homeowner, admin)

// FIX: Changed from router.put to router.patch for status updates for consistency
router.patch("/:id/status", protect, updateBookingStatus); // Update booking status (e.g., confirm, reject, cancel, check-in, check-out, complete)
router.patch("/:id/payment-status", protect, updatePaymentStatus); // Update payment status (e.g., mark as paid/refunded)

module.exports = router;
