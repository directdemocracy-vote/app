import QrScanner from './qr-scanner.min.js';

import Translator from 'https://directdemocracy.vote/js/translator.js';

/* This doesn't work on Android/firefox, should be implemented with Cordova
if (typeof screen.orientation.lock === 'function')
  screen.orientation.lock('portrait-primary')
    .then(() => {
      console.log('Locked screen to portrait orientation.');
    })
    .catch((error) => {
      console.log('Cannot lock screen to portrait orientation.');
    });
else {
  screen.lockOrientationUniversal = screen.lockOrientation || screen.mozLockOrientation || screen.msLockOrientation;
  if (!screen.lockOrientationUniversal('portrait-primary')) {
    console.log('Failed to lock screen to portrait orientation.');
  }
}
*/

let languagePicker;
let homePageIsReady = false;
let translatorIsReady = false;
let challengeScanner = null;
let challenge = '';
let answerScanner = null;
let petitionScanner = null;
let referendumScanner = null;
let translator = new Translator('i18n');
const DIRECTDEMOCRACY_VERSION = '2';
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
let notary = sanitizeWebservice(localStorage.getItem('notary'));
if (!notary) {
  notary = 'https://notary.directdemocracy.vote';
  localStorage.setItem('notary', notary);
}
let judge = sanitizeWebservice(localStorage.getItem('judge'));
if (!judge) {
  judge = 'https://judge.directdemocracy.vote';
  localStorage.setItem('judge', judge);
}
let station = sanitizeWebservice(localStorage.getItem('station'));
if (!station) {
  station = 'https://station.directdemocracy.vote';
  localStorage.setItem('station', station);
}
let iAmEndorsedByJudge = false;
let endorsed = null;
let endorseMap = null;
let endorseMarker = null;
let online = true;
let petitions = [];
let referendums = [];

function sanitizeString(string) {
  if (!string)
    return;
  string = string.replaceAll('&', '&amp;');
  string = string.replaceAll("'", '&apos;');
  string = string.replaceAll('"', '&quot;');
  string = string.replaceAll('<', '&lt;');
  string = string.replaceAll('>', '&gt;');
  return string;
}

function sanitizeWebservice(string) {
  if (!string)
    return '';
  string = string.replace(/[^a-z0-9-\:\.\/]/gi, '');
  return string;
}

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
        if (translator.language !== key) {
          translator.language = key;
          updateProposalLink();
        }
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

let app = new Framework7({el: '#app', name: 'directdemocracy', routes: [{path: '/', pageName: 'home'} ]});

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

window.addEventListener('online', () => {
  online = true;
  disable('endorse-me-button');
  downloadCitizen();
  getReputationFromJudge();
});

window.addEventListener('offline', () => {
  online = false;
  enable('endorse-me-button');
});

