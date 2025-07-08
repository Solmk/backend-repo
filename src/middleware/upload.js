// // Path: parking-app-backend/src/middleware/upload.js

// const multer = require("multer");
// const path = require("path");
// const fs = require("fs");

// const UPLOADS_DIR = path.join(__dirname, "..", "..", "uploads");

// if (!fs.existsSync(UPLOADS_DIR)) {
//   fs.mkdirSync(UPLOADS_DIR, { recursive: true });
//   console.log(`[Multer Init] Created uploads directory at: ${UPLOADS_DIR}`);
// } else {
//   console.log(
//     `[Multer Init] Uploads directory already exists at: ${UPLOADS_DIR}`
//   );
// }

// const storage = multer.diskStorage({
//   destination: function (req, file, cb) {
//     console.log(
//       `[Multer Destination] Attempting to save file to: ${UPLOADS_DIR}`
//     );
//     cb(null, UPLOADS_DIR);
//   },
//   filename: function (req, file, cb) {
//     const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
//     const fileExtension = path.extname(file.originalname);
//     cb(null, "image-" + uniqueSuffix + fileExtension);
//   },
// });

// const fileFilter = (req, file, cb) => {
//   if (file.mimetype.startsWith("image/")) {
//     cb(null, true);
//   } else {
//     // If file type is not allowed, log it and reject
//     console.error(
//       `[Multer Filter] Rejected file: ${file.originalname} (MimeType: ${file.mimetype}). Only images allowed.`
//     );
//     cb(new Error("INVALID_FILE_TYPE: Only image files are allowed!"), false);
//   }
// };

// const upload = multer({
//   storage: storage,
//   fileFilter: fileFilter,
//   limits: {
//     fileSize: 5 * 1024 * 1024, // 5 MB file size limit
//   },
// }).single("image"); // Explicitly define here for consistency

// // Custom error handling for Multer
// const uploadMiddleware = (req, res, next) => {
//   upload(req, res, function (err) {
//     if (err instanceof multer.MulterError) {
//       // A Multer error occurred when uploading.
//       console.error(`[Multer Error] MulterError: ${err.message}`, err);
//       return res
//         .status(400)
//         .json({ message: `File upload error: ${err.message}` });
//     } else if (err) {
//       // An unknown error occurred when uploading.
//       console.error(`[Multer Error] General Error: ${err.message}`, err);
//       // Custom error message for file type validation
//       if (err.message === "INVALID_FILE_TYPE: Only image files are allowed!") {
//         return res
//           .status(400)
//           .json({
//             message: "Only image files (JPG, PNG, GIF, etc.) are allowed.",
//           });
//       }
//       return res
//         .status(500)
//         .json({
//           message: `An unexpected error occurred during file upload: ${err.message}`,
//         });
//     }
//     // Everything went fine.
//     next();
//   });
// };

// module.exports = uploadMiddleware; // Export the wrapped middleware
// parking-app-backend/src/middleware/upload.js
const multer = require("multer");
const path = require("path");
const fs = require("fs");

// Define the directory where images will be stored
const UPLOADS_DIR = path.join(__dirname, "../../uploads"); // This points to the 'uploads' folder at the root of your backend project

// Ensure the uploads directory exists
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  console.log(`Created uploads directory at: ${UPLOADS_DIR}`);
}

// Configure storage for Multer
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, UPLOADS_DIR); // Save files to the UPLOADS_DIR
  },
  filename: function (req, file, cb) {
    // Generate a unique filename using the current timestamp and original file extension
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname));
  },
});

// Configure file filter (optional, but good for security and validation)
const fileFilter = (req, file, cb) => {
  // Accept only image files
  if (file.mimetype.startsWith("image/")) {
    cb(null, true);
  } else {
    cb(new Error("Only image files are allowed!"), false);
  }
};

// Initialize Multer upload instance
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // Limit file size to 5MB
  },
});

// Wrapper middleware to catch Multer errors and pass them to the error handler
const uploadMiddleware = (req, res, next) => {
  upload.single("image")(req, res, (err) => {
    // 'image' is the name of the input field in the form data
    if (err instanceof multer.MulterError) {
      // A Multer error occurred when uploading.
      console.error("[Multer Error]:", err.message);
      if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({ message: "File too large. Max size is 5MB." });
      }
      return res.status(400).json({ message: `Multer Error: ${err.message}` });
    } else if (err) {
      // An unknown error occurred when uploading.
      console.error("[Upload Error]:", err.message);
      return res.status(400).json({ message: err.message });
    }
    // Everything went fine, proceed to the next middleware (your controller)
    next();
  });
};

module.exports = uploadMiddleware;
