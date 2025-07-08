// Path: parking-app-backend/src/controllers/paymentController.js
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const Booking = require("../models/booking"); // Ensure booking model is imported

// Joi is not explicitly used here but can be added for incoming webhook data validation
// const Joi = require('joi');

// Controller to create a Stripe Payment Intent
exports.createPaymentIntent = async (req, res) => {
  const { amount, currency, bookingId } = req.body; // amount should be in cents (integer), currency (e.g., 'usd')

  // Basic validation
  if (!amount || !currency || !bookingId) {
    return res
      .status(400)
      .json({ message: "Amount, currency, and booking ID are required." });
  }

  if (req.user.user_type !== "driver") {
    return res
      .status(403)
      .json({ message: "Forbidden: Only drivers can initiate payments." });
  }

  try {
    console.log(
      `[PaymentController] Creating Payment Intent for Booking ID: ${bookingId}, Amount: ${amount} ${currency}`
    );
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount, // Amount in cents
      currency: currency,
      metadata: { booking_id: bookingId, user_id: req.user.user_id }, // Link to your booking and user in Stripe
      // Add payment_method_types if needed, e.g., ['card']
    });

    console.log(
      `[PaymentController] Payment Intent created with client_secret: ${paymentIntent.client_secret}`
    );
    res.status(200).json({ clientSecret: paymentIntent.client_secret });
  } catch (error) {
    console.error("Error creating Payment Intent:", error.message);
    res.status(500).json({
      message: "Server error creating payment intent.",
      error: error.message,
    });
  }
};

// Controller to process Stripe webhook events or direct payment confirmation (if not using webhooks for final status)
// This function name `processStripePayment` suggests it's a direct API call from the client
// which is less secure/reliable than webhooks for actual payment status updates.
// For simplicity and to fix the current error, we'll assume it's directly called after client confirmation.
// In a production app, use Stripe Webhooks to update booking/payment status.
exports.processStripePayment = async (req, res) => {
  const { bookingId, paymentIntentId, paymentStatus } = req.body;
  const userId = req.user.user_id; // Get user ID from authenticated token

  console.log(
    `[PaymentController] Simulating payment update for Booking ID: ${bookingId} by Driver ID: ${userId}`
  );
  console.log(
    `[PaymentController] Payment Intent ID: ${paymentIntentId}, Desired Status: ${paymentStatus}`
  );

  // Basic validation
  if (!bookingId || !paymentIntentId || !paymentStatus) {
    return res.status(400).json({
      message:
        "Booking ID, Payment Intent ID, and Payment Status are required.",
    });
  }

  try {
    // Retrieve the PaymentIntent from Stripe to verify its status (optional but recommended for security)
    const stripePaymentIntent = await stripe.paymentIntents.retrieve(
      paymentIntentId
    );

    if (!stripePaymentIntent || stripePaymentIntent.status !== "succeeded") {
      console.warn(
        `[PaymentController] Stripe Payment Intent ${paymentIntentId} status is not 'succeeded'. Current status: ${stripePaymentIntent?.status}`
      );
      // You might return an error or handle accordingly if payment is not succeeded
      return res.status(400).json({
        message: `Payment Intent status is not succeeded: ${stripePaymentIntent?.status}`,
      });
    }

    // Update the booking's payment status in your database
    // CORRECTED: Pass an object for updateFields
    const updateFields = {
      payment_status: paymentStatus, // This will be 'paid' based on the frontend logic
      stripe_payment_intent_id: paymentIntentId,
    };

    const updated = await Booking.updatePaymentStatus(bookingId, updateFields);

    if (updated) {
      console.log(
        `[PaymentController] Successfully updated payment status for Booking ID: ${bookingId} to ${paymentStatus}`
      );
      res.status(200).json({ message: "Payment processed successfully!" });
    } else {
      console.warn(
        `[PaymentController] Failed to update payment status in DB for Booking ID: ${bookingId}`
      );
      res
        .status(400)
        .json({ message: "Failed to update payment status in database." });
    }
  } catch (error) {
    console.error("[PaymentController] Error processing payment:", error);
    res.status(500).json({
      message: "Server error processing payment.",
      error: error.message,
    });
  }
};
