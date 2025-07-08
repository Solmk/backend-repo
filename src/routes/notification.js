// // Path: parking-app-backend/src/routes/notification.js

// const express = require("express");
// const { protect } = require("../middleware/auth");
// const {
//   getMyNotifications,
//   markNotificationAsRead,
//   deleteNotification,
// } = require("../controllers/notification");

// const router = express.Router();

// // Routes for authenticated users to manage their notifications
// router.get("/my", protect, getMyNotifications);
// router.put("/:id/read", protect, markNotificationAsRead);
// router.delete("/:id", protect, deleteNotification);

// module.exports = router;
// Path: parking-app-backend/src/routes/notification.js

const express = require("express");
const { protect } = require("../middleware/auth"); // Assuming 'protect' middleware exists

const {
  getNotifications,      // Changed from getMyNotifications
  markNotificationAsRead,
  deleteNotification,
} = require("../controllers/notification"); // Import functions from your existing notification controller file

const router = express.Router();

// Get all notifications for the authenticated user (can be filtered by 'unread=true')
router.get("/my", protect, getNotifications);

// Mark a specific notification as read
router.put("/:id/read", protect, markNotificationAsRead);

// Mark all notifications for the user as read
// This route will hit the same `markNotificationAsRead` controller,
// but `req.params.id` will be undefined, triggering the "mark all" logic.
router.put("/mark-all-read", protect, markNotificationAsRead);

// Delete a specific notification (consider authorization for who can delete)
router.delete("/:id", protect, deleteNotification);

module.exports = router;
