require("dotenv").config();
const express = require("express");
const {Translate} = require('@google-cloud/translate').v2;
const config = require("../config.json")
const app = express();

const translate = new Translate();

async function listLanguages() {
  const [languages] = await translate.getLanguages();

  languages.forEach(language => console.log(language));
}
// waaaaaa
// waaaaaa
listLanguages();

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