async function getLanguages() {
  // Imports the Google Cloud client library
const {Translate} = require('@google-cloud/translate').v2;

// Creates a client
const translate = new Translate();

async function listLanguages() {
  // Lists available translation language with their names in English (the default).
  const [languages] = await translate.getLanguages();

  console.log('Languages:');
  languages.forEach(language => console.log(language));
}

listLanguages();
}


async function main() {
  let response = await fetch("languages.json");
  let languageData = await response.json();

  let languageSelect = document.getElementById("languageSelect");
  languageData.forEach(language => {
    let option = document.createElement("option");
    option.value = language.code;
    option.innerText = language.name;
    languageSelect.appendChild(option);
  });
}

main();
