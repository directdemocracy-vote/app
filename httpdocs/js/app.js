import QrScanner from './qr-scanner.min.js';
QrScanner.WORKER_PATH = 'js/qr-scanner-worker.min.js';

import Translator from 'https://directdemocracy.vote/js/translator.js';
let languagePicker;
let homePageIsReady = false;
let translatorIsReady = false;
let scanner = null;
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
    cols: [{
      textAlign: 'center',
      values: values
    }],
    renderToolbar: function () {
      return '<div class="toolbar"><div class="toolbar-inner"><div class="left"></div><div class="right">' +
        `<a class="link sheet-close popover-close" data-i18n="language-select">${translator.translate('language-select')}</a>` +
        '</div></div></div>';
    }
  });
  
  languagePicker.on('change', function(picker, value) {
    for (let key in translator.languages) {
      if (translator.languages[key] === value[0]) {
        if (translator.language !== key)
          translator.language = key;
        break;
      }
    }
  });
}

translator.onready = function() {
  translatorIsReady = true;
  if (!localStorage.getItem('privateKey'))
    document.getElementById('registration-button-message').innerHTML = translator.translate('please-wait-for-key');
  setupLanguagePicker();
}

let app = new Framework7({el: '#app', name: 'directdemocracy', routes: [{path: '/', pageName: 'home', options: {transition: 'f7-flip'}}, {path: '/info/', pageName: 'info', options: {transition: 'f7-flip'}}]});

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

app.on('pageAfterIn', function(page) {
  if (page.name !== 'home')
    return;
  addClass('tabbar-card', 'tab-link-active');
  removeClass('tabbar-endorse', 'tab-link-active');
  removeClass('tabbar-vote', 'tab-link-active');
  removeClass('tabbar-sign', 'tab-link-active');
  removeClass('tabbar-settings', 'tab-link-active');
  addClass('tab-card', 'tab-active');
  addClass('tab-card', 'swiper-slide-active');
  removeClass('tab-card', 'swiper-slide-next');
  removeClass('tab-card', 'swiper-slide-prev');
  removeClass('tab-endorse', 'tab-active');
  removeClass('tab-endorse', 'swiper-slide-active');
  addClass('tab-endorse', 'swiper-slide-next');
  removeClass('tab-endorse', 'swiper-slide-prev');
  removeClass('tab-vote', 'tab-active');
  removeClass('tab-vote', 'swiper-slide-active');
  removeClass('tab-vote', 'swiper-slide-next');
  removeClass('tab-vote', 'swiper-slide-prev');
  removeClass('tab-sign', 'tab-active');
  removeClass('tab-sign', 'swiper-slide-active');
  removeClass('tab-sign', 'swiper-slide-next');
  removeClass('tab-sign', 'swiper-slide-prev');
  removeClass('tab-settings', 'tab-active');
  removeClass('tab-settings', 'swiper-slide-active');
  removeClass('tab-settings', 'swiper-slide-next');
  removeClass('tab-settings', 'swiper-slide-prev');
});

let mainView = app.views.create('.view-main', {iosDynamicNavbar: false});

window.addEventListener('online', () => {
  disable('endorse-me-button');
});

window.addEventListener('offline', () => {
  enable('endorse-me-button');
});

