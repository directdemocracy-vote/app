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
    if (language == 'en')
      return;
    fetch(`/i18n/${language}.json`)
      .then((r) => r.json())
      .then((dictionary) => {
        this.dictionary = dictionary;
        translatePage();
      })
      .catch(() => {
        console.error(`Could not load ${language}.json`);
      });
  }
  get language() {
    return document.documentElement.lang;
  }
  translatePage() {
    
  }
}
export default Translator;
