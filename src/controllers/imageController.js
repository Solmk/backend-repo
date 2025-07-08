const Joi = require("joi");
const db = require("../config/db");
const path = require("path");
const fs = require("fs/promises"); // Use fs.promises for async file operations

// The directory where Multer initially saves files (defined in upload.js)
// This path refers to the 'uploads' folder at the root of your backend project, outside of 'src'.
const UPLOADS_TEMP_DIR = path.join(__dirname, "..", "..", "uploads");

// The permanent public directory where images will be moved for serving
// This path refers to the 'public/uploads' folder at the root of your backend.
const PUBLIC_UPLOADS_DIR = path.join(
  __dirname,
  "..",
  "..",
  "public",
  "uploads"
);

// Ensure the public/uploads directory exists on server startup
(async () => {
  try {
    await fs.mkdir(PUBLIC_UPLOADS_DIR, { recursive: true });
    console.log(
      `[ImageController] Ensured public uploads directory exists at: ${PUBLIC_UPLOADS_DIR}`
    );
  } catch (err) {
    console.error(
      `[ImageController] Error ensuring public uploads directory: ${err.message}`
    );
  }
})();

const uploadImageSchema = Joi.object({
  spotId: Joi.number().integer().positive().required(),
});

const imageIdSchema = Joi.object({
  spotId: Joi.number().integer().positive().required(),
  imageId: Joi.number().integer().positive().required(),
});

/**
 * @route POST /api/parking-spots/:spotId/images
 * @description Uploads an image for a parking spot and saves its path to the database.
 * @access Private (Homeowner, Admin)
 */
exports.uploadImage = async (req, res, next) => {
  const { spotId } = req.params;
  const userId = req.user.user_id;

  console.log(
    `[ImageController] --- START UPLOAD PROCESS FOR Spot ID: ${spotId} ---`
  );
  console.log(
    `[ImageController] Authenticated User ID: ${userId}, Type: ${req.user.user_type}`
  );

  // Multer puts file info on req.file. If req.file is missing here,
  // it means uploadMiddleware did not process the file successfully or file was not sent.
  if (!req.file) {
    console.error(
      "[ImageController] ERROR: req.file is undefined/null. Multer likely failed to process the file or no file was sent."
    );
    return res.status(400).json({
      message: "No image file provided or file processing failed.",
    });
  }

  // Joi validation for spotId
  const { error } = uploadImageSchema.validate({ spotId });
  if (error) {
    console.error(
      "[ImageController] Joi validation error for spotId:",
      error.details[0].message
    );
    // If validation fails after file is theoretically saved by Multer to temp, delete it
    await fs
      .unlink(req.file.path)
      .catch((err) =>
        console.error("Error deleting uploaded file after Joi error:", err)
      );
    return res.status(400).json({ message: error.details[0].message });
  }

  console.log(
    "[ImageController] File received by Multer (confirmed in controller):"
  );
  console.log(`  Originalname: ${req.file.originalname}`);
  console.log(`  Filename: ${req.file.filename}`);
  console.log(`  Path on disk (from Multer temp): ${req.file.path}`);
  console.log(`  Size: ${req.file.size} bytes`);
  console.log(`  Mimetype: ${req.file.mimetype}`);

  // FIX: imageUrlForDB should NOT include '/public/'
  // because the express.static('public') middleware already makes 'public' the root.
  // So, an image in 'public/uploads/filename.jpg' is accessed as '/uploads/filename.jpg'.
  const imageUrlForDB = `/uploads/${req.file.filename}`; // CORRECTED PATH

  let connection;
  try {
    connection = await db.getConnection();
    await connection.beginTransaction();
    console.log(
      "[ImageController] Database connection obtained, starting transaction."
    );

    const [spotRows] = await connection.execute(
      "SELECT homeowner_id FROM parking_spots WHERE spot_id = ?",
      [spotId]
    );

    if (spotRows.length === 0) {
      await connection.rollback();
      console.warn(
        "[ImageController] Parking spot not found, rolling back and deleting file."
      );
      await fs
        .unlink(req.file.path)
        .catch((err) =>
          console.error(
            "Error deleting uploaded temp file (spot not found):",
            err
          )
        );
      return res.status(404).json({ message: "Parking spot not found." });
    }

    if (spotRows[0].homeowner_id !== userId && req.user.user_type !== "admin") {
      await connection.rollback();
      console.warn(
        "[ImageController] Unauthorized user attempting upload, rolling back and deleting file."
      );
      await fs
        .unlink(req.file.path)
        .catch((err) =>
          console.error("Error deleting unauthorized uploaded temp file:", err)
        );
      return res
        .status(403)
        .json({ message: "Forbidden: You do not own this parking spot." });
    }

    // Move the uploaded file from Multer's temp directory to the permanent public directory
    const destinationPath = path.join(PUBLIC_UPLOADS_DIR, req.file.filename);
    console.log(
      `[ImageController] Moving file from: ${req.file.path} to: ${destinationPath}`
    );
    await fs.rename(req.file.path, destinationPath);
    console.log(
      "[ImageController] File moved successfully to public directory."
    );

    // Determine if this new image should be primary.
    // If no primary exists for this spot, make this the primary.
    let isPrimary = 0; // Default to not primary
    const [countRows] = await connection.execute(
      "SELECT COUNT(*) AS image_count FROM parking_spot_images WHERE spot_id = ? AND is_primary = 1",
      [spotId]
    );

    if (countRows[0].image_count === 0) {
      isPrimary = 1; // Make the first uploaded image primary automatically
      console.log(
        "[ImageController] No primary image found, setting current image as primary."
      );
    } else {
      console.log(
        "[ImageController] Primary image already exists, new image is not primary."
      );
    }

    console.log(
      "[ImageController] Spot ownership verified. Inserting image into DB with path:",
      imageUrlForDB
    );
    const [result] = await connection.execute(
      "INSERT INTO parking_spot_images (spot_id, image_url, is_primary) VALUES (?, ?, ?)",
      [spotId, imageUrlForDB, isPrimary]
    );
    console.log(
      `[ImageController] Image inserted into DB with ID: ${result.insertId}`
    );

    await connection.commit();
    console.log(
      "[ImageController] Transaction committed successfully. Image uploaded."
    );
    res.status(200).json({
      message: "Image uploaded successfully",
      image: {
        image_id: result.insertId,
        image_url: imageUrlForDB, // Return the corrected URL
        is_primary: isPrimary,
      },
    });
  } catch (err) {
    if (connection) {
      await connection.rollback();
      console.error(
        "[ImageController] Database transaction rolled back due to error."
      );
    }
    console.error(
      "[ImageController] General error during image upload process:",
      err
    );
    // Attempt to delete the file if it was saved by Multer to temp, or moved, but an error occurred later
    // Check if the file still exists in the original Multer temp path or the final public path
    const tempFilePath = req.file?.path;
    const finalFilePath = req.file
      ? path.join(PUBLIC_UPLOADS_DIR, req.file.filename)
      : null;

    if (tempFilePath) {
      await fs.unlink(tempFilePath).catch((unlinkErr) => {
        if (unlinkErr.code !== "ENOENT")
          // Ignore if file not found (already moved or deleted)
          console.error(
            "[ImageController] Error deleting temp uploaded file on error:",
            unlinkErr
          );
      });
    }
    if (finalFilePath) {
      await fs.unlink(finalFilePath).catch((unlinkErr) => {
        if (unlinkErr.code !== "ENOENT")
          // Ignore if file not found (already moved or deleted)
          console.error(
            "[ImageController] Error deleting moved uploaded file on error:",
            unlinkErr
          );
      });
    }

    next(err); // Pass error to global error handler
  } finally {
    if (connection) connection.release();
    console.log(
      "[ImageController] Database connection released. --- END UPLOAD PROCESS ---"
    );
  }
};

