import Translator from "https://directdemocracy.vote/js/translator.js";
let languagePicker;
let homePageIsReady = false;
let translatorIsReady = false;
let translator = new Translator('/i18n');

function setupLanguagePicker() {
  if (languagePicker || !homepageIsReady || !translatorIsReady)
    return;
  let values = [];
  let displayValues = [];
  for (let key in translator.languages) {
    values.push(key);
    displayValues.push(translator.languages[key])
  }
  languagePicker = app.picker.create({
    inputEl: '#language-picker',
    value: translator.language,
    cols: [{
      values: values,
      displayValues: displayValues
    }]
  });
  languagePickerIsReady = true;
}

translator.onready = function() {
  translatorIsReady = true;
  setupLanguagePicker();
}

let app = new Framework7({el: '#app', name: 'directdemocracy', panel: {swipe: true}, routes: [{path: '/info/', pageName: 'info'}, {path: '/', pageName: 'home'}]});

app.on('pageInit', function(page) {
  if (page.name !== 'home')
    return;
  homePageIsReady = true;
  setupLanguagePicker();
});

app.on('pageBeforeRemove', function(page) {
  if (page.name !== 'home')
    return;
  homePageIsReady = false;
  languagePicker.destroy();
  languagePicker = undefined;
});

let mainView = app.views.create('.view-main');