window.onload = function() {
  setNotary();
  document.getElementById('notary').addEventListener('input', function(event) {
    notary = sanitizeWebservice(event.target.value);
    setNotary();
  });
  document.getElementById('judge').value = judge;
  document.getElementById('judge').addEventListener('input', function(event) {
    judge = sanitizeWebservice(event.target.value);
    localStorage.setItem('judge', judge);
  });
  document.getElementById('station').value = station;
  document.getElementById('station').addEventListener('input', function(event) {
    station = sanitizeWebservice(event.target.value);
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
    downloadCitizen();
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
    disable('register-location-button');
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
            .then((response) => response.text())
            .then((answer) => {
              if (geolocation)
                return;
              const coords = answer.split(',');
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
          enable('register-location-button');
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
    disable('register-button');
    let text = document.getElementById('register-button-text');
    const registration = 'registration';
    text.innerHTML = translator.translate(registration);
    text.setAttribute('data-i18n', registration);
    show('register-button-preloader');
    citizen.schema = 'https://directdemocracy.vote/json-schema/' + DIRECTDEMOCRACY_VERSION + '/citizen.schema.json';
    citizen.key = strippedKey(citizenCrypt.getPublicKey());
    citizen.published = Math.trunc(new Date().getTime() / 1000);
    citizen.givenNames = sanitizeString(document.getElementById('register-given-names').value.trim());
    citizen.familyName = sanitizeString(document.getElementById('register-family-name').value.trim());
    citizen.signature = '';
    citizen.signature = citizenCrypt.sign(JSON.stringify(citizen), CryptoJS.SHA256, 'sha256');
    citizenFingerprint = CryptoJS.SHA1(CryptoJS.enc.Base64.parse(citizen.signature));
    fetch(`${notary}/api/publish.php`, {method: 'POST', headers: {"Content-Type": "application/json"}, body: JSON.stringify(citizen)})
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
        console.error(`Could not publish citizen card.`);
        console.error(error);
      });
    return false;
  });

  const challengeVideo = document.getElementById('challenge-video');
  challengeVideo.addEventListener('loadedmetadata', qrVideo);

  function qrVideo() { // display video as a square centered in the video rectangle
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

  challengeScanner = new QrScanner(challengeVideo, function(value) {
    challengeScanner.stop();
    showPage('card');
    let challenge = '';
    for(let i=0; i < 20; i++)
      challenge += String.fromCharCode(value.bytes[i]);
    const signature = atob(citizenCrypt.sign(challenge, CryptoJS.SHA256, 'sha256'));
    let fingerprint = '';
    const words = citizenFingerprint.words;
    for(let i = 0; i < 5; ++i)
      for(let j = 3; j >= 0; --j)
        fingerprint += String.fromCharCode((words[i] >> 8 * j) & 0xff);
    const qr = new QRious({
      value: fingerprint + signature,  // 276 bytes, e.g., 20 + 256
      level: 'L',
      size: 1024,
      padding: 0
    });
    const airplaneRotation = (app.device.android) ? ' style="rotate:-90deg;"' : '';
    const airplane = `<i class="icon f7-icons margin-right"${airplaneRotation}>airplane</i>`;
    app.dialog.create({
      title: 'Ask the citizen to scan this QR-code',
      content: `<img src="${qr.toDataURL()}" class="margin-top" style="width:100%;height:100%">`,
      buttons: [{text: 'Done', onClick: function() {
        app.dialog.alert('You can now safely disable the airplane mode.', `${airplane}Airplane mode`);
        if (!online)
          enable('endorse-me-button');
      }}]
    }).open();
  }, {returnDetailedScanResult: true});

  document.getElementById('endorse-me-button').addEventListener('click', function() {
    disable('endorse-me-button');
    showPage('endorse-me');
    challengeScanner.start();
  });

  document.getElementById('cancel-endorse-me-button').addEventListener('click', function() {
    challengeScanner.stop();
    showPage('card');
    if (!online)
      enable('endorse-me-button');
  });

  document.getElementById('endorse-button').addEventListener('click', function() {
    disable('endorse-button');
    app.dialog.create({
      title: '<i class="icon f7-icons margin-right" style="rotate:-45deg;">airplane</i>Airplane mode?',
      text: 'Please check that the phone of the citizen you are endorsing is set in airplane mode.',
      buttons: [{text: 'Confirm', onClick: function() {
        const randomBytes = new Uint8Array(20);
        crypto.getRandomValues(randomBytes);
        challenge = '';
        randomBytes.forEach((v) => { challenge += String.fromCharCode(v); });
        const qr = new QRious({
          value: challenge,
          level: 'L',
          size: 512,
          padding: 0
        });
        app.dialog.create({
          title: 'Ask the citizen to scan this QR-code',
          content: `<img src="${qr.toDataURL()}" class="margin-top" style="width:100%;height:100%">`,
          buttons: [{text: 'Done', onClick: function() {
            hide('endorse-page');
            show('endorse-scanner');
            answerScanner.start();
          }}]
        }).open();
      }}, {text: 'Cancel', onClick: function() {
        enable('endorse-button');
      }}]
    }).open();
  });

  const answerVideo = document.getElementById('answer-video');
  answerVideo.addEventListener('loadedmetadata', qrVideo);

  answerScanner = new QrScanner(answerVideo, function(value) {
    answerScanner.stop();
    hide('endorse-scanner');
    show('endorse-page');
    let fingerprint = '';
    const hex = '0123456789abcdef';
    for(let i=0; i < 20; i++) {
      const b = value.bytes[i];
      fingerprint += hex[b >> 4] + hex[b & 15];
    }
    let binarySignature = '';
    for(let i=20; i < 276; i++)
      binarySignature += String.fromCharCode(value.bytes[i]);
    const signature = btoa(binarySignature);
    // get endorsee from fingerprint
    fetch(`${notary}/api/publication.php?fingerprint=${fingerprint}`)
      .then((response) => response.text())
      .then((answer) => {
        endorsed = JSON.parse(answer);
        if (endorsed.hasOwnProperty('error')) {
          app.dialog.alert(endorsed.error, 'Error getting citizen from notary');
          enable('endorse-button');
          return;
        }
        // verify signature of endorsed
        let endorsedSignature = endorsed.signature;
        endorsed.signature = '';
        let verify = new JSEncrypt();
        verify.setPublicKey(publicKey(endorsed.key));
        if (!verify.verify(challenge, signature, CryptoJS.SHA256)) {
          app.dialog.alert('Cannot verify challenge signature', 'Error verifying challenge');
          enable('endorse-button');
          return;
        }
        if (!verify.verify(JSON.stringify(endorsed), endorsedSignature, CryptoJS.SHA256)) {
          app.dialog.alert('Cannot verify citizen signature', 'Error verifying signature');
          enable('endorse-button');
          return;
        }
        endorsed.signature = endorsedSignature;
        hide('endorse-page');
        show('endorse-citizen');
        document.getElementById('endorse-picture-check').checked = false;
        document.getElementById('endorse-name-check').checked = false;
        document.getElementById('endorse-adult-check').checked = false;
        document.getElementById('endorse-coords-check').checked = false;
        document.getElementById('endorse-citizen').style.display = '';
        document.getElementById('endorse-picture').src = endorsed.picture;
        document.getElementById('endorse-family-name').innerHTML = endorsed.familyName;
        document.getElementById('endorse-given-names').innerHTML = endorsed.givenNames;
        const lat = endorsed.latitude;
        const lon = endorsed.longitude;
        document.getElementById('endorse-coords').innerHTML = lat + ', ' + lon;
        let published = new Date(endorsed.published * 1000);
        document.getElementById('endorse-published').innerHTML = published.toISOString().slice(0, 10);
        if (endorseMap == null) {
          endorseMap = L.map('endorse-map', {dragging: false});
          endorseMap.whenReady(function() {setTimeout(() => {this.invalidateSize();}, 0);});
          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://openstreetmap.org/copyright">OpenStreetMap</a>'
          }).addTo(endorseMap);
          endorseMarker = L.marker([lat, lon]).addTo(endorseMap);
        } else
          endorseMarker.setLatLng([lat, lon]);
        endorseMarker.bindPopup(lat + ', ' + lon);
        endorseMap.setView([lat, lon], 18);
        endorseMap.on('contextmenu', function(event) {
          return false;
        });
        fetch(`https://nominatim.openstreetmap.org/reverse.php?format=json&lat=${lat}&lon=${lon}&zoom=10`)
          .then((response) => response.json())
          .then((answer) => {
            const address = answer.display_name;
            endorseMarker.setPopupContent(address + '<br><br><center style="color:#999">' + `(${lat}, ${lon})` + '</center>').openPopup();
          });
      });
  },{returnDetailedScanResult: true});

  document.getElementById('endorse-picture-check').addEventListener('change', updateEndorseConfirm);
  document.getElementById('endorse-name-check').addEventListener('change', updateEndorseConfirm);
  document.getElementById('endorse-adult-check').addEventListener('change', updateEndorseConfirm);
  document.getElementById('endorse-coords-check').addEventListener('change', updateEndorseConfirm);

  document.getElementById('cancel-endorse-button').addEventListener('click', function() {
    answerScanner.stop();
    hide('endorse-scanner');
    show('endorse-page');
    enable('endorse-button');
  });

  document.getElementById('endorse-cancel-confirm').addEventListener('click', function() {
    hide('endorse-citizen');
    show('endorse-page');
    enable('endorse-button');
  });

  document.getElementById('endorse-confirm').addEventListener('click', function() {
    hide('endorse-citizen');
    show('endorse-page');
    let endorsement = {
      schema: 'https://directdemocracy.vote/json-schema/' + DIRECTDEMOCRACY_VERSION + '/endorsement.schema.json',
      key: citizen.key,
      signature: '',
      published: Math.trunc(new Date().getTime() / 1000),
      endorsedSignature: endorsed.signature
    };
    endorsement.signature = citizenCrypt.sign(JSON.stringify(endorsement), CryptoJS.SHA256, 'sha256');
    fetch(`${notary}/api/publish.php`, {method: 'POST', headers: {"Content-Type": "application/json"}, body: JSON.stringify(endorsement)})
      .then((response) => response.json())
      .then((answer) => {
        if (answer.error)
          app.dialog.alert(`${answer.error}<br>Please try again.`, 'Publication Error');
        else {
          app.dialog.alert(`You successfully endorsed ${endorsed.givenNames} ${endorsed.familyName}`, 'Endorsement Success');
          // FIXME: we should actually add the new endorsee in the endorsements list
          updateEndorsements();
        }
        enable('endorse-button');
      })
      .catch((error) => {
        console.error(`Could publish citizen card.`);
        console.error(error);
      });
  });

  const referendumVideo = document.getElementById('referendum-video');
  referendumVideo.addEventListener('loadedmetadata', qrVideo);
  referendumScanner = new QrScanner(referendumVideo, scanProposal, {returnDetailedScanResult: true});

  const petitionVideo = document.getElementById('petition-video');
  petitionVideo.addEventListener('loadedmetadata', qrVideo);
  petitionScanner = new QrScanner(petitionVideo, scanProposal, {returnDetailedScanResult: true});

  document.getElementById('scan-referendum').addEventListener('click', function() {
    hide('referendum-page');
    show('referendum-scanner');
    disable('scan-referendum');
    disable('enter-referendum');
    referendumScanner.start();
  });

  document.getElementById('scan-petition').addEventListener('click', function() {
    hide('petition-page');
    show('petition-scanner');
    disable('scan-petition');
    disable('enter-petition');
    petitionScanner.start();
  });

  let referendumSearch = document.getElementById('enter-referendum');
  referendumSearch.addEventListener('keyup', function(event) {
    if (event.key === 'Enter')
      searchProposal('referendum');
  });
  referendumSearch.addEventListener('paste', function(event) {
    event.preventDefault();
    document.getElementById('enter-referendum').value = (event.clipboardData || window.clipboardData).getData("text");
    searchProposal('referendum');
  });

  let petitionSearch = document.getElementById('enter-petition');
  petitionSearch.addEventListener('keyup', function(event) {
    if (event.key === 'Enter')
      searchProposal('petition');
  });
  petitionSearch.addEventListener('paste', function(event) {
    event.preventDefault();
    document.getElementById('enter-petition').value = (event.clipboardData || window.clipboardData).getData("text");
    searchProposal('petition');
  });

  function updateEndorseConfirm(event) {
    disable('endorse-confirm');
    if (!document.getElementById('endorse-picture-check').checked)
      return;
    if (!document.getElementById('endorse-name-check').checked)
      return;
    if (!document.getElementById('endorse-adult-check').checked)
      return;
    if (!document.getElementById('endorse-coords-check').checked)
      return;
    enable('endorse-confirm');
  }

  function setNotary() {
    localStorage.setItem('notary', notary);
    document.getElementById('notary').value = notary;
    updateSearchLinks();
    updateProposalLink();
  }

  function searchProposal(type) {
    disable(`scan-${type}`);
    disable(`enter-${type}`);
    let value = document.getElementById(`enter-${type}`).value;
    if (value.length === 40)
      getProposal(value, type);
    else {
      enable(`scan-${type}`);
      enable(`enter-${type}`);
    }
  }

  document.getElementById('cancel-scan-referendum-button').addEventListener('click', function() {
    referendumScanner.stop();
    hide('referendum-scanner');
    show('referendum-page');
    enable('scan-referendum');
    enable('enter-referendum');
  });

  document.getElementById('cancel-scan-petition-button').addEventListener('click', function() {
    petitionScanner.stop();
    hide('petition-scanner');
    show('petition-page');
    enable('scan-petition');
    enable('enter-petition');
  });

  referendums = JSON.parse(localStorage.getItem('referendums'));
  if (referendums == null)
  referendums = [];
  referendums.forEach(function(referendum) {
    if (referendum.id !== undefined)
      addProposal(referendum, 'referendum', false);
  });

  petitions = JSON.parse(localStorage.getItem('petitions'));
  if (petitions == null)
    petitions = [];
  petitions.forEach(function(petition) {
    if (petition.id !== undefined)
      addProposal(petition, 'petition', false);
  });

  function scanProposal(value) {
    const type = (this === petitionScanner) ? 'petition' : 'referendum';
    this.stop();
    hide(`${type}-scanner`);
    show(`${type}-page`);
    let fingerprint = '';
    const hex = '0123456789abcdef';
    for(let i=0; i < 20; i++) {
      const b = value.bytes[i];
      fingerprint += hex[b >> 4] + hex[b & 15];
    }
    getProposal(fingerprint, type);
  }

  function getProposal(fingerprint, type) {
    fetch(`${notary}/api/proposal.php?fingerprint=${fingerprint}&latitude=${citizen.latitude}&longitude=${citizen.longitude}`)
      .then((response) => response.json())
      .then((proposal) => {
        if (proposal.error) {
          console.error(`Proposal error: ${proposal.error}`);
          return;
        }
        if (!verifyProposalSignature(proposal))
          return;
        const outdated = (proposal.deadline * 1000 < new Date().getTime());
        const deadline = new Date(proposal.deadline * 1000).toLocaleString();
        const title = `<b>${proposal.title}</b><br><br>`;
        if (type === 'petition' && proposal.secret)
          app.dialog.alert(`${title}This proposal is a referendum, not a petition, please scan it from the <b>Vote</b> tab`, 'Not a petition');
        else if (type === 'referendum' && !proposal.secret)
          app.dialog.alert(`${title}This proposal is a petition, not a referendum, please scan it from the <b>Sign</b> tab`, 'Not a referendum');
        else if (!proposal.inside) {
          const message = (type === 'petition')
                        ? `You are not inside the area of this petition (which is <i>${proposal.areas[0].split('=')[1]}</i>). Therefore you cannot sign it.`
                        : `You are not inside the area of this referendum (which is <i>${proposal.areas[0].split('=')[1]}</i>). Therefore you cannot vote.`;
          app.dialog.alert(`${title}${message}`, 'Wrong area');
        } else if (outdated) {
          const message = (type === 'petition')
                        ? `The deadline for signing this petition has passed. It was ${deadline}. Therefore you cannot sign it.`
                        : `The deadline for voting at this referendum has passed. It was ${deadline}. Therefore you cannot vote.`;
          app.dialog.alert(`${title}${message}`, 'Deadline expired');
        } else {
          let already = false;
          let proposals = (type === 'petition') ? petitions : referendums;
          for (let p of proposals) {
            if (CryptoJS.SHA1(CryptoJS.enc.Base64.parse(p.signature)) == fingerprint) {
              if (p.id !== undefined) {
                app.dialog.alert(`${title}You already have this ${type}.`);
                app.accordion.open(document.getElementById(`${type}-${p.id}`));
              } else { // already there, insert at position 0 and reset the missing fields
                p.id = 0;
                let i = 0;
                for(let p2 of proposals)
                  p2.id = i++;
                p.title = proposal.title;
                p.description = proposal.description;
                p.areas = proposal.areas;
                p.deadline = proposal.deadline;
                p.corpus = proposal.corpus;
                p.participation = proposal.participation;
                p.published = proposal.published;
                p.judge = proposal.judge;
                if (proposal.answers !== '')
                  p.answers = proposal.answers;
                if (proposal.question !== '')
                  p.question = proposal.question;
                if (proposal.website !== '')
                  p.website = proposal.website;
                addProposal(p, type, true);
                localStorage.setItem(`${type}s`, JSON.stringify(proposals));
              }
              already = true;
              break;
            }
          }
          if (!already) {
            // move proposals id by one
            let i = 1;
            proposals.forEach(function(p) {
              let e = document.getElementById(`${type}-${p.id}`);
              p.id = i++;
              e.setAttribute('id', p.id);
            });
            delete proposal.schema;
            delete proposal.key;
            delete proposal.inside;
            if (proposal.question === '')
              delete proposal.question;
            if (proposal.answers === '')
              delete proposal.answers;
            if (proposal.website === '')
              delete proposal.website;
            // preprend new proposal at id 0
            proposal.id = 0;
            proposal.done = false;
            proposals.unshift(proposal);
            addProposal(proposal, type, true);
            localStorage.setItem(`${type}s`, JSON.stringify(proposals));
          }
        }
        enable(`scan-${type}`);
        enable(`enter-${type}`);
      });
  }

  function verifyProposalSignature(proposal) {
    let signature = proposal.signature;
    let p = {
      'schema': proposal.schema,
      'key': proposal.key,
      'signature': '',
      'published': proposal.published,
      'judge': proposal.judge,
      'area': proposal.area,
      'title': proposal.title,
      'description': proposal.description
    };
    if (proposal.question)
      p['question'] = proposal.question;
    if (proposal.answers)
      p['answers'] = proposal.answers;
    p['secret'] = proposal.secret;
    p['deadline'] = proposal.deadline;
    if (p.website)
      p['website'] = proposal.website;
    let verify = new JSEncrypt();
    verify.setPublicKey(publicKey(proposal.key));
    if (!verify.verify(JSON.stringify(p), proposal.signature, CryptoJS.SHA256)) {
      app.dialog.alert('Cannot verify the signature of this proposal.', 'Wrong proposal signature');
      return false;
    }
    return true;
  }

  function addProposal(proposal, type, open) {
    let proposals = (type === 'petition') ? petitions : referendums;
    let item = document.createElement('div');
    document.getElementById(`${type}s`).prepend(item);
    item.setAttribute('id', `${type}-${proposal.id}`);
    item.classList.add('accordion-item');
    let a = document.createElement('a');
    item.appendChild(a);
    a.classList.add('item-link', 'item-content', 'no-padding');
    let inner = document.createElement('div');
    a.appendChild(inner);
    inner.classList.add('item-inner');
    let title = document.createElement('div');
    inner.appendChild(title);
    title.classList.add('item-title');
    title.innerHTML = proposal.title;
    let content = document.createElement('div');
    item.appendChild(content);
    content.classList.add('accordion-item-content');
    let block = document.createElement('div');
    content.appendChild(block);
    block.classList.add('block', 'no-padding');
    a = document.createElement('a');
    block.appendChild(a);
    a.setAttribute('href', `${notary}/proposal.html?signature=${encodeURIComponent(proposal.signature)}`);
    a.setAttribute('target', '_blank');
    a.style.fontSize = '120%';
    a.style.fontWeight = 'bold';
    a.classList.add('link', 'external');
    a.innerHTML = proposal.title;
    let p = document.createElement('p');
    block.appendChild(p);
    p.innerHTML = proposal.description;
    p = document.createElement('p');
    block.appendChild(p);
    let button = document.createElement('button');
    if (type === 'referendum') {
      p = document.createElement('p');
      p.style.fontWeight = 'bold';
      p.innerHTML = proposal.question;
      block.appendChild(p);
      for(let answer of proposal.answers) {
        let label = document.createElement('label');
        block.appendChild(label);
        label.classList.add('radio', 'display-flex', 'margin-bottom-half');
        let input = document.createElement('input');
        label.appendChild(input);
        input.setAttribute('type', 'radio');
        input.setAttribute('name', `answer-${proposal.id}`);
        input.setAttribute('value', answer);
        let i = document.createElement('i');
        i.classList.add('icon-radio', 'margin-right-half');
        label.appendChild(i);
        label.appendChild(document.createTextNode(answer));
        input.addEventListener('change', function(event) {
          if (proposal.done || outdated || (proposal.judge == judge && !iAmEndorsedByJudge))
            disable(button);
          else
            enable(button);
        });
      }
    }
    let url = `https://nominatim.openstreetmap.org/ui/search.html?${proposal.areas.join('&')}&polygon_geojson=1`;
    p = document.createElement('p');
    p.innerHTML = `<b>Area:</b> <a class="link external" href="${url}" target="_blank">${proposal.areas[0].split('=')[1]}</a>`;
    p = document.createElement('p');
    block.appendChild(p);
    p.innerHTML = `<b>Judge:</b> <a class="link external" href="${proposal.judge}" target="_blank">${proposal.judge}</a>`;
    p = document.createElement('p');
    block.appendChild(p);
    const deadline = new Date(proposal.deadline * 1000).toLocaleString();
    const outdated = (proposal.deadline * 1000 < new Date().getTime());
    p.innerHTML = `<b>Deadline:</b> <span${outdated ? ' style="font-color:red"' : ''}>${deadline}</span>`;
    let grid = document.createElement('div');
    block.appendChild(grid);
    grid.classList.add('grid', 'grid-cols-2', 'grid-gap');
    grid.appendChild(button);
    button.classList.add('button', 'button-fill');
    if (type === 'petition') {
      button.innerHTML = proposal.done ? 'Signed' : 'Sign';
      if (proposal.done || outdated || (proposal.judge == judge && !iAmEndorsedByJudge))
        disable(button);
      button.addEventListener('click', function() {
        app.dialog.confirm('Your name and signature will be published to show publicly your support to this petition.', 'Sign Petition?', function() {
          let endorsement = {
            schema: 'https://directdemocracy.vote/json-schema/' + DIRECTDEMOCRACY_VERSION + '/endorsement.schema.json',
            key: citizen.key,
            signature: '',
            published: Math.trunc(new Date().getTime() / 1000),
            endorsedSignature: proposal.signature
          };
          endorsement.signature = citizenCrypt.sign(JSON.stringify(endorsement), CryptoJS.SHA256, 'sha256');
          fetch(`${notary}/api/publish.php`, {method: 'POST', headers: {"Content-Type": "application/json"}, body: JSON.stringify(endorsement)})
            .then((response) => response.json())
            .then((answer) => {
              if (answer.error)
                app.dialog.alert(`${answer.error}<br>Please try again.`, 'Publication Error');
              else {
                app.dialog.alert(`You successfully signed the petition entitled "${proposal.title}"`, 'Signed!');
                button.innerHTML = 'Signed';
                proposal.done = true;
                localStorage.setItem(`${type}s`, JSON.stringify(proposals));
                disable(button);
              }
            });
          });
      });
    } else {  // referendum
      button.innerHTML = proposal.done ? 'Voted' : 'Vote';
      disable(button);
      button.addEventListener('click', function(event) {
        const answer = document.querySelector(`input[name="answer-${proposal.id}"]:checked`).value;
        app.dialog.confirm(`You are about to vote "${answer}" to this referendum. This cannot be changed after you cast your vote.`, 'Vote?', function() {
          fetch(`${notary}/api/participation.php?station=${encodeURIComponent(station)}&referendum=${proposal.signature}`)
            .then((response) => response.json())
            .then((participation) => {
              if (participation.schema != `https://directdemocracy.vote/json-schema/${DIRECTDEMOCRACY_VERSION}/participation.schema.json`) {
                app.dialog.alert('Wrong participation schema', 'Vote error');
                return;
              }
              const signature = participation.signature;
              participation.signature = '';
              let verify = new JSEncrypt();
              verify.setPublicKey(publicKey(participation.key));
              if (!verify.verify(JSON.stringify(participation), signature, CryptoJS.SHA256)) {
                app.dialog.alert('Cannot verify participation signature', 'Vote error');
                return;
              }
              const voteNumber = new Uint8Array(20);
              crypto.getRandomValues(voteNumber);
              let vote = {
                number: btoa(String.fromCharCode(...voteNumber)),  // base64 encoding
                answer: answer
              }
              const encryptedVote = citizenCrypt.encrypt(JSON.stringify(vote)); // FIXME: should be encrypted for blind signature
              let registration = {
                schema: `https://directdemocracy.vote/json-schema/${DIRECTDEMOCRACY_VERSION}/registration.schema.json`,
                key: citizen.key,
                signature: '',
                published: Math.trunc(new Date().getTime() / 1000),
                blindKey: participation.blindKey,
                encryptedVote: encryptedVote
              }
              registration.signature = citizenCrypt.sign(JSON.stringify(registration), CryptoJS.SHA256, 'sha256');
              fetch(`${notary}/api/publish.php`, {method: 'POST', headers: {"Content-Type": "application/json"}, body: JSON.stringify(registration)})
                .then((response) => response.json())
                .then((answer) => {
                  if (answer.error) {
                    app.dialog.alert(`Cannot publish registration: ${answer.error}`, 'Vote error');
                    return;
                  }
                  fetch(`${station}/api/registration.php`, {method: 'POST', headers: {"Content-Type": "application/json"}, body: JSON.stringify(registration)})
                    .then((response) => response.json())
                    .then((answer) => {
                      if (answer.error) {
                        app.dialog.alert(`Station refusing registration: ${answer.error}`, 'Vote error');
                        return;
                      }
                    });
                });
            });
        });
      });
    }
    let trashButton = document.createElement('button');
    grid.appendChild(trashButton);
    trashButton.classList.add('button', 'button-tonal');
    trashButton.innerHTML = '<i class="icon f7-icons" style="font-size:150%">trash</i>';
    trashButton.addEventListener('click', function() {
      const uppercaseType = type.charAt(0).toUpperCase() + type.slice(1);
      app.dialog.confirm(`This ${type} will be removed from your list, but you can fetch it again if needed.`, `Remove ${uppercaseType}?`, function() {
        document.getElementById(`${type}s`).removeChild(item);
        if (!proposal.done) {  // actually remove it
          const index = proposals.indexOf(proposal);
          proposals.splice(index, 1);
          let i = 0;
          proposals.forEach(function(p) {
            p.id = i++;
          });
        } else {  // remove useless fields, keep only done and fingerprint
          delete proposal.id;  // hidden
          delete proposal.published;
          delete proposal.signature;
          delete proposal.title;
          delete proposal.description;
          delete proposal.areas;
          delete proposal.area;
          delete proposal.deadline;
          delete proposal.corpus;
          delete proposal.participation;
          delete proposal.answers;
          delete proposal.question;
          delete proposal.judge;
          delete proposal.secret;
          delete proposal.website;
        }
        localStorage.setItem(`${type}s`, JSON.stringify(proposals));
      });
    });
    if (open)
      app.accordion.open(item);
  }

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
    citizenCrypt = new JSEncrypt({default_key_size: 2048});
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
}

