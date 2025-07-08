// Path: parking-app-backend/src/controllers/transaction.js

const Transaction = require("../models/transaction");
const Booking = require("../models/booking");
const User = require("../models/user"); // For validating payer/receiver IDs
const Joi = require("joi"); // Import Joi for validation

// Joi schema for creating a new transaction
const createTransactionSchema = Joi.object({
  bookingId: Joi.number().integer().positive().allow(null).optional(), // Can be null as per DB
  payerId: Joi.number().integer().positive().allow(null).optional(), // Can be null
  receiverId: Joi.number().integer().positive().allow(null).optional(), // Can be null
  amount: Joi.number().positive().precision(2).required(),
  currency: Joi.string().valid("ETB", "USD").default("ETB"), // Match DB enum and default
  type: Joi.string()
    .valid("booking_payment", "payout", "refund", "platform_fee")
    .required(), // Match DB enum
  gateway: Joi.string().max(50).required(),
  gatewayReferenceId: Joi.string().max(255).allow(null, "").optional(), // Match DB and allow null/empty
  status: Joi.string()
    .valid("pending", "completed", "failed", "refunded")
    .default("pending"), // Match DB enum
  description: Joi.string().max(1000).allow(null, "").optional(),
}).unknown(false); // Disallow unknown fields

// Joi schema for updating transaction status
const updateTransactionStatusSchema = Joi.object({
  status: Joi.string()
    .valid("pending", "completed", "failed", "refunded")
    .required(),
}).unknown(false);

/**
 * @route POST /api/transactions
 * @description Creates a new transaction record.
 * This endpoint is typically used by internal systems or admins, not directly by general users.
 * @access Private (Admin, or internal server processes)
 */
const createTransaction = async (req, res) => {
  // Assuming the user initiating this action (e.g., admin) or the system itself
  // is recorded as the 'user_id' in the transaction table.
  // For simplicity, if this is an admin route, userId could be req.user.user_id.
  // If this is called internally by webhooks, you might not use req.user.user_id here directly.
  // For now, let's assume it's an admin-initiated creation.
  const userId = req.user?.user_id; // Get user from authenticated context, if available

  // Validate request body
  const { error, value } = createTransactionSchema.validate(req.body, {
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

  // Combine validated data with the userId (if applicable)
  const transactionData = {
    ...value, // Joi already processed and mapped types
    userId: userId, // Add the user_id for the record creator/initiator
  };

  try {
    // Optional: Validate payer/receiver IDs exist if they are provided
    if (transactionData.payerId) {
      const payer = await User.findById(transactionData.payerId);
      if (!payer) return res.status(400).json({ message: "Payer not found." });
    }
    if (transactionData.receiverId) {
      const receiver = await User.findById(transactionData.receiverId);
      if (!receiver)
        return res.status(400).json({ message: "Receiver not found." });
    }

    // Optional: Validate bookingId if transactionType is 'booking_payment'
    if (
      transactionData.type === "booking_payment" &&
      transactionData.bookingId
    ) {
      const booking = await Booking.findById(transactionData.bookingId);
      if (!booking) {
        return res
          .status(404)
          .json({ message: "Associated booking not found." });
      }
    }

    const newTransaction = await Transaction.create(transactionData);

    // If it's a booking payment and successful, update booking status
    // Note: Stripe webhook handles payment status updates for bookings.
    // This logic here might be for manual transaction creation by admin.
    if (
      newTransaction.type === "booking_payment" &&
      newTransaction.status === "completed" && // Check if the transaction itself is completed
      newTransaction.bookingId
    ) {
      // Only update if booking payment status isn't already 'paid'
      const bookingToUpdate = await Booking.findById(newTransaction.bookingId);
      if (bookingToUpdate && bookingToUpdate.payment_status !== "paid") {
        await Booking.updatePaymentStatus(newTransaction.bookingId, "paid");
        // You might also want to confirm the booking here if it was pending
        if (bookingToUpdate.booking_status === "pending") {
          await Booking.updateStatus(
            newTransaction.bookingId,
            "confirmed",
            "homeowner_confirm_time"
          );
        }
      }
    }

    res.status(201).json({
      message: "Transaction recorded successfully!",
      transaction: newTransaction,
    });
  } catch (error) {
    console.error("Error creating transaction:", error);
    res.status(500).json({
      message: "Server error creating transaction.",
      error: error.message,
    });
  }
};

/**
 * @route GET /api/transactions/my
 * @description Gets transactions for the authenticated user (as user_id, payer_id, or receiver_id).
 * @access Private
 */
const getMyTransactions = async (req, res) => {
  const userId = req.user.user_id;
  const { type, status } = req.query; // Optional filters: ?type=booking_payment&status=completed

  try {
    const transactions = await Transaction.findByUserId(userId, type, status);
    res.status(200).json(transactions);
  } catch (error) {
    console.error("Error fetching user transactions:", error);
    res.status(500).json({
      message: "Server error fetching transactions.",
      error: error.message,
    });
  }
};

/**
 * @route GET /api/transactions/:id
 * @description Gets a specific transaction by ID.
 * @access Private (involved parties or admin)
 */
const getTransactionById = async (req, res) => {
  const { id } = req.params;
  const userId = req.user.user_id;
  const userType = req.user.user_type;

  try {
    const transaction = await Transaction.findById(id);
    if (!transaction) {
      return res.status(404).json({ message: "Transaction not found." });
    }

    // Authorization: Only the user_id, payer_id, receiver_id or admin can view
    const isRelated =
      transaction.user_id === userId ||
      transaction.payer_id === userId ||
      transaction.receiver_id === userId;

    if (!isRelated && userType !== "admin") {
      return res
        .status(403)
        .json({ message: "Not authorized to view this transaction." });
    }

    res.status(200).json(transaction);
  } catch (error) {
    console.error("Error fetching transaction by ID:", error);
    res.status(500).json({
      message: "Server error fetching transaction.",
      error: error.message,
    });
  }
};

/**
 * @route PUT /api/transactions/:id/status
 * @description Updates the status of a transaction (typically for admin or webhook use).
 * @access Private (Admin or internal system)
 */
const updateTransactionStatus = async (req, res) => {
  const { id } = req.params; // Transaction ID
  const { status } = req.body; // Only status is expected from body for this endpoint

  // Validate request body
  const { error, value } = updateTransactionStatusSchema.validate(
    { status },
    { abortEarly: false }
  );
  if (error) {
    const messages = error.details.map((d) => d.message);
    return res
      .status(400)
      .json({
        message: "Validation error: " + messages.join(", "),
        errors: error.details,
      });
  }

  // Ensure only admins or internal systems can change transaction status this way
  // (Assuming webhook handler has its own logic and doesn't use this route)
  if (req.user.user_type !== "admin") {
    return res
      .status(403)
      .json({
        message: "Forbidden: Only admins can update transaction status.",
      });
  }

  try {
    // Check if transaction exists
    const transaction = await Transaction.findById(id);
    if (!transaction) {
      return res.status(404).json({ message: "Transaction not found." });
    }

    const updated = await Transaction.updateStatus(id, value.status); // Use validated status
    if (updated) {
      res
        .status(200)
        .json({ message: "Transaction status updated successfully!" });
    } else {
      res.status(400).json({ message: "Failed to update transaction status." });
    }
  } catch (error) {
    console.error("Error updating transaction status:", error);
    res.status(500).json({
      message: "Server error updating transaction status.",
      error: error.message,
    });
  }
};

module.exports = {
  createTransaction,
  getMyTransactions,
  getTransactionById,
  updateTransactionStatus,
};
