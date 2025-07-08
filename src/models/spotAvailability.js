// // Path: parking-app-backend/src/models/spotAvailability.js

// const pool = require("../config/db");

// const SpotAvailability = {
//   /**
//    * Creates a new availability slot for a parking spot.
//    * @param {Object} availabilityData - { spotId, startTime, endTime }
//    * @returns {Promise<Object>} The created availability object.
//    */
//   async createAvailability(availabilityData) {
//     const { spotId, startTime, endTime } = availabilityData;
//     const query = `
//             INSERT INTO spot_availability (spot_id, start_time, end_time)
//             VALUES (?, ?, ?)
//         `;
//     const [result] = await pool.query(query, [spotId, startTime, endTime]);
//     return { availability_id: result.insertId, ...availabilityData };
//   },

//   /**
//    * Finds availability slots for a given spot ID.
//    * @param {number} spotId - The ID of the parking spot.
//    * @param {string} [start] - Optional start date/time filter.
//    * @param {string} [end] - Optional end date/time filter.
//    * @returns {Promise<Array>} Array of availability objects.
//    */
//   async findBySpotId(spotId, start = null, end = null) {
//     let query = "SELECT * FROM spot_availability WHERE spot_id = ?";
//     const params = [spotId];

//     if (start) {
//       query += " AND start_time >= ?";
//       params.push(start);
//     }
//     if (end) {
//       query += " AND end_time <= ?";
//       params.push(end);
//     }
//     query += " ORDER BY start_time ASC";

//     const [rows] = await pool.query(query, params);
//     return rows;
//   },

//   /**
//    * Finds a specific availability slot by ID.
//    * @param {number} availabilityId - The ID of the availability slot.
//    * @returns {Promise<Object|undefined>} The availability object or undefined.
//    */
//   async findById(availabilityId) {
//     const [rows] = await pool.query(
//       "SELECT * FROM spot_availability WHERE availability_id = ?",
//       [availabilityId]
//     );
//     return rows[0];
//   },

//   /**
//    * Updates an availability slot.
//    * @param {number} availabilityId - The ID of the availability slot.
//    * @param {Object} updateData - Data to update (startTime, endTime, isBooked).
//    * @returns {Promise<boolean>} True if updated, false otherwise.
//    */
//   async updateAvailability(availabilityId, updateData) {
//     const fields = [];
//     const values = [];

//     if (updateData.startTime) {
//       fields.push("start_time = ?");
//       values.push(updateData.startTime);
//     }
//     if (updateData.endTime) {
//       fields.push("end_time = ?");
//       values.push(updateData.endTime);
//     }
//     if (updateData.isBooked !== undefined) {
//       fields.push("is_booked = ?");
//       values.push(updateData.isBooked);
//     }

//     if (fields.length === 0) return false;

//     values.push(availabilityId);
//     const query = `UPDATE spot_availability SET ${fields.join(
//       ", "
//     )} WHERE availability_id = ?`;
//     const [result] = await pool.query(query, values);
//     return result.affectedRows > 0;
//   },

//   /**
//    * Deletes an availability slot.
//    * @param {number} availabilityId - The ID of the availability slot.
//    * @returns {Promise<boolean>} True if deleted, false otherwise.
//    */
//   async deleteAvailability(availabilityId) {
//     const [result] = await pool.query(
//       "DELETE FROM spot_availability WHERE availability_id = ?",
//       [availabilityId]
//     );
//     return result.affectedRows > 0;
//   },

//   /**
//    * Marks an availability slot as booked.
//    * @param {number} availabilityId - The ID of the availability slot.
//    * @returns {Promise<boolean>} True if marked as booked, false otherwise.
//    */
//   async markAsBooked(availabilityId) {
//     const [result] = await pool.query(
//       "UPDATE spot_availability SET is_booked = TRUE WHERE availability_id = ? AND is_booked = FALSE",
//       [availabilityId]
//     );
//     return result.affectedRows > 0;
//   },

