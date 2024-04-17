const mysql = require('mysql2');
require("dotenv").config();

const pool = mysql.createPool({ // Using a pool is usually better for performance
  connectionLimit: 50, // Limit the number of concurrent connections
  host: process.env.DATABASE_HOST,    // Your database host
  user: process.env.DATABASE_USER, // Your database user
  password: process.env.DATABASE_PASS,  // Your database password
  database: process.env.DATABASE_NAME    // Name of your database
});

// Test connection: Example usage: 
pool.query('SELECT 1 + 1 AS solution', (error, results) => {
  if (error) throw error;
  console.log('Database connected:', results[0].solution); // Should output 2
});

module.exports = pool; 