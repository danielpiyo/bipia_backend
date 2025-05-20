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
// const pool = new Pool({
//   user: process.env.DB_USER,
//   host: process.env.DB_HOST,
//   database: process.env.DB_NAME,
//   password: process.env.DB_PASS,
//   port: process.env.DB_PORT,
// });

const pool = new Pool({
  user: "bn_canvaslms",
  host: "localhost",
  database: "bitnami_canvaslms",
  password: "0780a26e5499",
  port: 5432, // Default PostgreSQL port
});

router.get("/cert/:id", (req, res) => {
  const userId = req.params.id;
  pool.query(
    "SELECT user_name, user_email, status, date FROM VW_DATA_PRO_COMPLETED WHERE user_email = $1",
    [userId],
    (err, result) => {
      if (err) {
        console.error("Error executing query", err);
        res.status(500).send("Error");
      } else {
        if (result.rows.length === 0) {
          res.status(404).send("User not found");
        } else {
          res.status(200).json(result.rows[0]);
        }
      }
    }
  );
});

module.exports = router;