window.onload = function() {
  const DIRECTDEMOCRACY_VERSION = '0.0.2';
  let citizen = {
    schema: '',
    key: '',
    signature: '',
    published: 0,
    givenNames: '',
    familyName: '',
    picture: '',
    latitude: 0,
    longitude: 0
  };
  let citizenCrypt = null;
  let citizenFingerprint = null;
  let citizenEndorsements = [];
  let endorsements = [];

  let publisher = localStorage.getItem('publisher');
  if (!publisher) {
    publisher = 'https://publisher.directdemocracy.vote';
    localStorage.setItem('publisher', publisher);
  }
  document.getElementById('publisher').value = publisher;
  document.getElementById('publisher').addEventListener('input', function(event) {
    publisher = event.target.value;
    localStorage.setItem('publisher', publisher);
  });
  let trustee = localStorage.getItem('trustee');
  if (!trustee) {
    trustee = 'https://trustee.directdemocracy.vote';
    localStorage.setItem('trustee', trustee);
  }
  document.getElementById('trustee').value = trustee;
  document.getElementById('trustee').addEventListener('input', function(event) {
    trustee = event.target.value;
    localStorage.setItem('trustee', trustee);
  });
  let station = localStorage.getItem('station');
  if (!station) {
    station = 'https://station.directdemocracy.vote';
    localStorage.setItem('station', station);
  }
  document.getElementById('station').value = station;
  document.getElementById('station').addEventListener('input', function(event) {
    station = event.target.value;
    localStorage.setItem('station', station);
  });

  // create a private key if needed
  let privateKey = localStorage.getItem('privateKey');
  if (privateKey) {
    citizenCrypt = new JSEncrypt();
    citizenCrypt.setPrivateKey(privateKey);
    privateKeyAvailable('');
  } else createNewKey();

  if (!window.localStorage.getItem('registered'))
    showPage('register');
  else {
    showPage('splash');
    fetch(`${publisher}/citizen.php`, {method: 'POST', headers: {"Content-Type": "application/x-www-form-urlencoded"}, body: 'key=' + encodeURIComponent(strippedKey(citizenCrypt.getPublicKey()))})
      .then((response) => response.json())
      .then((answer) => {
        if (answer.error)
          app.dialog.alert(answer.error + '.<br>Please try again.', 'Citizen Error');
        else {
          citizen = answer.citizen;
          citizen.key = strippedKey(citizenCrypt.getPublicKey());
          endorsements = answer.endorsements;
          if (endorsements.error)
            app.dialog.alert(endorsements.error, 'Citizen Endorsement Error');
          citizenEndorsements = answer.citizen_endorsements;
          updateCitizenCard();
          // FIXME
          // updateEndorsements();
          // updateArea();
        }
      })
      .catch((error) => {
        app.dialog.alert('Cannot connect to the publisher.<br>Please try again.', 'Citizen Error');
        console.error(error);
      });
  }
  document.getElementById('register-given-names').addEventListener('input', validateRegistration);
  document.getElementById('register-family-name').addEventListener('input', validateRegistration);

  // setting up the ID picture
  document.getElementById('register-upload-button').addEventListener('click', uploadPicture);
  document.getElementById('register-picture').addEventListener('click', uploadPicture);
  document.getElementById('register-picture-upload').addEventListener('change', function(event) {
    let content = {};
    content.innerHTML = `<div class="sheet-modal" style="height: 100%">
  <div class="toolbar">
    <div class="toolbar-inner">
      <div class="left" style="margin-left:16px">${translator.translate('adjust-photo')}</div>
      <div class="right">
        <a href="#" class="link sheet-close">${translator.translate('done-photo')}</a>
      </div>
    </div>
  </div>
  <div class="sheet-modal-inner">
    <div class="block margin-top-half no-padding-left no-padding-right">
      <p><img id="edit-picture"></p>
      <div class="row">
        <button class="col button" id="rotate-right"><i class="icon f7-icons">rotate_right_fill</i></button>
        <button class="col button" id="rotate-left"><i class="icon f7-icons">rotate_left_fill</i></button>
      </div>
    </div>
  </div>
</div>`;
    let croppie = null;
    let sheet = app.sheet.create({
      content: content.innerHTML,
      on: {
        opened: function() {
          let img = document.getElementById('edit-picture');
          img.src = URL.createObjectURL(event.target.files[0]);
          event.target.value = '';
          let w = screen.width * 0.95;
          croppie = new Croppie(img, {
            boundary: {
              width: w,
              height: w * 4 / 3
            },
            viewport: {
              width: w * 0.75,
              height: w * 0.75 * 4 / 3
            },
            enableOrientation: true,
            enableExif: true
          });
          document.getElementById('rotate-right').addEventListener('click', function() {
            croppie.rotate(-90);
          });
          document.getElementById('rotate-left').addEventListener('click', function() {
            croppie.rotate(90);
          });
        },
        close: function() {
          croppie.result({
            type: 'base64',
            size: {
              width: 150,
              height: 200
            },
            format: 'jpeg',
            quality: 0.95
          }).then(function(result) {
            document.getElementById('register-picture').setAttribute('src', result);
            citizen.picture = result;
            croppie.destroy();
            croppie = null;
            validateRegistration();
          });
        }
      }
    });
    sheet.open();
  });

  // setting-up the home location
  document.getElementById('register-location-button').addEventListener('click', function() {
    let content = {};
    content.innerHTML = `<div class="sheet-modal" style="height: 100%">
  <div class="toolbar">
    <div class="toolbar-inner">
      <div class="left" style="margin-left:16px">${translator.translate('select-home-location')}</div>
      <div class="right">
        <a href="#" class="link sheet-close">${translator.translate('done-home-location')}</a>
      </div>
    </div>
  </div>
  <div class="sheet-modal-inner">
    <div class="block margin-top-half no-padding-left no-padding-right">
      <div class="text-align-center" style="width:100%"><small>${translator.translate('zoom-home-location')}</small></div>
      <div id="register-map" style="width:100%;height:500px;margin-top:10px"></div>
    </div>
  </div>
</div>`;
    let sheet = app.sheet.create({
      content: content.innerHTML,
      on: {
        opened: function() {
          let geolocation = false;

          function updateLocation() {
            registerMarker.setPopupContent(citizen.latitude + ', ' + citizen.longitude).openPopup();
            fetch(`https://nominatim.openstreetmap.org/reverse.php?format=json&lat=${citizen.latitude}&lon=${citizen.longitude}&zoom=20`)
              .then((response) => response.json())
              .then((answer) => {
                registerMarker.setPopupContent(`${answer.display_name}<br><br><center style="color:#999">(${citizen.latitude}, ${citizen.longitude})</center>`).openPopup();
              })
              .catch((error) => {
                console.error(`Could not fetch address at ${citizen.latitude}, ${citizen.longitude}.`);
                console.error(error);
              });
          }

          function getGeolocationPosition(position) {
            geolocation = true;
            citizen.latitude = roundGeo(position.coords.latitude);
            citizen.longitude = roundGeo(position.coords.longitude);
            registerMap.setView([citizen.latitude, citizen.longitude], 12);
            setTimeout(function() {
              registerMarker.setLatLng([citizen.latitude, citizen.longitude]);
              updateLocation();
            }, 500);
          }

          function roundGeo(v) {
            return Math.round(v * 1000000) / 1000000;
          }
          if (navigator.geolocation)
            navigator.geolocation.getCurrentPosition(getGeolocationPosition);
          fetch(`https://ipinfo.io/loc`)
            .then((response) => {
              if (geolocation)
                return;
              const coords = response.split(',');
              getGeolocationPosition({coords: {latitude: coords[0], longitude: coords[1]}});
            })
            .catch((error) => {
              console.error(`Could not fetch latitude and longitude from https://ipinfo.io/loc.`);
              console.error(error);
            });
          let registerMap = L.map('register-map').setView([citizen.latitude, citizen.longitude], 2);
          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://openstreetmap.org/copyright">OpenStreetMap</a>'
          }).addTo(registerMap);
          registerMap.whenReady(function() {
            setTimeout(() => {
              this.invalidateSize();
            }, 0);
          });
          let registerMarker = L.marker([citizen.latitude, citizen.longitude]).addTo(registerMap)
            .bindPopup(citizen.latitude + ',' + citizen.longitude);
          let e = document.getElementById('register-map');
          const rect = e.getBoundingClientRect();
          const h = screen.height - rect.top;
          e.style.height = h + 'px';
          updateLocation();
          registerMap.on('contextmenu', function(event) {
            return false;
          });
          registerMap.on('click', function onMapClick(e) {
            citizen.latitude = roundGeo(e.latlng.lat);
            citizen.longitude = roundGeo(e.latlng.lng);
            registerMarker.setLatLng([citizen.latitude, citizen.longitude]);
            updateLocation();
          });
        },
        close: function() {
          document.getElementById('register-location').value = citizen.latitude + ', ' + citizen.longitude;
          validateRegistration();
        }
      }
    });
    sheet.open();
  });

  document.getElementById('register-adult').addEventListener('input', validateRegistration);
  document.getElementById('register-confirm').addEventListener('input', validateRegistration);

  // registering
  document.getElementById('register-button').addEventListener('click', function(event) {
    let text = document.getElementById('register-button-text');
    const registration = 'registration';
    text.innerHTML = translator.translate(registration);
    text.setAttribute('data-i18n', registration);
    show('register-button-preloader');
    disable(event.currentTarget);
    citizen.schema = 'https://directdemocracy.vote/json-schema/' + DIRECTDEMOCRACY_VERSION + '/citizen.schema.json';
    citizen.key = strippedKey(citizenCrypt.getPublicKey());
    citizen.published = new Date().getTime();
    citizen.givenNames = document.getElementById('register-given-names').value.trim();
    citizen.familyName = document.getElementById('register-family-name').value.trim();
    citizen.signature = '';
    citizen.signature = citizenCrypt.sign(JSON.stringify(citizen), CryptoJS.SHA256, 'sha256');
    fetch(`${publisher}/publish.php`, {method: 'POST', headers: {"Content-Type": "application/json"}, body: JSON.stringify(citizen)})
      .then((response) => response.json())
      .then((answer) => {
        if (answer.error)
          app.dialog.alert(`${answer.error}<br>Please try again.`, 'Publication Error');
        else {
          updateCitizenCard();
          app.dialog.alert(translator.translate('citizen-card-published'), translator.translate('congratulations'));
          window.localStorage.setItem('registered', true);
        }
      })
      .catch((error) => {
        console.error(`Could publish citizen card.`);
        console.error(error);
      });
    return false;
  });


  const video = document.getElementById('test-video');
  video.addEventListener('loadedmetadata', function() {
    console.log('video: ' + this.videoWidth + 'x' + this.videoHeight);
    console.log('app: ' + app.width + "x" + app.height);
    if (this.videoWidth > this.videoHeight) {
      const ratio = this.videoWidth / this.videoHeight;
      const width = app.width * ratio;
      this.style.width = width + 'px';
      const margin = Math.round((app.width - width) / 2);
      this.style.marginLeft = margin + 'px';
      this.style.marginRight = margin + 'px';
      this.style.marginTop = '';
      this.style.marginBottom = '';
    } else {
      const margin = Math.round(-10000 * (this.videoHeight - this.videoWidth) / (2 * this.videoWidth)) / 100.0;
      this.style.width = '100%';
      this.style.marginTop = margin + '%';
      this.style.marginBottom = margin + '%';
      this.style.marginLeft = '';
      this.style.marginRight = '';
    }
  });

