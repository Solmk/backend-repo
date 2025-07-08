// Path: parking-app-backend/src/utils/password.js

const bcrypt = require("bcryptjs");

const saltRounds = 10; // Standard salt rounds for bcrypt

/**
 * Hashes a plain-text password.
 * @param {string} password - The plain-text password.
 * @returns {Promise<string>} The hashed password.
 */
const hashPassword = async (password) => {
  return bcrypt.hash(password, saltRounds);
};

/**
 * Compares a plain-text password with a hashed password.
 * @param {string} password - The plain-text password.
 * @param {string} hash - The hashed password from the database.
 * @returns {Promise<boolean>} True if passwords match, false otherwise.
 */
const comparePassword = async (password, hash) => {
  return bcrypt.compare(password, hash);
};

module.exports = { hashPassword, comparePassword };
