// Path: parking-app-backend/src/utils/jwt.js

const jwt = require("jsonwebtoken");
require("dotenv").config({ path: "../../.env" }); // Adjust path to .env correctly for utils

/**
 * Generates a JWT token for a given payload.
 * @param {Object} payload - The data to encode in the token (e.g., { user_id, user_type }).
 * @returns {string} The generated JWT.
 */
const generateToken = (payload) => {
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: "1d" }); // Token expires in 1 day
};

/**
 * Verifies a JWT token.
 * @param {string} token - The JWT to verify.
 * @returns {Object|null} The decoded payload if valid, otherwise null.
 */
const verifyToken = (token) => {
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    // console.error('JWT verification failed:', error.message); // For debugging
    return null; // Token is invalid or expired
  }
};

module.exports = { generateToken, verifyToken };
