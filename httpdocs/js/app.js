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
  
  if (window.localStorage.getItem('registered'))
    showPage('splash');
  else
    showPage('register');

  document.getElementById('register-family-name').addEventListener('input', validateRegistration);
  document.getElementById('register-given-names').addEventListener('input', validateRegistration);

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
            let xhttp = new XMLHttpRequest();
            xhttp.onreadystatechange = function() {
              if (this.readyState == 4 && this.status == 200) {
                const a = JSON.parse(this.responseText);
                const address = a.display_name;
                registerMarker.setPopupContent(address + '<br><br><center style="color:#999">(' +
                  citizen.latitude + ', ' + citizen.longitude + ')</center>').openPopup();
              }
            };
            xhttp.open('GET', 'https://nominatim.openstreetmap.org/reverse.php?format=json&lat=' + citizen.latitude +
              '&lon=' +
              citizen.longitude + '&zoom=20', true);
            xhttp.send();
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
          let xhttp = new XMLHttpRequest();
          xhttp.onreadystatechange = function() {
            if (this.readyState == 4 && this.status == 200 && geolocation == false) {
              let coords = this.responseText.split(',');
              getGeolocationPosition({
                coords: {
                  latitude: coords[0],
                  longitude: coords[1]
                }
              });
            }
          };
          xhttp.open('GET', 'https://ipinfo.io/loc', true);
          xhttp.send();
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

  // create a private key if needed
  let privateKey = localStorage.getItem('privateKey');
  let citizenCrypt = null;
  if (privateKey) {
    citizenCrypt = new JSEncrypt();
    citizenCrypt.setPrivateKey(privateKey);
    privateKeyAvailable('');
  } else createNewKey();

  // registering
  document.getElementById('register-button').addEventListener('click', function() {
    console.log("registering...");
    citizen.schema = 'https://directdemocracy.vote/json-schema/' + DIRECTDEMOCRACY_VERSION + '/citizen.schema.json';
    citizen.key = strippedKey(citizenCrypt.getPublicKey());
    citizen.published = new Date().getTime();
    citizen.familyName = document.getElementById('register-family-name').value.trim();
    citizen.givenNames = document.getElementById('register-given-names').value.trim();
    citizen.signature = '';
    citizen.signature = citizenCrypt.sign(JSON.stringify(citizen), CryptoJS.SHA256, 'sha256');
    let xhttp = new XMLHttpRequest();
    xhttp.onload = function() {
      if (this.status == 200) {
        let answer = JSON.parse(this.responseText);
        if (answer.error)
          app.dialog.alert(answer.error + '.<br>Please try again.', 'Publication Error');
        else {
          updateCitizenCard();
          app.dialog.alert('Your citizen card was just published.', 'Congratulation!');
          window.localStorage.setItem('registered', true);
        }
      }
    };
    xhttp.open('POST', publisher + '/publish.php', true);
    xhttp.send(JSON.stringify(citizen));
    return false;
  });

  function validateRegistration() {
    let button = document.getElementById('register-button');
    disable(button);
    if (document.getElementById('register-family-name').value.trim() === '')
      return;
    if (document.getElementById('register-given-names').value.trim() === '')
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
    enable(button);
  }

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

  function uploadPicture() {
    document.getElementById('register-picture-upload').click();
  }

  function privateKeyAvailable(message) {
    document.getElementById('register-button').innerHTML = 'Register';
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
    document.getElementById('citizen-family-name').innerHTML = citizen.familyName;
    document.getElementById('register-family-name').value = citizen.familyName;
    document.getElementById('citizen-given-names').innerHTML = citizen.givenNames;
    document.getElementById('register-given-names').value = citizen.givenNames;
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
    let xhttp = new XMLHttpRequest();
    xhttp.onload = function() {
      if (this.status == 200) {
        let reputation = document.getElementById('citizen-reputation');
        let answer = JSON.parse(this.responseText);
        let badge = document.getElementById('endorsed-badge');
        if (answer.error) {
          reputation.innerHTML = '<span style="font-weight:bold;color:red">' + answer.error + "</span>";
          badge.classList.remove('color-blue');
          badge.classList.add('color-red');
        } else {
          const color = answer.endorsed ? 'blue' : 'red';
          reputation.innerHTML = '<span style="font-weight:bold;color:' + color + '">' + answer.reputation +
            '</span>';
          badge.classList.remove('color-red');
          badge.classList.remove('color-blue');
          badge.classList.add('color-' + color);
        }
      }
    };
    xhttp.open('GET', trustee + '/reputation.php?key=' + encodeURIComponent(citizen.key), true);
    xhttp.send();
    let list = document.getElementById('citizen-endorsements-list');
    let badge = document.getElementById('endorsed-badge');
    if (citizenEndorsements.length == 0) {
      list.innerHTML =
        '<div class="block-title">Not endorsed</div>' +
        '<div class="block">You should ask other citizens to endorse you.</div>';
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
        `<span style="font-weight:bold">${endorsement.familyName}</span> <span>${endorsement.givenNames}</span>`);
      a.href = `${publisher}/citizen.html?fingerprint=${endorsement.fingerprint}&trustee=${encodeURIComponent(trustee)}`;
      a.target = '_blank';
      row = newElement(col, 'div', 'row');
      const t = new Date(endorsement.published).toISOString().slice(0, 10);
      newElement(row, 'div', 'col', (endorsement.revoke ? 'Revoked you on: ' : 'Endorsed you on: ') + t);
    });
  }
}
