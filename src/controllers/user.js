// // Path: parking-app-backend/src/controllers/user.js

// const User = require("../models/user");
// const { hashPassword } = require("../utils/password");

// /**
//  * Get the authenticated user's profile.
//  * @param {Object} req - Express request object.
//  * @param {Object} res - Express response object.
//  */
// const getMyProfile = async (req, res) => {
//   try {
//     // req.user is populated by the 'protect' middleware
//     const user = await User.findById(req.user.user_id);
//     if (!user) {
//       return res.status(404).json({ message: "User not found." });
//     }
//     // Exclude sensitive information like password hash
//     const { password_hash, ...userProfile } = user;
//     res.status(200).json(userProfile);
//   } catch (error) {
//     console.error("Error fetching user profile:", error);
//     res.status(500).json({
//       message: "Server error fetching profile.",
//       error: error.message,
//     });
//   }
// };

// /**
//  * Update the authenticated user's profile.
//  * @param {Object} req - Express request object.
//  * @param {Object} res - Express response object.
//  */
// // Add this import if you don't have it (for simple regex validation)
// // const validator = require('validator'); // npm install validator

// const updateMyProfile = async (req, res) => {
//   const userId = req.user.user_id;
//   const {
//     firstName,
//     lastName,
//     phoneNumber,
//     email, // This is the field we need to validate
//     profilePictureUrl,
//     identificationVerified,
//     paymentPayoutDetails,
//   } = req.body;

//   const updateData = {};

//   // Build updateData object and perform validation
//   if (firstName !== undefined) {
//     updateData.firstName = firstName;
//   }
//   if (lastName !== undefined) {
//     updateData.lastName = lastName;
//   }
//   if (phoneNumber !== undefined) {
//     // Basic phone number validation (e.g., must be digits, optional length)
//     // New regex to allow optional leading '+'
//     if (typeof phoneNumber === "string" && /^\+?\d{10,15}$/.test(phoneNumber)) {
//       // Example: 10-15 digits
//       updateData.phoneNumber = phoneNumber;
//     } else if (phoneNumber !== null) {
//       // Allow null to clear if needed
//       return res.status(400).json({ message: "Invalid phone number format." });
//     } else {
//       updateData.phoneNumber = null; // Allow setting to null
//     }
//   }

//   if (email !== undefined) {
//     // --- ADD EMAIL VALIDATION HERE ---
//     // Option 1: Simple Regex (less robust, but quick)
//     const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
//     if (!emailRegex.test(email)) {
//       return res.status(400).json({ message: "Invalid email format." });
//     }
//     updateData.email = email;

//     // Option 2: Using a dedicated validation library like 'validator.js' (recommended for production)
//     // You would need to install it: npm install validator
//     /*
//     if (!validator.isEmail(email)) {
//       return res.status(400).json({ message: "Invalid email format." });
//     }
//     updateData.email = email;
//     */
//   }

//   if (profilePictureUrl !== undefined) {
//     // You might add URL validation here too
//     updateData.profilePictureUrl = profilePictureUrl;
//   }

//   // Admin-only fields should be handled separately, not via user self-update
//   // if (identificationVerified !== undefined) updateData.identificationVerified = identificationVerified;
//   // if (paymentPayoutDetails !== undefined) updateData.paymentPayoutDetails = paymentPayoutDetails;

//   if (Object.keys(updateData).length === 0) {
//     return res
//       .status(400)
//       .json({ message: "No valid fields provided for update." });
//   }

//   try {
//     // Check if the new email or phone number already exists for *another* user
//     // This is important for unique constraints
//     if (updateData.email || updateData.phoneNumber) {
//       const existingUserWithEmail = updateData.email
//         ? await User.findByEmail(updateData.email)
//         : null;
//       const existingUserWithPhone = updateData.phoneNumber
//         ? await User.findByPhoneNumber(updateData.phoneNumber)
//         : null;

