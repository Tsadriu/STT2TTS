require("dotenv").config();
const express = require("express");
const path = require("path");
const config = require("../config.json")
const app = express();
const { Translate } = require('@google-cloud/translate').v2;

const translator = new Translate();

let languageList = {}

/**
 * Traduci il testo text a language da from.
 * Se from è undefined, la lingua viene automaticamente determinata.
 */
async function translate(text, language, from) {
  let data = await translator.translate(text, {
    from: from,
    to: language,
  });
  return data[0];
}

/**
 * Salva in cache la lista delle lingue disponibili in Google Translate.
 */
async function cacheLanguages() {
  [languageList] = await translator.getLanguages();
}

async function onReady() {
  console.log("Listening on port " + config.port)
  await cacheLanguages()
}

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.get('/', (req, res) => {
  res.render('index', {
    // [ { code: 'langCode', name: 'langName' }, ... ]
    languages: languageList
  });
});

// Fornisci file statici dalla cartella static
// La prima pagina è index.html, potrebbe contenere HTML
app.use(express.static("static"));
app.listen(config.port, onReady);