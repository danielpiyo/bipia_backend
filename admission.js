// getting dependacies
const express = require("express");
const path = require("path");
const http = require("http");
const bodyParser = require("body-parser");
const cors = require("cors");
const https = require("https");
const fs = require("fs");

const options = {
  key: fs.readFileSync("cert/api_key.pem"),
  cert: fs.readFileSync("cert/api_cert.pem"),
};

// API routes
const api = require("./routes/api");
const app = express();

app.use(cors());
// app.use(cors({origin: 'http://localhost:4200'}));

//create a cors middleware
app.use(function (req, res, next) {
  //set headers to allow cross origin request.
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "PUT, GET, POST, DELETE, OPTIONS");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept"
  );
  next();
});

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

// pont static path to dist
app.use(express.static(path.join(__dirname, "dist")));

// set api routes
app.use("/api", api);

// catch all other routers and return to index
app.get("*", (req, res) => {
  // res.sendFile('localhost:4200')
  res.sendFile(path.join(__dirname, "./wrong.html"));
});

// get port from environment and stroe in express
const port = process.env.PORT || "4000";
app.set("port", port);

// create http server
// const server = http.createServer(app);
// const server = https.createServer(options, app);
const server = http.createServer(app);

// server listens on provided port
server.listen(port, () => {
  console.log(`Admissions API listens to port:${port}`);
});
