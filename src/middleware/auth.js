// Path: parking-app-backend/src/middleware/auth.js

const jwt = require("jsonwebtoken");
const User = require("../models/user"); // Assuming you have a User model

// Secret key for JWT (should be in an environment variable)
const JWT_SECRET = process.env.JWT_SECRET || "supersecretjwtkey";

/**
 * Middleware to protect routes: verifies JWT and attaches user to req.
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 * @param {Function} next - Express next middleware function.
 */
exports.protect = async (req, res, next) => {
  let token;

  // Check if Authorization header exists and starts with 'Bearer'
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    token = req.headers.authorization.split(" ")[1];
  }

  if (!token) {
    return res.status(401).json({ message: "Not authorized, no token" });
  }

  try {
    // Verify token
    const decoded = jwt.verify(token, JWT_SECRET);

    // Attach user to the request object (excluding password_hash)
    const user = await User.findById(decoded.user_id);

    if (!user) {
      return res.status(404).json({ message: "No user found with this ID" });
    }

    // IMPORTANT: Attach only necessary user info to req.user for security
    req.user = {
      user_id: user.user_id,
      user_type: user.user_type,
      // Add other non-sensitive fields if needed by other middleware/controllers
      // e.g., first_name: user.first_name
    };
    next();
  } catch (error) {
    console.error("Token verification error:", error);
    if (error.name === "TokenExpiredError") {
      return res
        .status(401)
        .json({ message: "Token expired, please log in again" });
    }
    res.status(401).json({ message: "Not authorized, token failed" });
  }
};

/**
 * Middleware factory to authorize users based on their role(s).
 * This middleware should be used AFTER the 'protect' middleware.
 * Usage: `authorize('admin')` or `authorize(['admin', 'homeowner'])`
 * @param {string|string[]} roles - A single role string or an array of allowed role strings.
 * @returns {Function} Express middleware function.
 */
exports.authorize = (roles) => {
  // Ensure roles is always an array for consistent checking
  const allowedRoles = Array.isArray(roles) ? roles : [roles];

  return (req, res, next) => {
    // req.user must be populated by the 'protect' middleware before this
    if (!req.user || !req.user.user_type) {
      return res
        .status(401)
        .json({ message: "Not authorized, user role not found." });
    }

    // Check if the user's type is included in the allowed roles
    if (allowedRoles.includes(req.user.user_type)) {
      next(); // User has an allowed role, proceed
    } else {
      // User does not have an allowed role, send 403 Forbidden
      res
        .status(403)
        .json({ message: "Access denied. Insufficient privileges." });
    }
  };
};

// Keeping these specific authorize functions for backward compatibility if other routes use them.
// Ideally, you'd migrate all to the generic 'authorize' function.
exports.authorizeHomeowner = (req, res, next) => {
  if (req.user && req.user.user_type === "homeowner") {
    next();
  } else {
    res
      .status(403)
      .json({ message: "Access denied. Homeowner privileges required." });
  }
};

exports.authorizeDriver = (req, res, next) => {
  if (req.user && req.user.user_type === "driver") {
    next();
  } else {
    res
      .status(403)
      .json({ message: "Access denied. Driver privileges required." });
  }
};
