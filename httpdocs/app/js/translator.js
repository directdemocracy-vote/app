'use strict';

class Translator {
  #url;
  #dictionary;
  #languages;
  #ready;
  constructor(url, language) {
    this.#ready = false;
    if (!url.endsWith('/'))
      url += '/';
    this.#url = url;
    fetch(`${url}languages.json`)
      .then((r) => r.json())
      .then((languages) => {
        this.#languages = languages;
        this.language = language;
      })
      .catch((error) => {
        console.error(`Could not load "${url}language.json".`);
        console.error(error);
      });
  }
  set language(language) {
    if (this.language === language)
      return;
    if (language === undefined || language === null) {
      language = localStorage.getItem('language');
      if (language === null)
        language = navigator.languages ? navigator.languages[0] : navigator.language;
    }
    if (!Object.keys(this.#languages).includes(language))
      language = language.substring(0, 2);
    if (!Object.keys(this.#languages).includes(language))
      language = 'en';
    if (document.documentElement.lang !== language)
      document.documentElement.lang = language;
    localStorage.setItem('language', language);
    fetch(`${this.#url}${language}.json`)
      .then((r) => r.json())
      .then((dictionary) => {
        this.#dictionary = dictionary;
        this.translatePage();
        if (this.#ready === false) {
          this.#ready = true;
          if (typeof this.onready === 'function')
            this.onready();
        }
      })
      .catch((error) => {
        console.error(`Could not load "${this.#url}${language}.json".`);
        console.log(error);
      });
  }
  get language() {
    return document.documentElement.lang;
  }
  get languages() {
    return this.#languages;
  }
  translatePage() {
    let elements = document.querySelectorAll('[data-i18n]');
    elements.forEach((element) => {
      const key = element.dataset.i18n;
      let i = 1;
      let parameter = [];
      while (element.hasAttribute(`data-i18n-${i}`)) {
        parameter.push(element.getAttribute(`data-i18n-${i}`));
        i++;
      }
      const t = this.translate(key, parameter);
      if (element.nodeName === 'INPUT' || element.nodeName === 'TEXTAREA')
        element.placeholder = t;
      else if (element.hasAttribute('title'))
        element.setAttribute('title', t);
      else
        element.innerHTML = t;
    });
  }
  translateElement(element, key, parameter) {
    element.setAttribute('data-i18n', key);
    if (parameter instanceof Array) {
      for (let i = 0; i < parameter.length; i++)
        element.setAttribute(`data-i18n-${i + 1}`, parameter[i]);
    } else if (parameter !== undefined)
      element.setAttribute('data-i18n-1', parameter);
    const t = this.translate(key, parameter);
    if (element.hasAttribute('title'))
      element.setAttribute('title', t);
    else
      element.innerHTML = t;
  }
  translate(key, parameter) {
    if (this.#dictionary === undefined)
      return '';
    if (key in this.#dictionary) {
      if (parameter === undefined)
        return this.#dictionary[key];
      if (parameter instanceof Array) {
        let translation = this.#dictionary[key];
        for (let i = 0; i < parameter.length; i++)
          translation = translation.replace('%' + (i + 1), parameter[i]);
        return translation;
      }
      return this.#dictionary[key].replace('%1', parameter);
    } else {
      console.error(`Missing translation for key "${key}" in language "${this.language}".`);
      return key;
    }
  }
}
export default Translator;
