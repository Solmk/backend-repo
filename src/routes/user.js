// Path: parking-app-backend/src/routes/user.js

const express = require("express");
const router = express.Router();
// FIX 1: Correct the path to '../controllers/user'
const userController = require("../controllers/user");
const { protect, authorize } = require("../middleware/auth");

// FIX 2: Destructure the functions that are ACTUALLY exported by src/controllers/user.js
// IMPORTANT: You are MISSING registerUser, loginUser, deleteUser, getAllUsers
// in your provided src/controllers/user.js content.
// These will still cause errors if not implemented and exported in user.js controller.
const {
  getMyProfile, // Renamed from getUserProfile
  updateMyProfile, // Renamed from updateUserProfile
  updateUserById, // This one matches!
  // registerUser,    // MISSING in your provided controller
  // loginUser,       // MISSING in your provided controller
  // deleteUser,      // MISSING in your provided controller
  // getAllUsers      // MISSING in your provided controller
} = userController;

// Public routes
// IMPORTANT: These routes will cause errors if registerUser and loginUser
// are not exported from your src/controllers/user.js.
// Assuming placeholder functions for now or that you will add them.
router.post(
  "/register",
  userController.registerUser ||
    ((req, res) =>
      res
        .status(501)
        .json({ message: "Register not implemented in controller." }))
); // Register a new user
router.post(
  "/login",
  userController.loginUser ||
    ((req, res) =>
      res.status(501).json({ message: "Login not implemented in controller." }))
); // Login user

// Protected routes (require JWT)
// Using the correct function names from your provided controller
router.get("/profile", protect, getMyProfile); // Get current user's profile
router.put("/profile", protect, updateMyProfile); // Update current user's profile
// IMPORTANT: deleteUser is missing from your provided controller
router.delete(
  "/profile",
  protect,
  userController.deleteUser ||
    ((req, res) =>
      res.status(501).json({
        message: "Delete User Profile not implemented in controller.",
      }))
); // Delete current user's profile

// Admin routes (require JWT and 'admin' role)
// IMPORTANT: getAllUsers is missing from your provided controller
router.get(
  "/",
  protect,
  authorize("admin"),
  userController.getAllUsers ||
    ((req, res) =>
      res
        .status(501)
        .json({ message: "Get All Users not implemented in controller." }))
); // Get all users (Admin only)
router.put("/:id", protect, authorize("admin"), updateUserById); // Update any user by ID (Admin only)
// IMPORTANT: deleteUser is missing from your provided controller (if it's a separate admin delete)
router.delete(
  "/:id",
  protect,
  authorize("admin"),
  userController.deleteUser ||
    ((req, res) =>
      res
        .status(501)
        .json({ message: "Admin Delete User not implemented in controller." }))
); // Delete any user by ID (Admin only)

module.exports = router;
