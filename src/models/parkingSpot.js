// parking-app-backend/src/models/parkingSpot.js
const db = require("../config/db"); // Your database connection pool

const ParkingSpot = {
  /**
   * Creates a new parking spot in the database.
   * @param {Object} spotData - Data for the new parking spot.
   * @param {number} spotData.homeowner_id - The ID of the homeowner.
   * @param {string} spotData.spot_name - Name of the parking spot.
   * @param {string} [spotData.description] - Description of the spot.
   * @param {string} spotData.address_line_1 - Primary address line.
   * @param {string} [spotData.address_line_2] - Secondary address line.
   * @param {string} spotData.city - City of the spot.
   * @param {string} [spotData.sub_city] - Sub-city/district.
   * @param {string} [spotData.woreda] - Woreda (Ethiopian administrative division).
   * @param {number} spotData.latitude - Latitude coordinate.
   * @param {number} spotData.longitude - Longitude coordinate.
   * @param {number} spotData.price_per_hour - Hourly price.
   * @param {string} spotData.spot_type - Type of spot (e.g., 'garage').
   * @param {string} spotData.vehicle_size_accommodated - Vehicle size.
   * @param {Array<string>} [spotData.amenities=null] - JSON array of amenities.
   * @param {boolean} [spotData.is_available=true] - Spot availability.
   * @param {string} [spotData.status='pending_verification'] - Spot status.
   * @returns {Promise<Object>} The created parking spot object with its ID.
   */
  async createSpot(spotData) {
    const {
      homeowner_id,
      spot_name,
      description = null,
      address_line_1,
      address_line_2 = null,
      city,
      sub_city = null,
      woreda = null,
      latitude,
      longitude,
      price_per_hour,
      spot_type,
      vehicle_size_accommodated,
      amenities = null,
      is_available = true,
      status = "pending_verification",
    } = spotData;

    // Ensure amenities are stringified if provided as an array
    const amenitiesJson = amenities ? JSON.stringify(amenities) : null;

    const query = `
            INSERT INTO parking_spots (
                homeowner_id, spot_name, description, address_line_1, address_line_2,
                city, sub_city, woreda, latitude, longitude,
                price_per_hour, spot_type, vehicle_size_accommodated, amenities,
                is_available, status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
    const [result] = await db.query(query, [
      homeowner_id,
      spot_name,
      description,
      address_line_1,
      address_line_2,
      city,
      sub_city,
      woreda,
      latitude,
      longitude,
      price_per_hour,
      spot_type,
      vehicle_size_accommodated,
      amenitiesJson, // Use stringified amenities
      is_available,
      status,
    ]);

    return { spot_id: result.insertId, ...spotData };
  },

  /**
   * Helper function to parse JSON fields (amenities, images) from DB results.
   * @param {Object} row - A database row object.
   * @returns {Object} The row with parsed JSON fields.
   */
  _parseJsonFields(row) {
    if (row) {
      // Parse amenities
      if (typeof row.amenities === "string" && row.amenities.startsWith("[")) {
        try {
          row.amenities = JSON.parse(row.amenities);
        } catch (e) {
          console.error(`Error parsing amenities for spot ${row.spot_id}:`, e);
          row.amenities = []; // Default to empty array on parse error
        }
      } else if (row.amenities === null || row.amenities === undefined) {
        row.amenities = [];
      }

      // Parse images (from JSON_ARRAYAGG)
      if (typeof row.images === "string") {
        try {
          const parsedImages = JSON.parse(row.images);
          // If JSON_ARRAYAGG returns [null] for no images, convert to empty array
          row.images = parsedImages[0]?.image_id === null ? [] : parsedImages;
          // Ensure is_primary is boolean
          row.images = row.images.map((img) => ({
            ...img,
            is_primary: !!img.is_primary, // Convert tinyint(1) to boolean
          }));
        } catch (e) {
          console.error(`Error parsing images for spot ${row.spot_id}:`, e);
          row.images = [];
        }
      } else if (row.images === null || row.images === undefined) {
        row.images = [];
      }
    }
    return row;
  },

  /**
   * Finds a parking spot by its ID, joining with spot_images.
   * @param {number} spotId - The ID of the parking spot.
   * @returns {Promise<Object|null>} The parking spot object with images, or null if not found.
   */
  async findById(spotId) {
    const query = `
            SELECT
                ps.*,
                JSON_ARRAYAGG(
                    JSON_OBJECT('image_id', si.image_id, 'image_url', si.image_url, 'is_primary', si.is_primary)
                ) AS images
            FROM
                parking_spots ps
            LEFT JOIN
                parking_spot_images si ON ps.spot_id = si.spot_id
            WHERE
                ps.spot_id = ?
            GROUP BY
                ps.spot_id;
        `;
    const [rows] = await db.query(query, [spotId]); // Using pool.query now

    // FIX: Directly parse the first (and only) row's JSON fields
    // The manual aggregation loop is removed as JSON_ARRAYAGG handles it.
    return this._parseJsonFields(rows[0]) || null;
  },

  /**
   * Finds all parking spots belonging to a specific homeowner, joining with images.
   * @param {number} homeownerId - The ID of the homeowner.
   * @returns {Promise<Array<Object>>} An array of parking spot objects with images.
   */
  async findByHomeownerId(homeownerId) {
    const query = `
            SELECT
                ps.*,
                JSON_ARRAYAGG(
                    JSON_OBJECT('image_id', si.image_id, 'image_url', si.image_url, 'is_primary', si.is_primary)
                ) AS images
            FROM
                parking_spots ps
            LEFT JOIN
                parking_spot_images si ON ps.spot_id = si.spot_id
            WHERE
                ps.homeowner_id = ?
            GROUP BY
                ps.spot_id
            ORDER BY
                ps.created_at DESC;
        `;
    const [rows] = await db.query(query, [homeownerId]);

    // Post-process each row to parse JSON fields
    return rows.map((row) => this._parseJsonFields(row));
  },

  /**
   * Updates an existing parking spot's information.
   * @param {number} spotId - The ID of the parking spot to update.
   * @param {Object} updateData - Object containing fields to update. Keys should be in snake_case to match DB.
   * @returns {Promise<boolean>} True if the spot was updated, false otherwise.
   */
  async updateSpot(spotId, updateData) {
    const fields = [];
    const values = [];

    for (const key in updateData) {
      if (updateData.hasOwnProperty(key)) {
        // Special handling for JSON fields like amenities
        if (
          key === "amenities" &&
          updateData[key] !== null &&
          typeof updateData[key] !== "string"
        ) {
          values.push(JSON.stringify(updateData[key]));
        } else {
          values.push(updateData[key]);
        }
        fields.push(`${key} = ?`); // Key is already expected to be snake_case here
      }
    }

    if (fields.length === 0) {
      return false; // No data to update
    }

    values.push(spotId);
    const query = `UPDATE parking_spots SET ${fields.join(
      ", "
    )} WHERE spot_id = ?`;
    const [result] = await db.query(query, values);
    return result.affectedRows > 0;
  },

  /**
   * Deletes a parking spot by its ID.
   * Note: This should ideally cascade delete related records (images, bookings).
   * Consider implementing foreign key constraints with ON DELETE CASCADE in your DB schema.
   * @param {number} spotId - The ID of the parking spot to delete.
   * @returns {Promise<boolean>} True if the spot was deleted, false otherwise.
   */
  async deleteSpot(spotId) {
    const [result] = await db.query(
      `DELETE FROM parking_spots WHERE spot_id = ?`,
      [spotId]
    );
    return result.affectedRows > 0;
  },

  /**
   * Updates the availability status of a parking spot.
   * Renamed from toggleAvailability to reflect direct setting of status.
   * @param {number} spotId - The ID of the parking spot.
   * @param {boolean} isAvailable - The new availability status (true/false).
   * @returns {Promise<boolean>} True if updated, false otherwise.
   */
  async updateAvailability(spotId, isAvailable) {
    // Renamed parameter from toggleAvailability
    const [result] = await db.query(
      `UPDATE parking_spots SET is_available = ? WHERE spot_id = ?`,
      [isAvailable, spotId]
    );
    return result.affectedRows > 0;
  },

  /**
   * Searches for parking spots based on various criteria, joining with images.
   * @param {Object} criteria - Search parameters (city, spot_type, vehicle_size_accommodated, min_price, max_price, etc.).
   * @returns {Promise<Array<Object>>} An array of matching parking spot objects with images.
   */
  async searchSpots(criteria) {
    let query = `
            SELECT
                ps.*,
                JSON_ARRAYAGG(
                    JSON_OBJECT('image_id', si.image_id, 'image_url', si.image_url, 'is_primary', si.is_primary)
                ) AS images
            FROM
                parking_spots ps
            LEFT JOIN
                parking_spot_images si ON ps.spot_id = si.spot_id
            WHERE 1=1 AND ps.is_available = TRUE AND ps.status = 'active'
        `;
    const params = [];

    if (criteria.city) {
      query += ` AND ps.city = ?`;
      params.push(criteria.city);
    }
    if (criteria.spot_type) {
      query += ` AND ps.spot_type = ?`;
      params.push(criteria.spot_type);
    }
    if (criteria.vehicle_size_accommodated) {
      query += ` AND ps.vehicle_size_accommodated = ?`;
      params.push(criteria.vehicle_size_accommodated);
    }
    if (criteria.min_price !== undefined) {
      query += ` AND ps.price_per_hour >= ?`;
      params.push(criteria.min_price);
    }
    if (criteria.max_price !== undefined) {
      query += ` AND ps.price_per_hour <= ?`;
      params.push(criteria.max_price);
    }

    // Add ordering to search results
    query += ` GROUP BY ps.spot_id ORDER BY ps.created_at DESC`;

    const [rows] = await db.query(query, params);

    // Post-process each row to parse JSON fields
    return rows.map((row) => this._parseJsonFields(row));
  },

  // --- NEW Image Management Methods ---

  /**
   * Adds a new image record to the parking_spot_images table.
   * @param {number} spotId - The ID of the parking spot.
   * @param {string} imageUrl - The URL/path to the image file.
   * @param {boolean} isPrimary - Whether this image should be the primary image.
   * @returns {Promise<Object>} The created image object with its ID.
   */
  async addImage(spotId, imageUrl, isPrimary = false) {
    const query = `
            INSERT INTO parking_spot_images (spot_id, image_url, is_primary)
            VALUES (?, ?, ?)
        `;
    const [result] = await db.query(query, [spotId, imageUrl, isPrimary]);
    return {
      image_id: result.insertId,
      spot_id: spotId,
      image_url: imageUrl,
      is_primary: isPrimary,
    };
  },

  /**
   * Finds all images for a specific parking spot.
   * @param {number} spotId - The ID of the parking spot.
   * @returns {Promise<Array<Object>>} An array of image objects.
   */
  async findImagesBySpotId(spotId) {
    const [rows] = await db.query(
      `SELECT image_id, image_url, is_primary FROM parking_spot_images WHERE spot_id = ? ORDER BY is_primary DESC, image_id ASC`,
      [spotId]
    );
    // Ensure is_primary is converted to boolean
    return rows.map((row) => ({
      ...row,
      is_primary: !!row.is_primary,
    }));
  },

  /**
   * Finds a single image by its ID.
   * @param {number} imageId - The ID of the image.
   * @returns {Promise<Object|null>} The image object or null if not found.
   */
  async findImageById(imageId) {
    const [rows] = await db.query(
      `SELECT image_id, spot_id, image_url, is_primary FROM parking_spot_images WHERE image_id = ?`,
      [imageId]
    );
    if (rows[0]) {
      return {
        ...rows[0],
        is_primary: !!rows[0].is_primary, // Convert tinyint(1) to boolean
      };
    }
    return null;
  },

  /**
   * Deletes an image record from the parking_spot_images table.
   * @param {number} imageId - The ID of the image to delete.
   * @returns {Promise<boolean>} True if deleted, false otherwise.
   */
  async deleteImage(imageId) {
    const [result] = await db.query(
      `DELETE FROM parking_spot_images WHERE image_id = ?`,
      [imageId]
    );
    return result.affectedRows > 0;
  },

  /**
   * Sets the is_primary flag to FALSE for all images belonging to a specific spot.
   * This is called before setting a new primary image.
   * @param {number} spotId - The ID of the parking spot.
   * @returns {Promise<boolean>} True if any rows were affected, false otherwise.
   */
  async unsetPrimaryImage(spotId) {
    const [result] = await db.query(
      `UPDATE parking_spot_images SET is_primary = FALSE WHERE spot_id = ?`,
      [spotId]
    );
    return result.affectedRows > 0;
  },

  /**
   * Sets a specific image as primary.
   * @param {number} imageId - The ID of the image to set as primary.
   * @returns {Promise<boolean>} True if updated, false otherwise.
   */
  async setPrimaryImage(imageId) {
    const [result] = await db.query(
      `UPDATE parking_spot_images SET is_primary = TRUE WHERE image_id = ?`,
      [imageId]
    );
    return result.affectedRows > 0;
  },
};

module.exports = ParkingSpot;
