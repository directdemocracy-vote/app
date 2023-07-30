import Translator from "https://directdemocracy.vote/js/translator.js";
let languagePicker;
let languages;
let canSetupLanguagePicker = false;
let translator = new Translator('/i18n');

function setupLanguagePicker() {
  values = [];
  displayValues = [];
  for (let key in translator.languages) {
    values.push(key);
    displayValues.push(translator.languages[key])
  }
  languagePicker = app.picker.create({
    inputEl: '#language-picker',
    value: translator.language,
    cols: [{
      values: values,
      displayValues: displayValues;
    }]
  });
}

translator.onready = function() {
  if (canSetupLanguagePicker)
    setupLanguagePicker();
}

let app = new Framework7({el: '#app', name: 'directdemocracy', panel: {swipe: true}, routes: [{path: '/info/', pageName: 'info'}, {path: '/', pageName: 'home'}]});

app.on('pageInit', function(page) {
  if (page.name !== 'home')
    return;
  if (languages)
    setupLanguagePicker();
  else
    canSetupLanguagePicker = true;
});

app.on('pageBeforeRemove', () => {
  languagePicker.destroy();
});

let mainView = app.views.create('.view-main');
