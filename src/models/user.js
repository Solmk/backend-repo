// // Path: parking-app-backend/src/models/user.js

// const pool = require("../config/db");

// const User = {
//   /**
//    * Finds a user by their email or phone number.
//    * @param {string} identifier - The email or phone number to search for.
//    * @returns {Promise<Object|undefined>} The user object if found, otherwise undefined.
//    */
//   async findByEmailOrPhone(identifier) {
//     const query = `
//       SELECT * FROM users
//       WHERE email = ? OR phone_number = ?
//     `;
//     const [rows] = await pool.query(query, [identifier, identifier]);
//     return rows[0]; // Returns the first matching user or undefined
//   },

//   /**
//    * Finds a user by their email.
//    * @param {string} email - The user's email.
//    * @returns {Promise<Object|undefined>} The user object or undefined if not found.
//    */
//   async findByEmail(email) {
//     const [rows] = await pool.query(
//       "SELECT user_id, first_name, last_name, email, phone_number, user_type FROM users WHERE email = ?",
//       [email]
//     );
//     return rows[0]; // Returns the user object or undefined if not found
//   },

//   /**
//    * Finds a user by their phone number.
//    * @param {string} phoneNumber - The user's phone number.
//    * @returns {Promise<Object|undefined>} The user object or undefined if not found.
//    */
//   async findByPhoneNumber(phoneNumber) {
//     const [rows] = await pool.query(
//       "SELECT user_id, first_name, last_name, email, phone_number, user_type FROM users WHERE phone_number = ?",
//       [phoneNumber]
//     );
//     return rows[0]; // Returns the user object or undefined if not found
//   },

//   /**
//    * Finds a user by their user_id.
//    * @param {number} userId - The user's ID.
//    * @returns {Promise<Object|undefined>} The user object if found, otherwise undefined.
//    */
//   async findById(userId) {
//     const [rows] = await pool.query("SELECT * FROM users WHERE user_id = ?", [
//       userId,
//     ]);
//     return rows[0];
//   },

//   /**
//    * Creates a new user in the database.
//    * Assumes parameters are passed in snake_case (e.g., first_name) from the controller.
//    * @param {Object} userData - User data (first_name, last_name, phone_number, email, password_hash, user_type).
//    * @returns {Promise<Object>} The created user object with its new user_id.
//    */
//   async createUser(userData) {
//     // FIX: Destructure snake_case properties to match incoming data from controller
//     const {
//       first_name,
//       last_name,
//       phone_number,
//       email,
//       password_hash, // Corrected from passwordHash to password_hash
//       user_type,
//     } = userData;

//     const query = `
//       INSERT INTO users (first_name, last_name, phone_number, email, password_hash, user_type)
//       VALUES (?, ?, ?, ?, ?, ?)
//     `;
//     const [result] = await pool.query(query, [
//       first_name, // Use the snake_case destructured variable
//       last_name, // Use the snake_case destructured variable
//       phone_number, // Use the snake_case destructured variable
//       email || null, // Ensure email is explicitly null if empty string or undefined
//       password_hash, // Use the snake_case destructured variable
//       user_type, // Use the snake_case destructured variable
//     ]);

//     // Return the created user object, merging in the auto-generated user_id
//     return { user_id: result.insertId, ...userData };
//   },

//   /**
//    * Updates a user's profile information.
//    * @param {number} userId - The ID of the user to update.
//    * @param {Object} updateData - Data to update (e.g., firstName, lastName, profilePictureUrl, etc.).
//    * @returns {Promise<boolean>} True if updated, false otherwise.
//    */
//   async updateUser(userId, updateData) {
//     const fields = [];
//     const values = [];

//     // Dynamically build the UPDATE query based on provided data
//     for (const key in updateData) {
//       if (updateData.hasOwnProperty(key)) {
//         // Map camelCase (from frontend/controller) to snake_case for database columns
//         const dbColumn = key.replace(/([A-Z])/g, "_$1").toLowerCase();
//         fields.push(`${dbColumn} = ?`);
//         values.push(updateData[key]);
//       }
//     }

//     if (fields.length === 0) {
//       return false; // No data to update
//     }

//     values.push(userId); // Add user_id for the WHERE clause

//     const query = `UPDATE users SET ${fields.join(", ")} WHERE user_id = ?`;
//     const [result] = await pool.query(query, values);
//     return result.affectedRows > 0;
//   },

//   /**
//    * Deletes a user by their user_id.
//    * @param {number} userId - The user's ID.
//    * @returns {Promise<boolean>} True if deleted, false otherwise.
//    */
//   async deleteUser(userId) {
//     const [result] = await pool.query(`DELETE FROM users WHERE user_id = ?`, [
//       userId,
//     ]);
//     return result.affectedRows > 0;
//   },
// };

// module.exports = User;
// Path: parking-app-backend/src/models/user.js

const pool = require("../config/db");