//   /**
//    * Checks if a time range for a spot is available (no overlaps with existing bookings/availability).
//    * @param {number} spotId - The ID of the parking spot.
//    * @param {string} startTime - Proposed start time.
//    * @param {string} endTime - Proposed end time.
//    * @param {number} [excludeAvailabilityId=null] - Optional ID to exclude from checks (for updates).
//    * @returns {Promise<boolean>} True if available, false otherwise.
//    */
//   async isTimeRangeAvailable(
//     spotId,
//     startTime,
//     endTime,
//     excludeAvailabilityId = null
//   ) {
//     let query = `
//             SELECT COUNT(*) AS count FROM spot_availability
//             WHERE spot_id = ?
//             AND (
//                 (start_time < ? AND end_time > ?) OR  -- Overlaps existing slot (start within, end within, or entirely covers)
//                 (start_time >= ? AND start_time < ?) OR -- Proposed start time within existing slot
//                 (end_time > ? AND end_time <= ?) -- Proposed end time within existing slot
//             )
//             AND is_booked = FALSE -- Only consider non-booked slots for conflicts when creating new availability
//         `;
//     const params = [
//       spotId,
//       endTime,
//       startTime,
//       startTime,
//       endTime,
//       startTime,
//       endTime,
//     ];

//     if (excludeAvailabilityId) {
//       query += " AND availability_id != ?";
//       params.push(excludeAvailabilityId);
//     }

//     const [rows] = await pool.query(query, params);
//     return rows[0].count === 0; // If count is 0, no conflicts found
//   },
// };

// module.exports = SpotAvailability;
// Path: parking-app-backend/src/models/spotAvailability.js

const pool = require("../config/db");