//       if (existingUserWithEmail && existingUserWithEmail.user_id !== userId) {
//         return res
//           .status(400)
//           .json({ message: "Email already registered by another user." });
//       }
//       if (existingUserWithPhone && existingUserWithPhone.user_id !== userId) {
//         return res
//           .status(400)
//           .json({
//             message: "Phone number already registered by another user.",
//           });
//       }
//     }

//     const updated = await User.updateUser(userId, updateData);
//     if (updated) {
//       const updatedUser = await User.findById(userId);
//       const { password_hash, ...userProfile } = updatedUser; // Exclude sensitive data
//       res
//         .status(200)
//         .json({ message: "Profile updated successfully!", user: userProfile });
//     } else {
//       res.status(400).json({ message: "Failed to update profile." });
//     }
//   } catch (error) {
//     console.error("Error updating user profile:", error);
//     // Be more specific with error messages if possible, e.g., if it's a DB unique constraint error
//     if (error.code === "ER_DUP_ENTRY") {
//       // MySQL specific error code for duplicate entry on unique key
//       return res
//         .status(400)
//         .json({
//           message: "A user with this email or phone number already exists.",
//         });
//     }
//     res.status(500).json({
//       message: "Server error updating profile.",
//       error: error.message,
//     });
//   }
// };
// // (Optional) For admin to update other users
// const updateUserById = async (req, res) => {
//   const { id: userId } = req.params;
//   const {
//     firstName,
//     lastName,
//     phoneNumber,
//     email,
//     password,
//     userType,
//     profilePictureUrl,
//     identificationVerified,
//     paymentPayoutDetails,
//     status,
//   } = req.body;

//   const updateData = {};
//   if (firstName !== undefined) updateData.firstName = firstName;
//   if (lastName !== undefined) updateData.lastName = lastName;
//   if (phoneNumber !== undefined) updateData.phoneNumber = phoneNumber;
//   if (email !== undefined) updateData.email = email;
//   if (profilePictureUrl !== undefined)
//     updateData.profilePictureUrl = profilePictureUrl;
//   if (userType !== undefined) updateData.userType = userType;
//   if (identificationVerified !== undefined)
//     updateData.identificationVerified = identificationVerified;
//   if (paymentPayoutDetails !== undefined)
//     updateData.paymentPayoutDetails = paymentPayoutDetails;

//   // Hash new password if provided
//   if (password) {
//     updateData.passwordHash = await hashPassword(password);
//   }

//   if (Object.keys(updateData).length === 0) {
//     return res
//       .status(400)
//       .json({ message: "No valid fields provided for update." });
//   }

//   try {
//     const updated = await User.updateUser(userId, updateData);
//     if (updated) {
//       const updatedUser = await User.findById(userId);
//       const { password_hash, ...userProfile } = updatedUser;
//       res
//         .status(200)
//         .json({ message: "User updated successfully!", user: userProfile });
//     } else {
//       res.status(400).json({ message: "Failed to update user." });
//     }
//   } catch (error) {
//     console.error("Error updating user by ID:", error);
//     res
//       .status(500)
//       .json({ message: "Server error updating user.", error: error.message });
//   }
// };

// module.exports = {
//   getMyProfile,
//   updateMyProfile,
//   updateUserById, // for admin
// };
// Path: parking-app-backend/src/controllers/user.js

const Joi = require("joi");
const User = require("../models/user");
const { hashPassword, comparePassword } = require("../utils/password");
const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || 'supersecretjwtkey'; // Must match auth middleware

// --- Joi Schemas for Validation ---

