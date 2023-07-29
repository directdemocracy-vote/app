import Translator from "https://directdemocracy.vote/js/translator.js";
let languagePicker;
let languages = [];
let translator = new Translator('/i18n');

translator.onready = function() {
  for (let key in translator.languages) {
    console.log(key, translator.languages[key]);
    languages.push(translator.languages[key])
  }
  if (languagePicker) {
    console.log(languagePicker);
    languagePicker.setValue(languages);
  }
}

let app = new Framework7({el: '#app', name: 'directdemocracy', panel: {swipe: true}, routes: [{path: '/info/', pageName: 'info'}, {path: '/', pageName: 'home'}]});

                   
app.on('pageInit', function(page) {
  if (page.name !== 'home')
    return;
  languagePicker = app.picker.create({
    inputEl: '#language-picker',
    cols: [{
      textAlign: 'center',
      values: languages
    }]
  });
});
app.on('pageBeforeRemove', () => {
  languagePicker.destroy();
});

let mainView = app.views.create('.view-main');