const SpotAvailability = {
  /**
   * Creates a new availability slot for a parking spot.
   * @param {Object} availabilityData - { spotId, startTime, endTime }
   * @returns {Promise<Object>} The created availability object.
   */
  async createAvailability(availabilityData) {
    const { spotId, startTime, endTime } = availabilityData;
    const query = `
            INSERT INTO spot_availability (spot_id, start_time, end_time)
            VALUES (?, ?, ?)
        `;
    const [result] = await pool.query(query, [spotId, startTime, endTime]);
    return { availability_id: result.insertId, ...availabilityData };
  },

  /**
   * Finds availability slots for a given spot ID.
   * @param {number} spotId - The ID of the parking spot.
   * @param {string} [start] - Optional start date/time filter.
   * @param {string} [end] - Optional end date/time filter.
   * @returns {Promise<Array>} Array of availability objects.
   */
  async findBySpotId(spotId, start = null, end = null) {
    let query = "SELECT * FROM spot_availability WHERE spot_id = ?";
    const params = [spotId];

    if (start) {
      query += " AND start_time >= ?";
      params.push(start);
    }
    if (end) {
      query += " AND end_time <= ?";
      params.push(end);
    }
    query += " ORDER BY start_time ASC";

    const [rows] = await pool.query(query, params);
    return rows;
  },

  /**
   * Finds a specific availability slot by ID.
   * @param {number} availabilityId - The ID of the availability slot.
   * @returns {Promise<Object|undefined>} The availability object or undefined.
   */
  async findById(availabilityId) {
    const [rows] = await pool.query(
      "SELECT * FROM spot_availability WHERE availability_id = ?",
      [availabilityId]
    );
    return rows[0];
  },

  /**
   * Updates an availability slot.
   * @param {number} availabilityId - The ID of the availability slot.
   * @param {Object} updateData - Data to update (startTime, endTime, isBooked).
   * @returns {Promise<boolean>} True if updated, false otherwise.
   */
  async updateAvailability(availabilityId, updateData) {
    const fields = [];
    const values = [];

    if (updateData.startTime) {
      fields.push("start_time = ?");
      values.push(updateData.startTime);
    }
    if (updateData.endTime) {
      fields.push("end_time = ?");
      values.push(updateData.endTime);
    }
    if (updateData.isBooked !== undefined) {
      fields.push("is_booked = ?");
      values.push(updateData.isBooked);
    }

    if (fields.length === 0) return false;

    values.push(availabilityId);
    const query = `UPDATE spot_availability SET ${fields.join(
      ", "
    )} WHERE availability_id = ?`;
    const [result] = await pool.query(query, values);
    return result.affectedRows > 0;
  },

  /**
   * Deletes an availability slot.
   * @param {number} availabilityId - The ID of the availability slot.
   * @returns {Promise<boolean>} True if deleted, false otherwise.
   */
  async deleteAvailability(availabilityId) {
    const [result] = await pool.query(
      "DELETE FROM spot_availability WHERE availability_id = ?",
      [availabilityId]
    );
    return result.affectedRows > 0;
  },

  /**
   * Marks an availability slot as booked.
   * @param {number} availabilityId - The ID of the availability slot.
   * @returns {Promise<boolean>} True if marked as booked, false otherwise.
   */
  async markAsBooked(availabilityId) {
    const [result] = await pool.query(
      "UPDATE spot_availability SET is_booked = TRUE WHERE availability_id = ? AND is_booked = FALSE",
      [availabilityId]
    );
    return result.affectedRows > 0;
  },

  /**
   * Checks if a proposed time range for creating *new availability* overlaps with existing, non-booked slots.
   * This method is suitable for homeowners creating new availability blocks.
   * @param {number} spotId - The ID of the parking spot.
   * @param {string} startTime - Proposed start time.
   * @param {string} endTime - Proposed end time.
   * @param {number} [excludeAvailabilityId=null] - Optional ID to exclude from conflicts (for updates).
   * @returns {Promise<boolean>} True if NO conflicts (i.e., time range is truly available for creating *new availability*), false if conflict.
   */
  async isTimeRangeAvailable(
    spotId,
    startTime,
    endTime,
    excludeAvailabilityId = null
  ) {
    let query = `
            SELECT COUNT(*) AS count FROM spot_availability
            WHERE spot_id = ?
            AND (
                (start_time < ? AND end_time > ?) OR
                (start_time >= ? AND start_time < ?) OR
                (end_time > ? AND end_time <= ?)
            )
            AND is_booked = FALSE -- Only consider non-booked slots for overlaps
        `;
    const params = [
      spotId,
      endTime,
      startTime,
      startTime,
      endTime,
      startTime,
      endTime,
    ];

    if (excludeAvailabilityId) {
      query += " AND availability_id != ?";
      params.push(excludeAvailabilityId);
    }

    const [rows] = await pool.query(query, params);
    // Returns true if NO overlap found (count is 0), meaning it's available to create new availability.
    return rows[0].count === 0;
  },

  /**
   * Checks if a requested booking time range is covered by an *existing available* slot.
   * This method is suitable for drivers trying to book a spot.
   * @param {number} spotId - The ID of the parking spot.
   * @param {string} bookingStartTime - Proposed booking start time.
   * @param {string} bookingEndTime - Proposed booking end time.
   * @returns {Promise<boolean>} True if the booking time is covered by an available slot, false otherwise.
   */
  async checkAvailabilityForBooking(spotId, bookingStartTime, bookingEndTime) {
    // Find an availability slot that completely encompasses or exactly matches the booking time
    const query = `
      SELECT COUNT(*) AS count
      FROM spot_availability
      WHERE spot_id = ?
        AND start_time <= ?       -- Availability starts before or at booking start
        AND end_time >= ?         -- Availability ends after or at booking end
        AND is_booked = FALSE;    -- The availability slot itself is not already marked as booked
    `;
    const params = [spotId, bookingStartTime, bookingEndTime];

    const [rows] = await pool.query(query, params);
    return rows[0].count > 0; // True if an encompassing, unbooked availability slot is found.
  },
};

module.exports = SpotAvailability;
