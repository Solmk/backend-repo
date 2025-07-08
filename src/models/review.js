// Path: parking-app-backend/src/models/review.js

const pool = require("../config/db");

const Review = {
  /**
   * Creates a new review for a completed booking.
   * @param {Object} reviewData - { bookingId, reviewerId, spotId, rating, comment }
   * @returns {Promise<Object>} The created review object.
   */
  async createReview(reviewData) {
    const { bookingId, reviewerId, spotId, rating, comment } = reviewData;
    const query = `
            INSERT INTO reviews (booking_id, reviewer_id, spot_id, rating, comment)
            VALUES (?, ?, ?, ?, ?)
        `;
    const [result] = await pool.query(query, [
      bookingId,
      reviewerId,
      spotId,
      rating,
      comment,
    ]);
    return { review_id: result.insertId, ...reviewData };
  },

  /**
   * Finds reviews by spot ID.
   * @param {number} spotId - The ID of the parking spot.
   * @returns {Promise<Array>} Array of review objects.
   */
  async findBySpotId(spotId) {
    const query = `
            SELECT r.*, u.first_name, u.last_name, u.profile_picture_url
            FROM reviews r
            JOIN users u ON r.reviewer_id = u.user_id
            WHERE r.spot_id = ?
            ORDER BY r.created_at DESC
        `;
    const [rows] = await pool.query(query, [spotId]);
    return rows;
  },

  /**
   * Finds reviews by reviewer ID.
   * @param {number} reviewerId - The ID of the reviewer.
   * @returns {Promise<Array>} Array of review objects.
   */
  async findByReviewerId(reviewerId) {
    const query = `
            SELECT r.*, ps.spot_name
            FROM reviews r
            JOIN parking_spots ps ON r.spot_id = ps.spot_id
            WHERE r.reviewer_id = ?
            ORDER BY r.created_at DESC
        `;
    const [rows] = await pool.query(query, [reviewerId]);
    return rows;
  },

  /**
   * Finds a review by booking ID (unique).
   * @param {number} bookingId - The ID of the booking.
   * @returns {Promise<Object|undefined>} The review object or undefined.
   */
  async findByBookingId(bookingId) {
    const [rows] = await pool.query(
      "SELECT * FROM reviews WHERE booking_id = ?",
      [bookingId]
    );
    return rows[0];
  },

  // You might add update/delete review functions, but usually reviews are immutable
};

module.exports = Review;
