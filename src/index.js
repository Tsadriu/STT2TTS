const express = require("express");
const config = require("../config.json")
const app = express();

let a = 2;
app.use(express.static("static"))

app.listen(config.port)