import QrScanner from './qr-scanner.min.js';
QrScanner.WORKER_PATH = 'js/qr-scanner-worker.min.js';

import Translator from 'https://directdemocracy.vote/js/translator.js';
let languagePicker;
let homePageIsReady = false;
let translatorIsReady = false;
let translator = new Translator('/i18n');

function setupLanguagePicker() {
  if (languagePicker || !homePageIsReady || !translatorIsReady)
    return;
  let values = [];
  for (let key in translator.languages)
    values.push(translator.languages[key]);
  languagePicker = app.picker.create({
    inputEl: '#language-picker',
    value: [translator.languages[translator.language]],
    toolbarCloseText: translator.translate('language-select'),
    cols: [{
      textAlign: 'center',
      values: values
    }]
  });
  languagePicker.on('change', function(picker, value) {
    for (let key in translator.languages) {
      if (translator.languages[key] === value[0]) {
        if (translator.language !== key) {
          translator.language = key;
          picker.close();
        }
        break;
      }
    }
  });
}

translator.onready = function() {
  translatorIsReady = true;
  setupLanguagePicker();
}

let app = new Framework7({el: '#app', name: 'directdemocracy', panel: {swipe: true}, routes: [{path: '/', pageName: 'home'}, {path: '/info/', pageName: 'info'}]});

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

let mainView = app.views.create('.view-main', {iosDynamicNavbar: false});

window.onload = function() {
  const DIRECTDEMOCRACY_VERSION = '0.0.2';
  let citizen = {
    schema: '',
    key: '',
    signature: '',
    published: 0,
    familyName: '',
    givenNames: '',
    picture: '',
    latitude: 0,
    longitude: 0
  };
  if (window.localStorage.getItem('registered'))
    showPage('splash');
  else
    showPage('register');

  // show either:
  // 1. the register page when the citizen has not yet registered
  // 2. the splash page when downloading registered citizen data
  // 3. the card page once registered citizen data is available
  function showPage(page) {
    const pages = ['splash', 'register', 'card'];
    if (!pages.includes(page)) {
      console.error(`Page '${page}' not found`);
      return;
    }
    document.getElementById(page + '-page').style.display = '';
    pages.forEach(function(p) {
      if (p !== page)
        document.getElementById(p + '-page').style.display = 'none';
    });
    const cards = ['endorse', 'vote', 'sign'];
    cards.forEach(function(i) {
      const tab = `tab-${i}`;
      const tabbar = `tabbar-${i}`;
      if (page === 'card') {
        enable(tab);
        enable(tabbar);
      } else {
        disable(tab);
        disable(tabbar);
      }
    });
  }
  
  function enable(item) {
    let i = (typeof item === 'string') ? document.getElementById(item) : item;
    i.classList.remove('disabled');
  }

  function disable(item) {
    let i = (typeof item === 'string') ? document.getElementById(item) : item;
    if (i.classList.contains('disabled'))
      return;
    i.classList.add('disabled');
  }

}