const User = {
  /**
   * Finds a user by their email or phone number.
   * @param {string} identifier - The email or phone number to search for.
   * @returns {Promise<Object|undefined>} The user object if found, otherwise undefined.
   */
  async findByEmailOrPhone(identifier) {
    const query = `
      SELECT * FROM users
      WHERE email = ? OR phone_number = ?
    `;
    const [rows] = await pool.query(query, [identifier, identifier]);
    return rows[0]; // Returns the first matching user or undefined
  },

  /**
   * Finds a user by their email.
   * @param {string} email - The user's email.
   * @returns {Promise<Object|undefined>} The user object or undefined if not found.
   */
  async findByEmail(email) {
    // Note: This function deliberately does NOT select password_hash for security.
    // Use findById if you need the full user object including password_hash.
    const [rows] = await pool.query(
      "SELECT user_id, first_name, last_name, email, phone_number, user_type FROM users WHERE email = ?",
      [email]
    );
    return rows[0]; // Returns the user object or undefined if not found
  },

  /**
   * Finds a user by their phone number.
   * @param {string} phoneNumber - The user's phone number.
   * @returns {Promise<Object|undefined>} The user object or undefined if not found.
   */
  async findByPhoneNumber(phoneNumber) {
    // Note: This function deliberately does NOT select password_hash for security.
    const [rows] = await pool.query(
      "SELECT user_id, first_name, last_name, email, phone_number, user_type FROM users WHERE phone_number = ?",
      [phoneNumber]
    );
    return rows[0]; // Returns the user object or undefined if not found
  },

  /**
   * Finds a user by their user_id.
   * @param {number} userId - The user's ID.
   * @returns {Promise<Object|undefined>} The user object if found, otherwise undefined.
   */
  async findById(userId) {
    const [rows] = await pool.query("SELECT * FROM users WHERE user_id = ?", [
      userId,
    ]);
    return rows[0]; // Returns the full user object including password_hash
  },

  /**
   * Creates a new user in the database.
   * Assumes parameters are passed in snake_case (e.g., first_name) from the controller.
   * @param {Object} userData - User data (first_name, last_name, phone_number, email, password_hash, user_type).
   * @returns {Promise<Object>} The created user object with its new user_id.
   */
  async createUser(userData) {
    const {
      first_name,
      last_name,
      phone_number,
      email,
      password_hash,
      user_type,
      profile_picture_url = null, // Default to null if not provided
      identification_verified = false, // Default to false if not provided
      payment_payout_details = null, // Default to null if not provided
    } = userData;

    const query = `
      INSERT INTO users (
        first_name, last_name, phone_number, email, password_hash, user_type,
        profile_picture_url, identification_verified, payment_payout_details
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const [result] = await pool.query(query, [
      first_name,
      last_name,
      phone_number,
      email || null, // Ensure email is explicitly null if empty string or undefined
      password_hash,
      user_type,
      profile_picture_url,
      identification_verified,
      payment_payout_details ? JSON.stringify(payment_payout_details) : null, // Stringify JSON object or ensure null
    ]);

    // Return the created user object, merging in the auto-generated user_id
    return { user_id: result.insertId, ...userData };
  },

  /**
   * Updates a user's profile information.
   * @param {number} userId - The ID of the user to update.
   * @param {Object} updateData - Data to update (e.g., firstName, lastName, profilePictureUrl, etc.).
   * @returns {Promise<boolean>} True if updated, false otherwise.
   */
  async updateUser(userId, updateData) {
    const fields = [];
    const values = [];

    // Dynamically build the UPDATE query based on provided data
    for (const key in updateData) {
      if (updateData.hasOwnProperty(key)) {
        // Map camelCase (from frontend/controller) to snake_case for database columns
        const dbColumn = key.replace(/([A-Z])/g, "_$1").toLowerCase();
        fields.push(`${dbColumn} = ?`);

        // FIX: Special handling for JSON fields like payment_payout_details
        if (dbColumn === 'payment_payout_details') {
          values.push(updateData[key] ? JSON.stringify(updateData[key]) : null);
        } else {
          values.push(updateData[key]);
        }
      }
    }

    if (fields.length === 0) {
      return false; // No data to update
    }

    values.push(userId); // Add user_id for the WHERE clause

    const query = `UPDATE users SET ${fields.join(", ")} WHERE user_id = ?`;
    const [result] = await pool.query(query, values);
    return result.affectedRows > 0;
  },

  /**
   * Deletes a user by their user_id.
   * @param {number} userId - The user's ID.
   * @returns {Promise<boolean>} True if deleted, false otherwise.
   */
  async deleteUser(userId) {
    const [result] = await pool.query(`DELETE FROM users WHERE user_id = ?`, [
      userId,
    ]);
    return result.affectedRows > 0;
  },

  /**
   * Fetches all users from the database. (Admin only)
   * @returns {Promise<Array<Object>>} An array of user objects.
   */
  async findAllUsers() {
    // Exclude password_hash for security
    const [rows] = await pool.query("SELECT user_id, first_name, last_name, phone_number, email, user_type, profile_picture_url, identification_verified, payment_payout_details, created_at, updated_at FROM users");
    return rows;
  }
};

module.exports = User;
