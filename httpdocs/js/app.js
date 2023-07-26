import Translator from "./translator.js";
let translator = new Translator();

let app = new Framework7({el: '#app', name: 'directdemocracy', panel: {swipe: true}, routes: [{path: '/about/', url: 'about.html'}]});
let mainView = app.views.create('.view-main');
if (Framework7.device.ios)
  console.log('It is iOS device');
else if (Framework7.device.android)
  console.log('It is Android device');
