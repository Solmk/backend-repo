// Path: parking-app-backend/src/routes/paymentRoutes.js

const express = require("express");
const { protect, authorize } = require("../middleware/auth");
const paymentController = require("../controllers/paymentController");

const router = express.Router();

// Route to create a Payment Intent for Stripe
router.post(
  "/create-payment-intent",
  protect,
  authorize("driver"),
  paymentController.createPaymentIntent
);

// Route to process a Stripe payment (e.g., after client-side confirmation or for webhooks)
// Note: For production, using Stripe webhooks is recommended for final payment status updates
// This route is used in this project for direct client-side update after payment confirmation
router.post(
  "/process-stripe-payment",
  protect,
  authorize("driver"),
  paymentController.processStripePayment
);

module.exports = router;
