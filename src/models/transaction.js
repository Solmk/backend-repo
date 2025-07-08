// Path: parking-app-backend/src/models/transaction.js

const pool = require("../config/db");

const Transaction = {
  /**
   * Creates a new transaction record.
   * Renamed from 'create' for better clarity and consistency with controller.
   * @param {Object} transactionData - Data for the transaction.
   * @param {number} transactionData.userId - The ID of the user performing/owning the transaction record.
   * @param {number} transactionData.bookingId - The ID of the related booking (nullable).
   * @param {number} [transactionData.payerId=null] - The ID of the user who is making the payment (nullable).
   * @param {number} [transactionData.receiverId=null] - The ID of the user who is receiving the payment (nullable).
   * @param {number} transactionData.amount - The transaction amount.
   * @param {string} [transactionData.currency='ETB'] - The currency (e.g., 'ETB', 'USD').
   * @param {string} transactionData.type - Type of transaction (e.g., 'payment', 'payout').
   * @param {string} transactionData.gateway - Payment gateway used (e.g., 'stripe', 'chapa').
   * @param {string} [transactionData.gatewayReferenceId=null] - ID from the payment gateway (e.g., Stripe PaymentIntent ID).
   * @param {string} [transactionData.status='pending'] - Status of the transaction (e.g., 'pending', 'completed').
   * @param {string} [transactionData.description=null] - Optional description.
   * @returns {Promise<Object>} The created transaction object.
   */
  async createTransaction(transactionData) {
    // Renamed from 'create'
    const {
      userId,
      bookingId = null,
      payerId = null,
      receiverId = null,
      amount,
      currency = "ETB",
      type, // Changed from transactionType as per paymentController
      gateway,
      gatewayReferenceId = null,
      status = "pending",
      description = null,
    } = transactionData;

    const query = `
      INSERT INTO transactions (
        user_id, booking_id, payer_id, receiver_id, amount, currency, type, gateway,
        gateway_reference_id, status, description
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const [result] = await pool.query(query, [
      userId,
      bookingId,
      payerId,
      receiverId,
      amount,
      currency,
      type, // Use 'type' directly
      gateway,
      gatewayReferenceId,
      status,
      description,
    ]);

    // Return the created object with the new ID and all input data
    return { transaction_id: result.insertId, ...transactionData };
  },

  /**
   * Finds a transaction by its ID.
   * @param {number} transactionId - The ID of the transaction.
   * @returns {Promise<Object|null>} The transaction object or null.
   */
  async findById(transactionId) {
    const [rows] = await pool.query(
      `SELECT * FROM transactions WHERE transaction_id = ?`,
      [transactionId]
    );
    return rows[0] || null;
  },

  /**
   * Finds a transaction by its payment gateway reference ID.
   * Useful for webhooks where you only get the gateway's ID.
   * @param {string} gatewayReferenceId - The ID from the payment gateway.
   * @returns {Promise<Object|null>} The transaction object or null.
   */
  async findByGatewayReferenceId(gatewayReferenceId) {
    const [rows] = await pool.query(
      `SELECT * FROM transactions WHERE gateway_reference_id = ?`,
      [gatewayReferenceId]
    );
    return rows[0] || null;
  },

  /**
   * Updates the status of a transaction.
   * @param {number} transactionId - The ID of the transaction to update.
   * @param {string} newStatus - The new status (e.g., 'completed', 'failed').
   * @returns {Promise<boolean>} True if updated, false otherwise.
   */
  async updateStatus(transactionId, newStatus) {
    const [result] = await pool.query(
      `UPDATE transactions SET status = ? WHERE transaction_id = ?`,
      [newStatus, transactionId]
    );
    return result.affectedRows > 0;
  },

  /**
   * Finds transactions related to a specific booking.
   * @param {number} bookingId - The ID of the booking.
   * @returns {Promise<Array>} An array of transaction objects.
   */
  async findByBookingId(bookingId) {
    const [rows] = await pool.query(
      `SELECT * FROM transactions WHERE booking_id = ? ORDER BY created_at DESC`,
      [bookingId]
    );
    return rows;
  },

  /**
   * Finds transactions for a specific user, where the user is involved as the primary user, payer, or receiver.
   * @param {number} userId - The ID of the user.
   * @param {string} [type=null] - Optional transaction type to filter by.
   * @param {string} [status=null] - Optional transaction status to filter by.
   * @returns {Promise<Array>} An array of transaction objects.
   */
  async findByUserId(userId, type = null, status = null) {
    let query = `
      SELECT * FROM transactions
      WHERE user_id = ? OR payer_id = ? OR receiver_id = ?
    `;
    const params = [userId, userId, userId];

    if (type) {
      query += ` AND type = ?`;
      params.push(type);
    }
    if (status) {
      query += ` AND status = ?`;
      params.push(status);
    }
    query += ` ORDER BY created_at DESC`;
    const [rows] = await pool.query(query, params);
    return rows;
  },
};

module.exports = Transaction;
