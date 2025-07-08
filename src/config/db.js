// Path: parking-app-backend/src/config/db.js

const mysql = require("mysql2/promise"); // Using promise-based API
require("dotenv").config(); // Adjust path to .env correctly


  
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  port: process.env.DB_PORT,
  waitForConnections: true,
  connectionLimit: 10, // Max number of connections in the pool
  queueLimit: 0, // Unlimited queue for connection requests
});

// Test the connection when the application starts
pool
  .getConnection()
  .then((connection) => {
    console.log("Successfully connected to MySQL database!");
    connection.release(); // Release the connection back to the pool
  })
  .catch((err) => {
    console.error("Error connecting to MySQL database:", err.stack);
    // Exit process if database connection fails critically
    process.exit(1);
  });

module.exports = pool;