// Schema for user registration
const registerSchema = Joi.object({
  firstName: Joi.string().min(2).max(100).required(),
  lastName: Joi.string().min(2).max(100).required(),
  phoneNumber: Joi.string()
    .pattern(/^\+?\d{10,15}$/) // Allows optional leading '+' and 10-15 digits
    .required()
    .messages({
      'string.pattern.base': 'Phone number must be between 10 and 15 digits and can optionally start with a "+".'
    }),
  email: Joi.string().email().max(255).allow(null, ""), // Allow null or empty string
  password: Joi.string().min(6).required(), // Minimum 6 characters for password
  userType: Joi.string().valid("driver", "homeowner").required(), // Only these types can register
});

// Schema for user login
const loginSchema = Joi.object({
  identifier: Joi.string().required(), // Can be email or phone number
  password: Joi.string().required(),
});

// Schema for updating user profile (for logged-in user updating themselves)
const updateProfileSchema = Joi.object({
  firstName: Joi.string().min(2).max(100),
  lastName: Joi.string().min(2).max(100),
  phoneNumber: Joi.string()
    .pattern(/^\+?\d{10,15}$/)
    .allow(null, "") // Allow setting to null or empty string
    .messages({
      'string.pattern.base': 'Phone number must be between 10 and 15 digits and can optionally start with a "+".'
    }),
  email: Joi.string().email().max(255).allow(null, ""), // Allow null or empty string
  profilePictureUrl: Joi.string().uri().max(255).allow(null, ""), // Basic URL validation
  // identificationVerified and paymentPayoutDetails are typically admin-only updates for security
}).min(1).unknown(false); // At least one field required for update, disallow unknown fields

// Schema for updating any user by ID (Admin only)
const adminUpdateUserSchema = Joi.object({
  firstName: Joi.string().min(2).max(100),
  lastName: Joi.string().min(2).max(100),
  phoneNumber: Joi.string()
    .pattern(/^\+?\d{10,15}$/)
    .allow(null, "")
    .messages({
      'string.pattern.base': 'Phone number must be between 10 and 15 digits and can optionally start with a "+".'
    }),
  email: Joi.string().email().max(255).allow(null, ""),
  password: Joi.string().min(6).optional(), // Password is optional for update, will be hashed if provided
  userType: Joi.string().valid("driver", "homeowner", "admin"),
  profilePictureUrl: Joi.string().uri().max(255).allow(null, ""),
  identificationVerified: Joi.boolean(), // Can be updated by admin
  paymentPayoutDetails: Joi.object().allow(null), // Can be updated by admin, expects a JSON object
  // status: Joi.string().valid("active", "inactive", etc.) // If you have a user status field
}).min(1).unknown(false);


// --- Controller Functions ---

/**
 * @route POST /api/auth/register
 * @description Register a new user.
 * @access Public
 */
const registerUser = async (req, res) => {
  const { error, value } = registerSchema.validate(req.body, { abortEarly: false });
  if (error) {
    const messages = error.details.map((d) => d.message);
    return res.status(400).json({ message: "Validation error: " + messages.join(", "), errors: error.details });
  }

  const { firstName, lastName, phoneNumber, email, password, userType } = value;

  try {
    // Check if user already exists by email or phone number
    const existingUser = await User.findByEmailOrPhone(phoneNumber); // Check phone number first
    if (existingUser) {
      if (existingUser.phone_number === phoneNumber) {
        return res.status(400).json({ message: "User with this phone number already exists." });
      }
      // Only check email if it was provided in the registration attempt
      if (email && existingUser.email === email) {
        return res.status(400).json({ message: "User with this email already exists." });
      }
    }

    const passwordHash = await hashPassword(password);

    const newUserData = {
      first_name: firstName,
      last_name: lastName,
      phone_number: phoneNumber,
      email: email || null, // Ensure email is explicitly null if empty string
      password_hash: passwordHash,
      user_type: userType,
    };

    const newUser = await User.createUser(newUserData);

    // Generate token for the newly registered user
    const token = jwt.sign(
      { user_id: newUser.user_id, user_type: newUser.user_type },
      JWT_SECRET,
      { expiresIn: "1h" }
    );

    res.status(201).json({
      message: "User registered successfully!",
      user: {
        user_id: newUser.user_id,
        first_name: newUser.first_name,
        last_name: newUser.last_name,
        phone_number: newUser.phone_number,
        email: newUser.email,
        user_type: newUser.user_type,
      },
      token,
    });
  } catch (error) {
    console.error("Error during user registration:", error);
    res.status(500).json({ message: "Server error during registration.", error: error.message });
  }
};

