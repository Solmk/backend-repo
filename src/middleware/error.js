// Path: parking-app-backend/src/middleware/error.js

/**
 * Custom error handling middleware for Express.
 * This function handles errors passed via `next(error)` or thrown in async functions.
 * @param {Object} err - The error object.
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 * @param {Function} next - Express next middleware function.
 */
const errorHandler = (err, req, res, next) => {
  // Set status code: If a status code is already set, use it; otherwise, default to 500 (Internal Server Error)
  const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  res.status(statusCode);

  // Send a JSON response with the error message and stack trace (in development)
  res.json({
    message: err.message,
    // Only include stack trace in development mode for debugging
    stack: process.env.NODE_ENV === "production" ? null : err.stack,
  });
};

module.exports = {
  errorHandler,
};
