const express = require("express");
const config = require("../config.json")
const app = express();

app.use(express.static("static"))

app.listen(config.port)