function updateProposalLink() {
  let proposal = document.getElementById('proposal');
  if (proposal)
    proposal.setAttribute('href', `${notary}/proposal.html?latitude=${citizen.latitude}&longitude=${citizen.longitude}`);
}

function updateSearchLinks() {
  document.getElementById('search-petition').setAttribute('href', `${notary}?tab=proposals&latitude=${citizen.latitude}&longitude=${citizen.longitude}`);
  document.getElementById('search-referendum').setAttribute('href', `${notary}?tab=proposals&latitude=${citizen.latitude}&longitude=${citizen.longitude}`);
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
  let published = new Date(citizen.published * 1000);
  document.getElementById('citizen-published').innerHTML = published.toISOString().slice(0, 10);
  citizenFingerprint = CryptoJS.SHA1(CryptoJS.enc.Base64.parse(citizen.signature));
  getReputationFromJudge();
  updateCitizenEndorsements();
}

function downloadCitizen() {
  fetch(`${notary}/api/citizen.php`, {method: 'POST', headers: {"Content-Type": "application/x-www-form-urlencoded"}, body: 'key=' + encodeURIComponent(strippedKey(citizenCrypt.getPublicKey()))})
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
        updateEndorsements();
        updateProposalLink();
        updateSearchLinks();
        let swiper = document.getElementById('swiper-container');
        swiper.setAttribute('speed', '300');
        swiper.swiper.allowTouchMove = true;
        // updateArea();  FIXME
      }
    })
    .catch((error) => {
      app.dialog.alert('Cannot connect to the notary.<br>Please try again.', 'Citizen Error');
      console.error(error);
    });
}

