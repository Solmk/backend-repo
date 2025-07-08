// Path: parking-app-backend/src/models/booking.js
const pool = require("../config/db"); // Your database connection pool

const Booking = {
  /**
   * Helper function to parse database row into a consistent object structure.
   * This is especially useful for results from JOIN queries.
   * Converts TINYINT(1) to boolean and parses JSON.
   * @param {Object} row - A raw database row.
   * @returns {Object} Parsed booking object.
   */
  _parseRow(row) {
    if (!row) return null;

    const booking = {
      booking_id: row.booking_id,
      spot_id: row.spot_id,
      driver_id: row.driver_id,
      homeowner_id: row.homeowner_id, // Ensure this is explicitly included
      start_time: row.start_time,
      end_time: row.end_time,
      total_price: parseFloat(row.total_price),
      booking_status: row.booking_status,
      payment_status: row.payment_status,
      stripe_payment_intent_id: row.stripe_payment_intent_id,
      created_at: row.created_at,
      updated_at: row.updated_at,
      driver_check_in_time: row.driver_check_in_time,
      driver_check_out_time: row.driver_check_out_time,
      homeowner_confirm_time: row.homeowner_confirm_time,
      homeowner_reject_time: row.homeowner_reject_time,
      // Joined fields from parking_spots
      spot_name: row.spot_name || null,
      address_line_1: row.address_line_1 || null,
      address_line_2: row.address_line_2 || null, // Added for full address
      city: row.city || null,
      sub_city: row.sub_city || null, // Added for full address
      woreda: row.woreda || null, // Added for full address
      latitude: row.latitude || null, // ADDED: Include latitude
      longitude: row.longitude || null, // ADDED: Include longitude
      price_per_hour: row.price_per_hour
        ? parseFloat(row.price_per_hour)
        : null,
      spot_type: row.spot_type || null,
      vehicle_size_accommodated: row.vehicle_size_accommodated || null,
      // Joined fields from users
      driver_name: row.driver_name || null,
      driver_email: row.driver_email || null,
      driver_phone: row.driver_phone || null,
      homeowner_name: row.homeowner_name || null,
      homeowner_email: row.homeowner_email || null,
      homeowner_phone: row.homeowner_phone || null,
    };

    return booking;
  },

  /**
   * Creates a new booking in the database.
   * @param {Object} bookingData - Data for the new booking.
   * @returns {Promise<Object>} The created booking object with its ID.
   */
  async create(bookingData) {
    const {
      spot_id,
      driver_id,
      start_time,
      end_time,
      total_price,
      stripe_payment_intent_id = null,
      booking_status = "pending",
      payment_status = "pending",
    } = bookingData;

    // First, verify the parking spot exists and get its homeowner_id
    console.log(
      `[BookingModel] Attempting to find homeowner_id for spot_id: ${spot_id}`
    ); // DEBUG LOG
    const [spotRows] = await pool.query(
      `SELECT homeowner_id FROM parking_spots WHERE spot_id = ?`,
      [spot_id]
    );

    if (spotRows.length === 0) {
      console.log(`[BookingModel] Spot ID ${spot_id} not found.`); // DEBUG LOG
      const error = new Error("Parking spot not found.");
      error.statusCode = 404; // Custom status code for controller to pick up
      throw error;
    }
    const homeowner_id = spotRows[0].homeowner_id; // Get homeowner_id from the spot
    console.log(
      `[BookingModel] Found homeowner_id ${homeowner_id} for spot_id ${spot_id}`
    ); // DEBUG LOG

    // Check for overlapping bookings for the given spot
    const [overlapCheck] = await pool.query(
      `SELECT booking_id FROM bookings
        WHERE spot_id = ?
        AND (
            (start_time < ? AND end_time > ?) OR
            (start_time < ? AND end_time > ?) OR
            (start_time >= ? AND end_time <= ?)
        )
        AND booking_status NOT IN ('rejected', 'cancelled_by_driver', 'cancelled_by_homeowner', 'completed');`,
      [
        spot_id,
        end_time,
        start_time,
        start_time,
        end_time,
        start_time,
        end_time,
      ]
    );

    if (overlapCheck.length > 0) {
      console.log(
        `[BookingModel] Overlapping booking found for spot_id ${spot_id}.`
      ); // DEBUG LOG
      const error = new Error(
        "The selected time slot overlaps with an existing booking."
      );
      error.statusCode = 409; // Conflict
      throw error;
    }

    const query = `
        INSERT INTO bookings (
            spot_id, driver_id, homeowner_id, start_time, end_time,
            total_price, booking_status, payment_status, stripe_payment_intent_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    console.log(
      `[BookingModel] Inserting booking with homeowner_id: ${homeowner_id}`
    ); // DEBUG LOG
    const [result] = await pool.query(query, [
      spot_id,
      driver_id,
      homeowner_id, // Include homeowner_id here
      start_time,
      end_time,
      total_price,
      booking_status,
      payment_status,
      stripe_payment_intent_id,
    ]);
    console.log(`[BookingModel] Booking created with ID: ${result.insertId}`); // DEBUG LOG

    return { booking_id: result.insertId, ...bookingData, homeowner_id };
  },

  /**
   * Finds a booking by its ID.
   * Joins with parking_spots and users tables to get related names and contact info.
   * @param {number} bookingId - The ID of the booking.
   * @returns {Promise<Object|null>} The booking object, or null if not found.
   */
  async findById(bookingId) {
    console.log(`[BookingModel] findById called for bookingId: ${bookingId}`); // DEBUG LOG
    const query = `
        SELECT
            b.booking_id,
            b.spot_id,
            b.driver_id,
            b.homeowner_id,
            b.start_time,
            b.end_time,
            b.total_price,
            b.booking_status,
            b.payment_status,
            b.stripe_payment_intent_id,
            b.created_at,
            b.updated_at,
            b.driver_check_in_time,
            b.driver_check_out_time,
            b.homeowner_confirm_time,
            b.homeowner_reject_time,
            ps.spot_name,
            ps.address_line_1,
            ps.address_line_2, -- ADDED
            ps.city,
            ps.sub_city, -- ADDED
            ps.woreda, -- ADDED
            ps.latitude, -- ADDED
            ps.longitude, -- ADDED
            ps.price_per_hour,
            ps.spot_type,
            ps.vehicle_size_accommodated,
            CONCAT(d_user.first_name, ' ', d_user.last_name) AS driver_name,
            d_user.email AS driver_email,
            d_user.phone_number AS driver_phone,
            CONCAT(h_user.first_name, ' ', h_user.last_name) AS homeowner_name,
            h_user.email AS homeowner_email,
            h_user.phone_number AS homeowner_phone
        FROM
            bookings b
        JOIN
            parking_spots ps ON b.spot_id = ps.spot_id
        LEFT JOIN
            users d_user ON b.driver_id = d_user.user_id
        LEFT JOIN
            users h_user ON b.homeowner_id = h_user.user_id
        WHERE
            b.booking_id = ?;
    `;
    const [rows] = await pool.query(query, [bookingId]);
    console.log(`[BookingModel] findById query result rows:`, rows); // DEBUG LOG
    if (rows.length > 0) {
      console.log(
        `[BookingModel] Found booking ${bookingId}. Homeowner ID from DB: ${rows[0].homeowner_id}`
      ); // DEBUG LOG
    } else {
      console.log(`[BookingModel] Booking ${bookingId} not found in DB.`); // DEBUG LOG
    }
    return this._parseRow(rows[0]); // Use helper to parse the single row
  },

  /**
   * Finds all bookings for a specific driver.
   * @param {number} driverId - The ID of the driver.
   * @param {string} statusFilter - Optional filter for booking status ('all', 'pending', 'confirmed', etc.).
   * @returns {Promise<Array<Object>>} An array of booking objects.
   */
  async findByDriverId(driverId, statusFilter = "all") {
    console.log(
      `[BookingModel] findByDriverId called for driverId: ${driverId}, status: ${statusFilter}`
    ); // DEBUG LOG
    let query = `
        SELECT
            b.booking_id,
            b.spot_id,
            b.driver_id,
            b.homeowner_id,
            b.start_time,
            b.end_time,
            b.total_price,
            b.booking_status,
            b.payment_status,
            b.created_at,
            ps.spot_name,
            ps.address_line_1,
            ps.address_line_2, -- ADDED
            ps.city,
            ps.sub_city, -- ADDED
            ps.woreda, -- ADDED
            ps.latitude, -- ADDED
            ps.longitude, -- ADDED
            ps.price_per_hour,
            ps.spot_type,
            ps.vehicle_size_accommodated,
            CONCAT(h_user.first_name, ' ', h_user.last_name) AS homeowner_name,
            h_user.email AS homeowner_email,
            h_user.phone_number AS homeowner_phone
        FROM
            bookings b
        JOIN
            parking_spots ps ON b.spot_id = ps.spot_id
        LEFT JOIN
            users h_user ON b.homeowner_id = h_user.user_id
        WHERE
            b.driver_id = ?
    `;
    const params = [driverId];

    if (statusFilter !== "all") {
      query += ` AND b.booking_status = ?`;
      params.push(statusFilter);
    }

    query += ` ORDER BY b.created_at DESC;`;

    const [rows] = await pool.query(query, params);
    console.log(
      `[BookingModel] findByDriverId query result rows count: ${rows.length}`
    ); // DEBUG LOG
    return rows.map((row) => this._parseRow(row)); // Use helper for each row
  },

  /**
   * Finds all bookings for spots owned by a specific homeowner.
   * @param {number} homeownerId - The ID of the homeowner.
   * @param {string} statusFilter - Optional filter for booking status ('all', 'pending', 'confirmed', etc.).
   * @returns {Promise<Array<Object>>} An array of booking objects.
   */
  async findByHomeownerId(homeownerId, statusFilter = "all") {
    console.log(
      `[BookingModel] findByHomeownerId called for homeownerId: ${homeownerId}, status: ${statusFilter}`
    ); // DEBUG LOG
    let query = `
        SELECT
            b.booking_id,
            b.spot_id,
            b.driver_id,
            b.homeowner_id,
            b.start_time,
            b.end_time,
            b.total_price,
            b.booking_status,
            b.payment_status,
            b.created_at,
            ps.spot_name,
            ps.address_line_1,
            ps.address_line_2, -- ADDED
            ps.city,
            ps.sub_city, -- ADDED
            ps.woreda, -- ADDED
            ps.latitude, -- ADDED
            ps.longitude, -- ADDED
            ps.price_per_hour,
            ps.spot_type,
            ps.vehicle_size_accommodated,
            CONCAT(d_user.first_name, ' ', d_user.last_name) AS driver_name,
            d_user.email AS driver_email,
            d_user.phone_number AS driver_phone
        FROM
            bookings b
        JOIN
            parking_spots ps ON b.spot_id = ps.spot_id
        LEFT JOIN
            users d_user ON b.driver_id = d_user.user_id
        WHERE
            b.homeowner_id = ?
    `;
    const params = [homeownerId];

    if (statusFilter !== "all") {
      query += ` AND b.booking_status = ?`;
      params.push(statusFilter);
    }

    query += ` ORDER BY b.created_at DESC;`;

    const [rows] = await pool.query(query, params);
    console.log(
      `[BookingModel] findByHomeownerId query result rows count: ${rows.length}`
    ); // DEBUG LOG
    return rows.map((row) => this._parseRow(row)); // Use helper for each row
  },

  /**
   * Updates the status of a booking.
   * @param {number} bookingId - The ID of the booking to update.
   * @param {string} newStatus - The new booking status.
   * @param {string|null} timeFieldToUpdate - Name of the timestamp column to update (e.g., 'driver_check_in_time').
   * @returns {Promise<boolean>} True if updated, false otherwise.
   */
  async updateStatus(bookingId, newStatus, timeFieldToUpdate = null) {
    console.log(
      `[BookingModel] updateStatus called for booking ${bookingId} to status ${newStatus}, timeField: ${timeFieldToUpdate}`
    ); // DEBUG LOG
    let query = `UPDATE bookings SET booking_status = ?`;
    const params = [newStatus];

    if (timeFieldToUpdate) {
      query += `, ${timeFieldToUpdate} = NOW()`;
    }
    query += ` WHERE booking_id = ?`;
    params.push(bookingId);

    const [result] = await pool.query(query, params);
    console.log(
      `[BookingModel] updateStatus result: affectedRows=${result.affectedRows}`
    ); // DEBUG LOG
    return result.affectedRows > 0;
  },

  /**
   * Updates the payment status of a booking.
   * @param {number} bookingId - The ID of the booking to update.
   * @param {Object} updateFields - Object containing fields to update (payment_status, stripe_payment_intent_id).
   * @returns {Promise<boolean>} True if updated, false otherwise.
   */
  async updatePaymentStatus(bookingId, updateFields) {
    console.log(
      `[BookingModel] updatePaymentStatus called for booking ${bookingId} with fields:`,
      updateFields
    ); // DEBUG LOG
    const fields = [];
    const values = [];

    for (const key in updateFields) {
      if (updateFields.hasOwnProperty(key)) {
        fields.push(`${key} = ?`);
        values.push(updateFields[key]);
      }
    }

    if (fields.length === 0) {
      console.log("[BookingModel] No fields provided for updatePaymentStatus."); // DEBUG LOG
      return false; // No fields to update
    }

    values.push(bookingId);
    const query = `UPDATE bookings SET ${fields.join(
      ", "
    )} WHERE booking_id = ?`;
    const [result] = await pool.query(query, values);
    console.log(
      `[BookingModel] updatePaymentStatus result: affectedRows=${result.affectedRows}`
    ); // DEBUG LOG
    return result.affectedRows > 0;
  },

  /**
   * Finds all bookings for a specific parking spot.
   * Used for availability display.
   * @param {number} spotId - The ID of the parking spot.
   * @returns {Promise<Array<Object>>} An array of booking objects (limited details for availability).
   */
  async findBySpotId(spotId) {
    console.log(`[BookingModel] findBySpotId called for spotId: ${spotId}`); // DEBUG LOG
    const [rows] = await pool.query(
      `SELECT
          booking_id,
          start_time,
          end_time,
          booking_status AS status, -- Alias for frontend consistency
          payment_status
        FROM
          bookings
        WHERE
          spot_id = ?
        ORDER BY start_time ASC`,
      [spotId]
    );
    console.log(
      `[BookingModel] findBySpotId query result rows count: ${rows.length}`
    ); // DEBUG LOG
    // Parse statuses for consistency if needed, but often backend sends raw string and frontend handles
    return rows; // Return raw rows, frontend will filter/format for availability
  },
};

module.exports = Booking;
