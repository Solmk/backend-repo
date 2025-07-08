// Path: parking-app-backend/src/controllers/notification.js

const Notification = require("../models/notification"); // Import your Notification model

/**
 * Get all notifications for the authenticated user, with optional unread filter.
 * @route GET /api/notifications/my
 * @access Private
 */
const getNotifications = async (req, res) => {
  // Renamed from getMyNotifications
  const userId = req.user.user_id;
  // Use 'unread' query param (from frontend) instead of 'unreadOnly' for consistency
  const unreadOnly = req.query.unread === "true";

  try {
    const notifications = await Notification.findByUserId(userId, unreadOnly);
    res.status(200).json(notifications);
  } catch (error) {
    console.error("Error fetching user notifications:", error);
    res.status(500).json({
      message: "Server error fetching notifications.",
      error: error.message,
    });
  }
};

/**
 * Mark a specific notification as read, or all notifications as read for the user.
 * This function now handles both scenarios.
 * @route PUT /api/notifications/:id/read (for single)
 * @route PUT /api/notifications/mark-all-read (for all)
 * @access Private
 */
const markNotificationAsRead = async (req, res) => {
  // If `id` is present in params, it's a specific notification. If not, it's 'mark all read'.
  const notificationId = req.params.id || null;
  const userId = req.user.user_id; // Authenticated user ID

  try {
    // Correct order for Notification.markAsRead: (userId, notificationId)
    const updated = await Notification.markAsRead(userId, notificationId);
    if (updated) {
      res.status(200).json({
        message: notificationId
          ? "Notification marked as read."
          : "All notifications marked as read.",
      });
    } else {
      res
        .status(404)
        .json({ message: "Notification(s) not found or already read." });
    }
  } catch (error) {
    console.error("Error marking notification(s) as read:", error);
    res.status(500).json({
      message: "Server error marking notification(s) as read.",
      error: error.message,
    });
  }
};

/**
 * Deletes a specific notification.
 * Ensures the authenticated user is authorized to delete the notification
 * (either by ownership or if they are an an admin).
 *
 * @route DELETE /api/notifications/:id
 * @access Private (owner of notification or admin)
 */
const deleteNotification = async (req, res) => {
  const notificationId = req.params.id; // Notification ID from params
  const userId = req.user.user_id; // Authenticated user ID
  const userType = req.user.user_type; // Authenticated user type

  try {
    // First, find the notification to check ownership
    const notification = await Notification.findById(notificationId);
    if (!notification) {
      return res.status(404).json({ message: "Notification not found." });
    }

    // Authorization check: Only the owner of the notification or an admin can delete it.
    if (notification.user_id !== userId && userType !== "admin") {
      return res
        .status(403)
        .json({ message: "Not authorized to delete this notification." });
    }

    // FIX: Pass userId to the model's delete method for security
    const deleted = await Notification.delete(notificationId, userId);
    if (deleted) {
      res.status(200).json({ message: "Notification deleted successfully." });
    } else {
      res.status(400).json({ message: "Failed to delete notification." });
    }
  } catch (error) {
    console.error("Error deleting notification:", error);
    res.status(500).json({
      message: "Server error deleting notification.",
      error: error.message,
    });
  }
};

module.exports = {
  getNotifications, // Export the renamed function
  markNotificationAsRead,
  deleteNotification,
};