/**
 * @route POST /api/auth/login
 * @description Authenticate user & get token.
 * @access Public
 */
const loginUser = async (req, res) => {
  const { error, value } = loginSchema.validate(req.body, { abortEarly: false });
  if (error) {
    const messages = error.details.map((d) => d.message);
    return res.status(400).json({ message: "Validation error: " + messages.join(", "), errors: error.details });
  }

  const { identifier, password } = value; // Identifier can be email or phone number

  try {
    const user = await User.findByEmailOrPhone(identifier);

    if (!user) {
      return res.status(400).json({ message: "Invalid credentials." });
    }

    const isMatch = await comparePassword(password, user.password_hash);

    if (!isMatch) {
      return res.status(400).json({ message: "Invalid credentials." });
    }

    const token = jwt.sign(
      { user_id: user.user_id, user_type: user.user_type },
      JWT_SECRET,
      { expiresIn: "1h" }
    );

    res.status(200).json({
      message: "Login successful!",
      user: {
        user_id: user.user_id,
        first_name: user.first_name,
        last_name: user.last_name,
        email: user.email,
        phone_number: user.phone_number,
        user_type: user.user_type,
      },
      token,
    });
  } catch (error) {
    console.error("Error during user login:", error);
    res.status(500).json({ message: "Server error during login.", error: error.message });
  }
};


/**
 * @route GET /api/users/profile
 * @description Get the authenticated user's profile.
 * @access Private
 */
const getMyProfile = async (req, res) => {
  try {
    // req.user is populated by the 'protect' middleware
    const user = await User.findById(req.user.user_id);
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }
    // Exclude sensitive information like password hash
    const { password_hash, ...userProfile } = user;
    res.status(200).json(userProfile);
  } catch (error) {
    console.error("Error fetching user profile:", error);
    res.status(500).json({
      message: "Server error fetching profile.",
      error: error.message,
    });
  }
};

/**
 * @route PUT /api/users/profile
 * @description Update the authenticated user's profile.
 * @access Private
 */
const updateMyProfile = async (req, res) => {
  const userId = req.user.user_id;

  const { error, value } = updateProfileSchema.validate(req.body, { abortEarly: false });
  if (error) {
    const messages = error.details.map((d) => d.message);
    return res.status(400).json({ message: "Validation error: " + messages.join(", "), errors: error.details });
  }

  const updateData = { ...value }; // Use the validated value directly

  try {
    // Check if the new email or phone number already exists for *another* user
    if (updateData.email || updateData.phoneNumber) {
      const existingUserWithEmail = updateData.email
        ? await User.findByEmail(updateData.email)
        : null;
      const existingUserWithPhone = updateData.phoneNumber
        ? await User.findByPhoneNumber(updateData.phoneNumber)
        : null;

      if (existingUserWithEmail && existingUserWithEmail.user_id !== userId) {
        return res
          .status(400)
          .json({ message: "Email already registered by another user." });
      }
      if (existingUserWithPhone && existingUserWithPhone.user_id !== userId) {
        return res
          .status(400)
          .json({
            message: "Phone number already registered by another user.",
          });
      }
    }

    const updated = await User.updateUser(userId, updateData);
    if (updated) {
      const updatedUser = await User.findById(userId);
      const { password_hash, ...userProfile } = updatedUser; // Exclude sensitive data
      res
        .status(200)
        .json({ message: "Profile updated successfully!", user: userProfile });
    } else {
      res.status(400).json({ message: "Failed to update profile." });
    }
  } catch (error) {
    console.error("Error updating user profile:", error);
    if (error.code === "ER_DUP_ENTRY") {
      return res
        .status(400)
        .json({
          message: "A user with this email or phone number already exists.",
        });
    }
    res.status(500).json({
      message: "Server error updating profile.",
      error: error.message,
    });
  }
};

