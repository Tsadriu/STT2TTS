const express = require("express");
const config = require("../config.json")
const app = express();

app.set('view engine', 'ejs');

app.get('/', (req, res) => {
    res.render('index', {
        languages: {
            it: "Italiano",
            en: "English",
            es: "Español",
            de: "Deutsch",
            fr: "Franzosischsh"
        }
    });
  });

// Fornisci file statici dalla cartella static
// La prima pagina è index.html, potrebbe contenere HTML
app.use(express.static("static"));

app.listen(config.port, () => console.log("Listening on port " + config.port));