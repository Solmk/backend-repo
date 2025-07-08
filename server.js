const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const path = require("path");
const db = require("./src/config/db");
const { errorHandler } = require("./src/middleware/error");

// Import your API routes
const authRoutes = require("./src/routes/auth");
const userRoutes = require("./src/routes/user");
const parkingSpotRoutes = require("./src/routes/parkingSpot");
const bookingRoutes = require("./src/routes/booking");
const paymentRoutes = require("./src/routes/payment");
const transactionRoutes = require("./src/routes/transaction");
const imageRoutes = require("./src/routes/imageRoutes");

dotenv.config();

const app = express();

// Database connection
db.getConnection()
  .then(() => {
    console.log("[DB] Successfully connected to MySQL database!");
  })
  .catch((err) => {
    console.error("[DB] Failed to connect to MySQL database:", err);
    process.exit(1);
  });

// CORS Configuration
const corsOptions = {
  origin: "http://localhost:3000",
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
  allowedHeaders: ["Content-Type", "Authorization"],
};
app.use(cors(corsOptions));

// --- IMPORTANT: Stripe Webhook Raw Body Parser ---
app.use(
  "/api/payments/stripe/webhook",
  express.raw({ type: "application/json" })
);

// Body parser middleware to handle JSON and URL-encoded data for ALL other routes
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Middleware for logging all incoming requests
app.use((req, res, next) => {
  if (
    req.originalUrl.includes("/api/payments/stripe/webhook") &&
    req.headers["stripe-signature"]
  ) {
    // Don't log raw webhook body here, it's handled by Stripe middleware
  } else {
    console.log("\n--- GLOBAL REQUEST LOG ---");
    console.log(`   Method: ${req.method}`);
    console.log(`   Original URL: ${req.originalUrl}`);
    console.log(`   Query: ${JSON.stringify(req.query)}`);
    console.log(`   Params: ${JSON.stringify(req.params)}`);
    console.log("--------------------------");
  }
  next();
});

// ==========================================================
// FIX: Serve static files from the 'public' directory
// The image controller moves files to 'public/uploads', so we serve from 'public'.
// The URL will then be /public/uploads/filename.jpg
// ==========================================================
app.use(express.static(path.join(__dirname, "public"))); // Serve static files from the 'public' directory

// --- Define API Routes ---
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/parking-spots", parkingSpotRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/transactions", transactionRoutes);
app.use("/api/parking-spots", imageRoutes);

// Root route (optional, for testing if server is up)
app.get("/", (req, res) => {
  res.send("API is running...");
});

// Error handling middleware (should be last, before 404)
app.use(errorHandler);

// Simple 404 handler for unmatched routes (should be after all valid routes)
app.use((req, res, next) => {
  res.status(404).json({ message: `Not Found - ${req.originalUrl}` });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Access: http://localhost:${PORT}`);
});