// setPrimaryImage and deleteImage functions (updated to use PUBLIC_UPLOADS_DIR)
// ... [Your existing setPrimaryImage and deleteImage functions here] ...
exports.setPrimaryImage = async (req, res, next) => {
  const { spotId, imageId } = req.params;
  const userId = req.user.user_id;

  console.log(
    `[ImageController] Attempting to set primary image ${imageId} for Spot ID: ${spotId}`
  );

  const { error } = imageIdSchema.validate({ spotId, imageId });
  if (error) {
    console.error(
      "[ImageController] Joi validation error for setPrimaryImage:",
      error.details[0].message
    );
    return res.status(400).json({ message: error.details[0].message });
  }

  let connection;
  try {
    connection = await db.getConnection();
    await connection.beginTransaction();

    const [spotRows] = await connection.execute(
      "SELECT homeowner_id FROM parking_spots WHERE spot_id = ?",
      [spotId]
    );
    if (spotRows.length === 0) {
      await connection.rollback();
      console.warn(
        "[ImageController] Parking spot not found for setPrimaryImage."
      );
      return res.status(404).json({ message: "Parking spot not found." });
    }
    if (spotRows[0].homeowner_id !== userId && req.user.user_type !== "admin") {
      await connection.rollback();
      console.warn("[ImageController] Unauthorized user for setPrimaryImage.");
      return res
        .status(403)
        .json({ message: "Forbidden: You do not own this parking spot." });
    }

    const [imageRows] = await connection.execute(
      "SELECT image_id FROM parking_spot_images WHERE image_id = ? AND spot_id = ?",
      [imageId, spotId]
    );
    if (imageRows.length === 0) {
      await connection.rollback();
      console.warn(
        "[ImageController] Image not found for this spot in setPrimaryImage."
      );
      return res
        .status(404)
        .json({ message: "Image not found for this spot." });
    }

    await connection.execute(
      "UPDATE parking_spot_images SET is_primary = 0 WHERE spot_id = ?",
      [spotId]
    );
    console.log("[ImageController] All images for spot set to non-primary.");

    await connection.execute(
      "UPDATE parking_spot_images SET is_primary = 1 WHERE image_id = ?",
      [imageId]
    );
    console.log(`[ImageController] Image ${imageId} set as primary.`);

    await connection.commit();
    console.log("[ImageController] setPrimaryImage transaction committed.");
    res.status(200).json({ message: "Image set as primary successfully." });
  } catch (err) {
    if (connection) await connection.rollback();
    console.error("[ImageController] Error setting primary image:", err);
    next(err);
  } finally {
    if (connection) connection.release();
  }
};

