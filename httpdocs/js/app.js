import Translator from "https://directdemocracy.vote/js/translator.js";
let languagePicker;
let languages;
let canSetupLanguagePicker = false;
let translator = new Translator('/i18n');

function setupLanguagePicker() {
  languagePicker = app.picker.create({
    inputEl: '#language-picker',
    cols: [{
      textAlign: 'center',
      values: languages
    }]
  });
}

translator.onready = function() {
  console.log('ready');
  languages = [];
  for (let key in translator.languages)
    languages.push(translator.languages[key])
  if (canSetupLanguagePicker)
    setupLanguagePicker();
}

let app = new Framework7({el: '#app', name: 'directdemocracy', panel: {swipe: true}, routes: [{path: '/info/', pageName: 'info'}, {path: '/', pageName: 'home'}]});

                   
app.on('init', function() {
  console.log('init');
  if (languages)
    setupLanguagePicker();
  else
    canSetupLanguagePicker = true;
});

let mainView = app.views.create('.view-main');