/*
  const video = document.getElementById('endorse-me-video');
  document.getElementById('endorse-me-video').addEventListener('loadedmetadata', qrVideo);

  function qrVideo() { // display video as a square centered in the video rectangle
    console.log('video: ' + this.videoWidth + 'x' + this.videoHeight);
    console.log('app: ' + app.width + "x" + app.height);
    if (this.videoWidth > this.videoHeight) {
      const ratio = this.videoWidth / this.videoHeight;
      const width = app.width * ratio;
      this.style.width = width + 'px';
      const margin = Math.round((app.width - width) / 2);
      this.style.marginLeft = margin + 'px';
      this.style.marginRight = margin + 'px'; 
    } else {
      const margin = Math.round(-10000 * (this.videoHeight - this.videoWidth) / (2 * this.videoWidth)) / 100.0;
      this.style.width = '100%';
      this.style.marginTop = margin + '%';
      this.style.marginBottom = margin + '%';
    }
    
    if (this.videoWidth > this.videoHeight) {
      const margin = Math.round(-10000 * (this.videoWidth - this.videoHeight) / this.videoWidth) / 100.0;
      const size = -2 * margin + 100;
      this.style.width = size + '%';
      this.style.marginLeft = margin + '%';
      this.style.marginRight = margin + '%';
    } else {
      const margin = Math.round(-10000 * (this.videoHeight - this.videoWidth) / (2 * this.videoWidth)) / 100.0;
      this.style.width = '100%';
      this.style.marginTop = margin + '%';
      this.style.marginBottom = margin + '%';
    }
    
  }
*/
  scanner = new QrScanner(video, function(value) {
    scanner.stop();
    showPage('card');
    console.log(value);
  });

  document.getElementById('endorse-me-button').addEventListener('click', function(event) {
    showPage('endorse-me');
    scanner.start();
  });

  document.getElementById('cancel-endorse-me-button').addEventListener('click', function(event) {
    scanner.stop();
    showPage('card');
  });
  
  document.getElementById('endorse-button').addEventListener('click', function(event) {
    app.dialog.create({
      title: '<i class="icon f7-icons margin-right" style="rotate:-45deg;">airplane</i>Airplane mode?',
      text: 'Please check that the phone of the citizen you are endorsing is set in airplane mode.',
      buttons: [{text: 'Confirm', onClick: function() {
        const randomBytes = new Uint8Array(20);
        crypto.getRandomValues(randomBytes);
        let randomString = '', hex = '0123456789abcdef';
        randomBytes.forEach((v) => { randomString += hex[v >> 4] + hex[v & 15]; });
        console.log(randomString);
        let image = document.createElement('img');
        let qr = new QRious({
          element: image,
          value: randomString,
          level: 'M',
          size: 512,
          padding: 0
        });
        image.style.width = '100%';
        image.style.height = '100%';
        image.classList.add('margin-top');
        app.dialog.create({
          title: 'Ask the citizen to scan this QR-code',
          content: image.outerHTML,
          buttons: [{text: 'Done'}, {text: 'Cancel'}]
        }).open();
      }}, {text: 'Cancel'}]
    }).open();
  });

  function validateRegistration() {
    disable('register-button');
    if (document.getElementById('register-given-names').value.trim() === '')
      return;
    if (document.getElementById('register-family-name').value.trim() === '')
      return;
    if (document.getElementById('register-picture').src === 'https://app.directdemocracy.vote/images/default-picture.png')
      return;
    if (document.getElementById('register-location').value === '')
      return;
    if (!document.getElementById('register-adult').checked)
      return;
    if (!document.getElementById('register-confirm').checked)
      return;
    if (!localStorage.getItem('privateKey'))
      return;
    enable('register-button');
  }

  // show either:
  // 1. the register page when the citizen has not yet registered
  // 2. the splash page when downloading registered citizen data
  // 3. the card page once registered citizen data is available
  // 4. the video scan page to get endorsed
  function showPage(page) {
    const pages = ['splash', 'register', 'card', 'endorse-me'];
    if (!pages.includes(page)) {
      console.error(`Page '${page}' not found`);
      return;
    }
    show(`${page}-page`);
    pages.forEach(function(p) {
      if (p !== page)
        hide(`${p}-page`);
    });
    const cards = ['endorse', 'vote', 'sign'];
    cards.forEach(function(i) {
      const tabbar = `tabbar-${i}`;
      if (page === 'card')
        enable(tabbar);
      else
        disable(tabbar);
    });
  }
  
  function uploadPicture() {
    document.getElementById('register-picture-upload').click();
  }

  function privateKeyAvailable(message) {
    const register = 'register';
    let text = document.getElementById('register-button-text');
    text.innerHTML = translator.translate(register);
    text.setAttribute('data-i18n', register);
    hide('register-button-preloader');
    document.getElementById('registration-button-message').innerHTML = message;
    validateRegistration();
  }

  function createNewKey() {
    let dt = new Date();
    let time = -(dt.getTime());
    citizenCrypt = new JSEncrypt({
      default_key_size: 2048
    });
    citizenCrypt.getKey(function() {
      dt = new Date();
      time += (dt.getTime());
      privateKey = citizenCrypt.getPrivateKey();
      localStorage.setItem('privateKey', privateKey);
      const n = Number(time / 1000).toFixed(2);
      privateKeyAvailable(translator.translate('key-forge-time', n));
    });
  }
  
  function strippedKey(publicKey) {
    let stripped = '';
    const header = '-----BEGIN PUBLIC KEY-----\n'.length;
    const footer = '-----END PUBLIC KEY-----'.length;
    const l = publicKey.length - footer;
    for (let i = header; i < l; i += 65)
      stripped += publicKey.substr(i, 64);
    stripped = stripped.slice(0, -1 - footer);
    return stripped;
  }

  function updateCitizenCard() {
    showPage('card');
    document.getElementById('citizen-picture').setAttribute('src', citizen.picture);
    document.getElementById('register-picture').setAttribute('src', citizen.picture);
    document.getElementById('citizen-given-names').innerHTML = citizen.givenNames;
    document.getElementById('register-given-names').value = citizen.givenNames;
    document.getElementById('citizen-family-name').innerHTML = citizen.familyName;
    document.getElementById('register-family-name').value = citizen.familyName;
    document.getElementById('citizen-coords').innerHTML =
      '<a class="link external" target="_blank" href="https://openstreetmap.org/?mlat=' +
      citizen.latitude + '&mlon=' + citizen.longitude + '&zoom=12">' +
      citizen.latitude + ', ' + citizen.longitude + '</a>';
    document.getElementById('register-location').value = citizen.latitude + ', ' + citizen.longitude;
    let published = new Date(citizen.published);
    document.getElementById('citizen-published').innerHTML = published.toISOString().slice(0, 10);
    citizenFingerprint = CryptoJS.SHA1(citizen.signature).toString();
    let qrImage = document.getElementById('citizen-qr-code');
    const rect = qrImage.getBoundingClientRect();
    const rect2 = document.getElementById('tabbar').getBoundingClientRect();
    const height = rect2.top - rect.top;
    const width = screen.width - 30;
    const size = width > height ? height : width;
    let qr = new QRious({
      element: qrImage,
      value: citizenFingerprint,
      level: 'M',
      size,
      padding: 0
    });
    // get reputation from trustee
    fetch(`${trustee}/reputation.php?key=${encodeURIComponent(citizen.key)}`)
      .then((response) => response.json())
      .then((answer) => {
        let reputation = document.getElementById('citizen-reputation');
        let badge = document.getElementById('endorsed-badge');
        if (answer.error) {
          reputation.innerHTML = `<span style="font-weight:bold;color:red">${answer.error}</span>`;
          badge.classList.remove('color-blue');
          badge.classList.add('color-red');
        } else {
          const color = answer.endorsed ? 'blue' : 'red';
          reputation.innerHTML = `<span style="font-weight:bold;color:${color}">${answer.reputation}</span>`;
          badge.classList.remove('color-red');
          badge.classList.remove('color-blue');
          badge.classList.add('color-' + color);
        }
      })
      .catch((error) => {
        console.error('Could not publish citizen card.');
        console.error(error);
      });
    let list = document.getElementById('citizen-endorsements-list');
    let badge = document.getElementById('endorsed-badge');
    if (citizenEndorsements.length == 0) {
      list.innerHTML =
        `<div class="block-title" data-i18n="not-endorsed">${translator.translate('not-endorsed')}</div>` +
        `<div class="block" data-i18n="ask-others-to-endorse-you">${translator.translate('ask-others-to-endorse-you')}</div>`;
      badge.style.background = 'red';
      badge.innerHTML = '0';
      return;
    }
    let revokeCount = 0;
    citizenEndorsements.forEach(function(endorsement) {
      if (endorsement.revoke)
        revokeCount++;
    });
    let endorsementCount = citizenEndorsements.length - revokeCount;
    badge.innerHTML = endorsementCount;
    const plural = (citizenEndorsements.length > 1) ? 'endorsements' : 'endorsement';
    let title = newElement(list, 'div', 'block-title', endorsementCount + '/' + citizenEndorsements.length + ' ' +
      plural);
    citizenEndorsements.forEach(function(endorsement) {
      let card = newElement(list, 'div', 'card');
      if (endorsement.revoke)
        card.classList.add('revoked');
      let content = newElement(card, 'div', 'card-content card-content-padding');
      let row = newElement(content, 'div', 'row');
      let col = newElement(row, 'div', 'col-25');
      let img = newElement(col, 'img');
      img.src = endorsement.picture;
      img.style.width = '100%';
      col = newElement(row, 'div', 'col-75');
      let a = newElement(col, 'a', 'link external',
        `<span style="font-weight:bold">${endorsement.givenNames}</span> <span>${endorsement.familyName}</span>`);
      a.href = `${publisher}/citizen.html?fingerprint=${endorsement.fingerprint}&trustee=${encodeURIComponent(trustee)}`;
      a.target = '_blank';
      row = newElement(col, 'div', 'row');
      const t = new Date(endorsement.published).toISOString().slice(0, 10);
      newElement(row, 'div', 'col', (endorsement.revoke ? 'Revoked you on: ' : 'Endorsed you on: ') + t);
    });
  }
}

function removeClass(item, className) {
  let i = (typeof item === 'string') ? document.getElementById(item) : item;
  i.classList.remove(className);
}

function addClass(item, className) {
  let i = (typeof item === 'string') ? document.getElementById(item) : item;
  if (i.classList.contains(className))
    return;
  i.classList.add(className);
}

function enable(item) {
  removeClass(item, 'disabled');
}

function disable(item) {
  addClass(item, 'disabled');
}

function show(item) {
  removeClass(item, 'display-none');
}

function hide(item) {
  addClass(item, 'display-none');
}
