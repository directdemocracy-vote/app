import Translator from "https://directdemocracy.vote/js/translator.js";
let translator = new Translator('/i18n');

let app = new Framework7({el: '#app', name: 'directdemocracy', panel: {swipe: true}, routes: [{path: '/info/', pageName: 'info'}, {path: '/', pageName: 'home'}]});
let mainView = app.views.create('.view-main');