function getReputationFromJudge() {
  fetch(`${judge}/api/reputation.php?key=${encodeURIComponent(citizen.key)}`)
    .then((response) => response.json())
    .then((answer) => {
      let reputation = document.getElementById('citizen-reputation');
      let badge = document.getElementById('endorsed-badge');
      if (answer.error) {
        reputation.innerHTML = `<span style="font-weight:bold;color:red">${answer.error}</span>`;
        badge.classList.remove('color-blue');
        badge.classList.add('color-red');
      } else {
        iAmEndorsedByJudge = answer.endorsed;
        const color = answer.endorsed ? 'blue' : 'red';
        reputation.innerHTML = `<span style="font-weight:bold;color:${color}">${answer.reputation}</span>`;
        badge.classList.remove('color-red');
        badge.classList.remove('color-blue');
        badge.classList.add('color-' + color);
        updateProposals(petitions);
        updateProposals(referendums);
      }})
    .catch((error) => {
      app.dialog.alert(error, 'Could not get reputation from judge.');
    });
}

function updateProposals(proposals) {
  const type = (proposals === petitions) ? 'petition' : 'referendum';
  for(let proposal of proposals) {
    if (proposal.judge == judge) {
      let button = document.querySelector(`#${type}-${proposal.id} > div > div > div > button`);
      if (button) {
        if (iAmEndorsedByJudge && !proposal.done)
          enable(button);
        else
          disable(button);
      }
    }
  }
}

