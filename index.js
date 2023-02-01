fetch("languages.json")
  .then((response) => {
    console.log(response);
    return response.json();
  })
  .then((languages) => {
    console.log(languages);
    const languageSelect = document.querySelector("#languageSelect");

    // Remove the default option
    languageSelect.innerHTML = "";

    languages.forEach((language) => {
      const option = document.createElement("option");
      option.value = language.code;
      option.innerText = language.name;
      languageSelect.appendChild(option);
    });
  });