// Path: parking-app-backend/src/models/notification.js

const pool = require("../config/db"); // Database connection pool

// The Notification model object, containing methods for interacting with the notifications table.
const Notification = {
  /**
   * Creates a new notification record in the database.
   *
   * @param {Object} notificationData - Data for the new notification.
   * @param {number} notificationData.userId - The ID of the user who will receive the notification.
   * @param {string} notificationData.relatedEntityType - The type of entity this notification is related to
   * (e.g., 'booking', 'spot', 'review', 'transaction', 'user', 'system'). This maps to the ENUM in your DB schema.
   * @param {number} [notificationData.relatedEntityId=null] - The ID of the specific entity (e.g., booking_id if type is 'booking').
   * Defaults to null if not provided.
   * @param {string} notificationData.message - The text content of the notification.
   * @returns {Promise<Object>} A promise that resolves to the created notification object, including its new ID.
   */
  async create(notificationData) {
    const {
      userId,
      relatedEntityType,
      relatedEntityId = null,
      message,
    } = notificationData;
    // The 'is_read' and 'created_at' columns have default values in the database schema,
    // so we don't need to explicitly include them in the INSERT statement.
    const query = `
      INSERT INTO notifications (user_id, related_entity_type, related_entity_id, message)
      VALUES (?, ?, ?, ?)
    `;
    const [result] = await pool.query(query, [
      userId,
      relatedEntityType,
      relatedEntityId,
      message,
    ]);

    // Return a composite object of the newly inserted notification data.
    return {
      notification_id: result.insertId, // The auto-generated ID from the database
      user_id: userId,
      related_entity_type: relatedEntityType,
      related_entity_id: relatedEntityId,
      message: message,
      is_read: false, // Assuming default is false from DB
      created_at: new Date(), // Assuming default is current timestamp from DB
    };
  },

  /**
   * Finds a specific notification by its ID.
   *
   * @param {number} notificationId - The unique ID of the notification to find.
   * @returns {Promise<Object|null>} A promise that resolves to the notification object if found,
   * or null if no notification with the given ID exists.
   */
  async findById(notificationId) {
    const [rows] = await pool.query(
      `SELECT * FROM notifications WHERE notification_id = ?`,
      [notificationId]
    );
    // Return the first row (the notification object) or null if no rows were returned.
    return rows[0] || null;
  },

  /**
   * Finds all notifications for a specific user.
   * Can optionally filter to retrieve only unread notifications.
   *
   * @param {number} userId - The ID of the user whose notifications are to be fetched.
   * @param {boolean} [unreadOnly=false] - Optional. If true, only notifications where `is_read` is FALSE will be returned.
   * @returns {Promise<Array>} A promise that resolves to an array of notification objects,
   * ordered by `created_at` in descending order (newest first).
   */
  async findByUserId(userId, unreadOnly = false) {
    let query = `SELECT * FROM notifications WHERE user_id = ?`;
    const params = [userId]; // Parameters for the SQL query

    if (unreadOnly) {
      query += ` AND is_read = FALSE`; // Add condition to filter for unread notifications
    }
    query += ` ORDER BY created_at DESC`; // Order results by creation time, newest first

    const [rows] = await pool.query(query, params);
    return rows; // Return the array of found notifications
  },

  /**
   * Marks one or all notifications for a given user as read.
   *
   * @param {number} userId - The ID of the user whose notifications are to be marked.
   * @param {number} [notificationId=null] - Optional. If provided, only this specific notification
   * will be marked as read. If null, all notifications for the `userId` will be marked as read.
   * @returns {Promise<boolean>} A promise that resolves to true if any notifications were updated,
   * false otherwise.
   */
  async markAsRead(userId, notificationId = null) {
    let query = `UPDATE notifications SET is_read = TRUE WHERE user_id = ?`;
    const params = [userId];

    if (notificationId) {
      query += ` AND notification_id = ?`; // Add condition for specific notification ID
      params.push(notificationId);
    }

    const [result] = await pool.query(query, params);
    return result.affectedRows > 0; // Returns true if one or more rows were updated
  },

  /**
   * Deletes a specific notification from the database, ensuring it belongs to the user.
   *
   * @param {number} notificationId - The ID of the notification to delete.
   * @param {number} userId - The ID of the user who owns the notification (for security).
   * @returns {Promise<boolean>} A promise that resolves to true if the notification was deleted,
   * false otherwise.
   */
  async delete(notificationId, userId) {
    // Added userId parameter for security
    const [result] = await pool.query(
      `DELETE FROM notifications WHERE notification_id = ? AND user_id = ?`, // Added user_id to WHERE clause
      [notificationId, userId]
    );
    return result.affectedRows > 0; // Returns true if a row was deleted
  },
};

// Export the entire Notification object, making all its methods available
module.exports = Notification;