function updateCitizenEndorsements() {
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
  list.innerHTML = '';
  let endorsementCount = citizenEndorsements.length - revokeCount;
  badge.innerHTML = endorsementCount;
  const plural = (citizenEndorsements.length > 1) ? 'endorsements' : 'endorsement';
  newElement(list, 'div', 'block-title no-margin-left no-margin-right', `${endorsementCount}/${citizenEndorsements.length} ${plural}`);
  let medias = newElement(list, 'div', 'list media-list');
  let ul = newElement(medias, 'ul');
  citizenEndorsements.forEach(function(endorsement) {
    let li = newElement(ul, 'li', 'item-content no-padding-left no-padding-right no-margin-left no-margin-right');
    let div = newElement(li, 'div', 'item-media');
    let img = newElement(div, 'img');
    img.src = endorsement.picture;
    img.style.width = '75px';
    div = newElement(li, 'div', 'item-inner');
    let a = newElement(div, 'a', 'link external display-block');
    a.href = `${notary}/citizen.html?signature=${encodeURIComponent(endorsement.signature)}&judge=${judge}`;
    a.target = '_blank';
    newElement(a, 'div', 'item-title', endorsement.givenNames);
    newElement(a, 'div', 'item-title', endorsement.familyName);
    const t = new Date(endorsement.published * 1000).toISOString().slice(0, 10);
    let message = newElement(div, 'div', 'item-subtitle', (endorsement.revoke ? 'Revoked you on: ' : 'Endorsed you on: ') + t);
    message.style.fontSize='82.353%';
    if (endorsement.revoke) {
      message.style.fontWeight = 'bold';
      message.style.color = 'red';
    }
  });
}

