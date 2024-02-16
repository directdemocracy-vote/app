import Translator from 'https://app.directdemocracy.vote/app/js/translator.js';

document.addEventListener('DOMContentLoaded', () => {
  window.addEventListener('popstate', function(event) {
    loadPage();
    document.getElementById('navbar-menu').classList.remove('is-active');
    document.getElementById('navbar-burger').classList.remove('is-active');
  });
  let flags = null;
  let translator = new Translator('i18n');
  window.translator = translator;
  translator.onready = function() {
    const language = document.getElementById('language');
    const dropdown = document.getElementById('language-dropdown');
    fetch('../i18n/flags.json')
      .then((r) => r.json())
      .then((content) => {
        function setLanguage(language, previous) {
          if (previous === undefined) {
            previous = translator.language;
            const dd = document.getElementById('language-dropdown');
            dd.classList.add('is-hidden');
            setTimeout(() => {
              dd.classList.remove('is-hidden');
            }, 100);
          }
          translator.language = language;
          document.getElementById(`language-${previous}`).classList.remove('is-disabled');
          document.getElementById(`language-${language}`).classList.add('is-disabled');
          document.getElementById('language').innerHTML = '<img src="https://directdemocracy.vote/images/flags/' + flags[language] + '.svg" width="24">';
        }
        flags = content;
        for (const [country, flag] of Object.entries(flags)) {
          let a = document.createElement('a');
          a.classList.add('navbar-item');
          a.setAttribute('id', `language-${country}`);
          a.addEventListener('click', function(event) {
            setLanguage(country);
            document.getElementById('navbar-menu').classList.remove('is-active');
            document.getElementById('navbar-burger').classList.remove('is-active');
          });
          let img = document.createElement('img');
          img.src = 'https://directdemocracy.vote/images/flags/' + flag + '.svg';
          img.width = '24';
          img.style.marginRight = '6px';
          a.appendChild(img);
          a.appendChild(document.createTextNode(translator.languages[country]));
          dropdown.appendChild(a);
        }
        setLanguage(translator.language);
        if (location.hash) {
          let requested_hash = location.hash.slice(1);
          location.hash = '';
          location.hash = requested_hash;
        }
      })
      .catch((error) => {
        console.error('Could not load "i18n/flags.json".');
        console.error(error);
      });
  };
  const navbarBurgers = Array.prototype.slice.call(document.querySelectorAll('.navbar-burger'), 0);
  navbarBurgers.forEach(el => {
    el.addEventListener('click', () => {
      const target = document.getElementById(el.dataset.target);
      el.classList.toggle('is-active');
      target.classList.toggle('is-active');
    });
  });
  document.getElementById('main-menu').addEventListener('click', function() {
    window.location.href = 'https://directdemocracy.vote';
  });
});
