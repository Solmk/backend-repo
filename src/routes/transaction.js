// Path: parking-app-backend/src/routes/transaction.js

const express = require("express");
const { protect, authorize } = require("../middleware/auth");
const {
  createTransaction,
  getMyTransactions,
  getTransactionById,
  updateTransactionStatus,
} = require("../controllers/transaction");

const router = express.Router();

// Routes for users to view their transactions
router.get("/my", protect, getMyTransactions);
router.get("/:id", protect, getTransactionById);

// Admin or internal system routes for creating/updating transactions
router.post("/", protect, authorize("admin"), createTransaction); // Or other specific internal auth
router.put("/:id/status", protect, authorize("admin"), updateTransactionStatus); // Or specific internal auth

module.exports = router;
