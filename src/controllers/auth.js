// Path: parking-app-backend/src/controllers/auth.js

// Import specific functions directly from your user controller
// These functions already handle validation, hashing, DB interaction, and token generation
const { registerUser, loginUser } = require("./user");

/**
 * Handles user registration by calling the registerUser function from the user controller.
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 */
const register = async (req, res) => {
  console.log(
    "[Auth Controller] Register endpoint hit. Delegating to userController.registerUser."
  );
  // The registerUser in user.js expects camelCase from the request body,
  // and it handles Joi validation, hashing, and database insertion.
  // It also generates the token and sends the response.
  return registerUser(req, res); // Pass req and res directly to the user controller function
};

/**
 * Handles user login by calling the loginUser function from the user controller.
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 */
const login = async (req, res) => {
  console.log(
    "[Auth Controller] Login endpoint hit. Delegating to userController.loginUser."
  );
  // The loginUser in user.js expects 'identifier' and 'password' in camelCase,
  // handles validation, password comparison, and token generation.
  // It also sends the response.
  return loginUser(req, res); // Pass req and res directly to the user controller function
};

module.exports = { register, login };
