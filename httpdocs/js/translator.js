"use strict"

class Translator {
  constructor() {
    this._languages = ['en', 'fr'];
    this.language = 'default';
  }
  set language(language) {
    if (language === 'default')
      this._language = navigator.languages ? navigator.languages[0] : navigator.language;
    else
      this._language = language;
    if (!this._languages.includes(this._language))
      this._language = this._language.substr(0, 2);
    if (!this._languages.includes(this._language))
      this._language = this._languages[0];
    // load dictionnary
    fetch(`/i18n/${this.language}.json`)
      .then((res) => res.json())
      .then((translation) => {
        // do something
      })
      .catch(() => {
        console.error(`Could not load ${this.language}.json.`));
      });
  }
  get language() {
    return this._language;
  }
}
export default Translator;
