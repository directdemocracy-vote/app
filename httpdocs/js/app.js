import Translator from "./translator.js";
let translator = new Translator('/i18n', 'fr');

let app = new Framework7({el: '#app', name: 'directdemocracy', panel: {swipe: true}, routes: [{path: '/info/', pageName: 'info'}, {path: '/', pageName: 'home'}]});
let mainView = app.views.create('.view-main');
