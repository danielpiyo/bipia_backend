const express = require("express");
const router = express.Router();
const { Pool } = require("pg");
const bodyParser = require("body-parser");
const cors = require("cors");
const dotenv = require("dotenv");

// Load environment variables from .env file
dotenv.config();

router.use(cors());
// Use body parser to parse JSON body
router.use(bodyParser.json());

// Create a PostgreSQL connection pool
const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASS,
  port: process.env.DB_PORT,
});

router.post("/cert/verify", async (req, res) => {
  const userEmail = req.body.user_email;

  try {
    const client = await pool.connect(); // Acquire a connection from the pool

    const query =
      "SELECT user_name, user_email, status, date FROM VW_DATA_PRO_COMPLETED WHERE user_email = $1";
    const result = await client.query(query, [userEmail]); // Use the acquired connection for the query

    if (result.rows.length === 0) {
      res.status(404).send("User not found");
    } else {
      res.status(200).json(result.rows[0]);
    }

    client.release(); // Release the connection back to the pool
  } catch (err) {
    console.error("Error executing query", err);
    res.status(500).send("Error");
  }
});

module.exports = router;
