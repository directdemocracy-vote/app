"use strict"

class Translator {
  constructor() {
    this._languages = ['en', 'fr'];
    this.language = 'default';
  }
  set language(language) {
    if (language === 'default')
      language = navigator.languages ? navigator.languages[0] : navigator.language;
    if (!this._languages.includes(language))
      language = language.substr(0, 2);
    if (!this._languages.includes(language))
      language = this._languages[0];
    if (document.documentElement.lang !== language)
      document.documentElement.lang = language;
    fetch(`/i18n/${language}.json`)
      .then((r) => r.json())
      .then((dictionary) => {
        this._dictionary = dictionary;
        this.translatePage();
      })
      .catch(() => {
        console.error(`Could not load "${language}.json".`);
      });
  }
  get language() {
    return document.documentElement.lang;
  }
  translatePage() {
    this._elements = document.querySelectorAll("[data-i18n]");
    this._elements.forEach((element) => {
      let key = element.dataset.i18n;
      if (key in this._dictionary)
        element.innerHTML = this.translate(key);
      else {
        console.error(`Missing translation for key "${key}" in language "${this.language}".`);
        element.innerHTML = this.translate('en');
      }
    });
  }
  translate(key) {
    return this._dictionary[key];
  }
}
export default Translator;