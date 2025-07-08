// Path: parking-app-backend/src/routes/auth.js

const express = require("express");
const { register, login } = require("../controllers/auth");

const router = express.Router();

// Public routes for user registration and login
router.post("/register", register);
router.post("/login", login);

module.exports = router;
