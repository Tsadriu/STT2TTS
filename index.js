fetch("languages.json")
  .then((response) => response.json())
  .then((languages) => {
    const languageSelect = document.querySelector("#languageSelect");

    languages.forEach((language) => {
      const option = document.createElement("option");
      option.value = language.code;
      option.innerText = language.name;
      languageSelect.appendChild(option);
    });
  });