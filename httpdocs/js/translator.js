"use strict"

class Translator {
  constructor(dictionary_url, language) {
    if (!dictionary_url.endsWith('/'))
      dictionary_url += '/';
    this._dictionary_url = dictionary_url;
    fetch(`${dictionary_url}languages.json`)
      .then((r) => r.json())
      .then((languages) => {
        this._languages = languages;
        this.language = language;
      })
      .catch(() => {
        console.error(`Could not load "${dictionary_url}languages.json".`);
      });

    this._languages = ['en', 'fr'];
    this.language = 'default';
  }
  set language(language) {
    if (language === undefined)
      language = navigator.languages ? navigator.languages[0] : navigator.language;
    if (!this._languages.includes(language))
      language = language.substr(0, 2);
    if (!this._languages.includes(language))
      language = this._languages[0];
    if (document.documentElement.lang !== language)
      document.documentElement.lang = language;
    fetch(`${this._dictionary_url}${language}.json`)
      .then((r) => r.json())
      .then((dictionary) => {
        this._dictionary = dictionary;
        this.translatePage();
      })
      .catch(() => {
        console.error(`Could not load "${this._dictionary_url}${language}.json".`);
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
