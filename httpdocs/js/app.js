import Translator from "https://directdemocracy.vote/js/translator.js";
let translator = new Translator('/i18n');

let app = new Framework7({el: '#app', name: 'directdemocracy', panel: {swipe: true}, routes: [{path: '/info/', pageName: 'info'}, {path: '/', pageName: 'home'}]});
let languagePicker;
app.on('pageInit', function(page) {
  console.log("Initialize language picker: " + page.info);
  languagePicker = app.picker.create({
    inputEl: '#language-picker',
    cols: [{
      textAlign: 'center',
      values: ['English', 'Français']
    }]
  });
});
app.on('pageBeforeRemove', () => {
  languagePicker.destroy();
});

let mainView = app.views.create('.view-main');