function updateEndorsements() {
  let list = document.getElementById('endorsements-list');
  list.innerHTML = ''; // clear
  let count = 0;
  let medias = newElement(list, 'div', 'list media-list block');
  let ul = newElement(medias, 'ul');
  endorsements.forEach(function(endorsement) {
    let li = newElement(ul, 'li', 'item-content no-padding-left no-padding-right no-margin-left no-margin-right');
    let div = newElement(li, 'div', 'item-media');
    let img = newElement(div, 'img');
    img.src = endorsement.picture;
    img.style.width = '75px';
    div = newElement(li, 'div', 'item-inner');
    let a = newElement(div, 'a', 'link external display-block');
    a.href = `${notary}/citizen.html?signature=${encodeURIComponent(endorsement.signature)}&judge=${judge}`;
    a.target = '_blank';
    newElement(a, 'div', 'item-title', endorsement.givenNames);
    newElement(a, 'div', 'item-title', endorsement.familyName);
    const t = new Date(endorsement.published * 1000).toISOString().slice(0, 10);
    let message = newElement(div, 'div', 'item-subtitle', (endorsement.revoke ? 'Revoked : ' : 'Endorsed: ') + t);
    message.style.fontSize='82.353%';
    if (endorsement.revoke) {
      message.style.color = 'red';
      count++;
    } else {
      let d = newElement(div, 'div', 'item-label text-align-right');
      a = newElement(d, 'a', 'link', 'Revoke');
      a.href = '#';
      a.style.fontWeight = 'bold';
      a.style.textTransform = 'uppercase';
      a.addEventListener('click', function() {
        function revoke() {
          let e = {
            schema: `https://directdemocracy.vote/json-schema/${DIRECTDEMOCRACY_VERSION}/endorsement.schema.json`,
            key: citizen.key,
            signature: '',
            published: Math.trunc(new Date().getTime() / 1000),
            revoke: true,
            endorsedSignature: endorsement.signature
          };
          e.signature = citizenCrypt.sign(JSON.stringify(e), CryptoJS.SHA256, 'sha256');
          fetch(`${notary}/api/publish.php`, {method: 'POST', body: JSON.stringify(e)})
            .then((response) => response.json())
            .then((answer) => {
              if (answer.error) {
                app.dialog.alert(answer.error, 'Revocation error');
                return;
              }
              app.dialog.alert(`You successfully revoked ${endorsement.givenNames} ${endorsement.familyName}`, 'Revocation success');
              endorsements.splice(endorsements.indexOf(endorsement), 1);  // remove it from array
              updateEndorsements();
            });
        }
        const text = '<p class="text-align-left">' +
          "You should revoke only a citizen who has moved or changed her citizen card. This might affect their ability to vote. Do you really want to revoke this citizen?" +
          `</p><p class="text-align-center"><b>${endorsement.givenNames}<br>${endorsement.familyName}</b></p><p>` +
          "Please type <b>I understand</b> here:" +
          '</p>';
        app.dialog.create({
          title: 'Revoke Citizen',
          text,
          content: '<div class="dialog-input-field input"><input type="text" class="dialog-input"></div>',
          buttons: [{
              text: app.params.dialog.buttonCancel,
              keyCodes: app.keyboardActions ? [27] : null
            },
            {
              text: app.params.dialog.buttonOk,
              bold: true,
              keyCodes: app.keyboardActions ? [13] : null
            }],
          destroyOnClose: true,
          onClick: function(dialog, index) {
            if (index === 1) // OK
              revoke();
          },
          on: {
            open: function(d) {
              let input = d.$el.find('.dialog-input')[0];
              let okButton = d.$el.find('.dialog-button')[1];
              disable(okButton);
              input.addEventListener('input', function(event) {
                if (event.target.value === 'I understand')
                  enable(okButton);
                else
                  disable(okButton);
              });
              input.addEventListener('change', function(event) {
                if (event.target.value === 'I understand') {
                  d.close();
                  revoke();
                }
              });
            }
          }
        }).open();
      });
    }
  });
  let badge = document.getElementById('endorse-badge');
  badge.innerHTML = count;
  badge.style.display = (count == 0) ? 'none' : '';
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

function publicKey(key) {
  let pkey = '-----BEGIN PUBLIC KEY-----\n';
  const l = key.length;
  for (let i = 0; i < l; i += 64)
    pkey += key.substr(i, 64) + '\n';
  pkey += '-----END PUBLIC KEY-----';
  return pkey;
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

function newElement(parent, type, classes, innerHTML) {
  let element = document.createElement(type);
  if (parent)
    parent.appendChild(element);
  if (classes) {
    const classArray = classes.split(' ');
    classArray.forEach(function(c) {
      element.classList.add(c);
    });
  }
  if (typeof innerHTML !== 'undefined')
    element.innerHTML = innerHTML;
  return element;
}