exports.deleteSpotImage = async (req, res, next) => {
  // Renamed from deleteImage to deleteSpotImage for clarity
  const { spotId, imageId } = req.params;
  const userId = req.user.user_id;
  const userType = req.user.user_type;

  console.log(
    `[ImageController] Attempting to delete image ${imageId} from Spot ID: ${spotId}`
  );

  const { error } = imageIdSchema.validate({ spotId, imageId });
  if (error) {
    console.error(
      "[ImageController] Joi validation error for deleteImage:",
      error.details[0].message
    );
    return res.status(400).json({ message: error.details[0].message });
  }

  let connection;
  try {
    connection = await db.getConnection();
    await connection.beginTransaction();

    const [spotRows] = await connection.execute(
      "SELECT homeowner_id FROM parking_spots WHERE spot_id = ?",
      [spotId]
    );
    if (spotRows.length === 0) {
      await connection.rollback();
      console.warn("[ImageController] Parking spot not found for deleteImage.");
      return res.status(404).json({ message: "Parking spot not found." });
    }
    if (spotRows[0].homeowner_id !== userId && userType !== "admin") {
      await connection.rollback();
      console.warn("[ImageController] Unauthorized user for deleteImage.");
      return res
        .status(403)
        .json({ message: "Forbidden: You do not own this parking spot." });
    }

    const [imageRows] = await connection.execute(
      "SELECT image_url, is_primary FROM parking_spot_images WHERE image_id = ? AND spot_id = ?",
      [imageId, spotId]
    );
    if (imageRows.length === 0) {
      await connection.rollback();
      console.warn(
        "[ImageController] Image not found for this spot in deleteImage."
      );
      return res
        .status(404)
        .json({ message: "Image not found for this spot." });
    }

    const imageUrlToDelete = imageRows[0].image_url;
    const wasPrimary = imageRows[0].is_primary;
    console.log(`[ImageController] Image found in DB: ${imageUrlToDelete}`);

    await connection.execute(
      "DELETE FROM parking_spot_images WHERE image_id = ?",
      [imageId]
    );
    console.log(`[ImageController] Image ${imageId} deleted from DB.`);

    if (wasPrimary) {
      // If the deleted image was primary, find a new primary
      const [firstImage] = await connection.execute(
        "SELECT image_id FROM parking_spot_images WHERE spot_id = ? ORDER BY image_id ASC LIMIT 1",
        [spotId]
      );
      if (firstImage.length > 0) {
        await connection.execute(
          "UPDATE parking_spot_images SET is_primary = 1 WHERE image_id = ?",
          [firstImage[0].image_id]
        );
        console.log(
          `[ImageController] New primary image set to ${firstImage[0].image_id}.`
        );
      } else {
        console.log(
          "[ImageController] No other images left to set as primary."
        );
      }
    } else {
      console.log(
        "[ImageController] Deleted image was not primary. No change to primary status needed."
      );
    }

    await connection.commit();
    console.log("[ImageController] deleteImage transaction committed.");

    // Delete the actual file from the file system
    // The image_url stored in DB is like /uploads/filename.jpg
    const filePath = path.join(
      PUBLIC_UPLOADS_DIR,
      path.basename(imageUrlToDelete)
    );
    console.log(
      `[ImageController] Attempting to unlink file from filesystem: ${filePath}`
    );
    await fs.unlink(filePath).catch((err) => {
      if (err.code === "ENOENT") {
        // File not found, likely already deleted or never existed at that exact path
        console.warn(
          "[ImageController] Physical image file not found on disk, skipping unlink:",
          filePath,
          err.message
        );
      } else {
        console.error(
          "[ImageController] Error deleting physical image file from filesystem:",
          filePath,
          err
        );
      }
    });

    res.status(200).json({ message: "Image deleted successfully." });
  } catch (err) {
    if (connection) await connection.rollback();
    console.error(
      "[ImageController] General error during image deletion process:",
      err
    );
    next(err);
  } finally {
    if (connection) connection.release();
  }
};