/**
 * @route DELETE /api/users/profile
 * @description Delete the authenticated user's profile.
 * @access Private
 */
const deleteMyProfile = async (req, res) => {
  try {
    const userId = req.user.user_id;
    const deleted = await User.deleteUser(userId);
    if (deleted) {
      res.status(200).json({ message: "User profile deleted successfully." });
    } else {
      res.status(404).json({ message: "User not found or already deleted." });
    }
  } catch (error) {
    console.error("Error deleting user profile:", error);
    res.status(500).json({ message: "Server error deleting profile.", error: error.message });
  }
};

/**
 * @route GET /api/users
 * @description Get all users.
 * @access Private (Admin only)
 */
const getAllUsers = async (req, res) => {
  try {
    const users = await User.findAllUsers();
    // Filter out password hashes for all users before sending
    const safeUsers = users.map(user => {
      const { password_hash, ...rest } = user;
      return rest;
    });
    res.status(200).json(safeUsers);
  } catch (error) {
    console.error("Error fetching all users:", error);
    res.status(500).json({ message: "Server error fetching users.", error: error.message });
  }
};

/**
 * @route PUT /api/users/:id
 * @description Update any user by ID.
 * @access Private (Admin only)
 */
const updateUserById = async (req, res) => {
  const { id: userId } = req.params;

  const { error, value } = adminUpdateUserSchema.validate(req.body, { abortEarly: false });
  if (error) {
    const messages = error.details.map((d) => d.message);
    return res.status(400).json({ message: "Validation error: " + messages.join(", "), errors: error.details });
  }

  const updateData = { ...value };

  // Hash new password if provided in admin update
  if (updateData.password) {
    updateData.password_hash = await hashPassword(updateData.password); // Map to password_hash
    delete updateData.password; // Remove original password field
  }

  // Check if the new email or phone number already exists for *another* user
  // (admin updating another user)
  if ((updateData.email || updateData.phoneNumber) && userId) {
    const existingUserWithEmail = updateData.email
      ? await User.findByEmail(updateData.email)
      : null;
    const existingUserWithPhone = updateData.phoneNumber
      ? await User.findByPhoneNumber(updateData.phoneNumber)
      : null;

    if (existingUserWithEmail && existingUserWithEmail.user_id !== parseInt(userId)) {
      return res
        .status(400)
        .json({ message: "Email already registered by another user." });
    }
    if (existingUserWithPhone && existingUserWithPhone.user_id !== parseInt(userId)) {
      return res
        .status(400)
        .json({
          message: "Phone number already registered by another user.",
        });
    }
  }

  try {
    const updated = await User.updateUser(userId, updateData);
    if (updated) {
      const updatedUser = await User.findById(userId);
      const { password_hash, ...userProfile } = updatedUser;
      res.status(200).json({ message: "User updated successfully!", user: userProfile });
    } else {
      res.status(400).json({ message: "Failed to update user or no changes provided." });
    }
  } catch (error) {
    console.error("Error updating user by ID (admin):", error);
    if (error.code === "ER_DUP_ENTRY") {
      return res
        .status(400)
        .json({
          message: "A user with this email or phone number already exists.",
        });
    }
    res.status(500).json({ message: "Server error updating user by ID.", error: error.message });
  }
};


module.exports = {
  registerUser,
  loginUser,
  getMyProfile,
  updateMyProfile,
  deleteUser: deleteMyProfile, // Export deleteMyProfile as deleteUser for router consistency
  getAllUsers,
  updateUserById,
};
