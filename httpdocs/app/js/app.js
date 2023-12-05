/* global Framework7, QRious, Keystore, L, Camera, Croppie, integrity, device, QRScanner */

import Translator from './translator.js';
import {rsaBlind, rsaUnblind} from './rsa-blind.js';

const TESTING = false;

const DIRECTDEMOCRACY_VERSION_MAJOR = '2';
const DIRECTDEMOCRACY_VERSION_MINOR = '0';
const DIRECTDEMOCRACY_VERSION_BUILD = '31';

const PRODUCTION_APP_KEY = // public key of the genuine app
  'vD20QQ18u761ean1+zgqlDFo6H2Emw3mPmBxeU24x4o1M2tcGs+Q7G6xASRf4LmSdO1h67ZN0sy1tasNHH8Ik4CN63elBj4ELU70xZeYXIMxxxDqis' +
  'FgAXQO34lc2EFt+wKs+TNhf8CrDuexeIV5d4YxttwpYT/6Q2wrudTm5wjeK0VIdtXHNU5V01KaxlmoXny2asWIejcAfxHYSKFhzfmkXiVqFrQ5BHAf' +
  '+/ReYnfc+x7Owrm6E0N51vUHSxVyN/TCUoA02h5UsuvMKR4OtklZbsJjerwz+SjV7578H5FTh0E0sa7zYJuHaYqPevvwReXuggEsfytP/j2B3IgarQ';
const TEST_APP_KEY = // public key of the test app
  'nRhEkRo47vT2Zm4Cquzavyh+S/yFksvZh1eV20bcg+YcCfwzNdvPRs+5WiEmE4eujuGPkkXG6u/DlmQXf2szMMUwGCkqJSPi6fa90pQKx81QHY8Ab4' +
  'z69PnvBjt8tt8L8+0NRGOpKkmswzaX4ON3iplBx46yEn00DQ9W2Qzl2EwaIPlYNhkEs24Rt5zQeGUxMGHy1eSR+mR4Ngqp1LXCyGxbXJ8B/B5hV4QI' +
  'or7U2raCVFSy7sNl080xNLuY0kjHCV+HN0h4EaRdR2FSw9vMyw5UJmWpCFHyQla42Eg1Fxwk9IkHhNe/WobOT1Jiy3Uxz9nUeoCQa5AONAXOaO2wtQ';

const PRIVATE_KEY_ALIAS = 'DirectDemocracyApp';

let directDemocracyVersion =
  `${DIRECTDEMOCRACY_VERSION_MAJOR}.${DIRECTDEMOCRACY_VERSION_MINOR}.${DIRECTDEMOCRACY_VERSION_BUILD}`;
let appKey = '';
let languagePicker;
let homePageIsReady = false;
let translatorIsReady = false;
let challenge = '';
let translator = new Translator('i18n');
let citizen = {
  schema: '',
  key: '',
  signature: '',
  published: 0,
  appKey: '',
  appSignature: '',
  givenNames: '',
  familyName: '',
  picture: '',
  latitude: 0,
  longitude: 0
};
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
let endorsementToPublish = null;
let endorsementToRevoke = null;
let petitionSignature = null;
let participationToPublish = null;
let vote = null;
let voteBytes = null;
let blindInv = null;
let petitionButton = null;
let petitionProposal = null;
let revocationToPublish = null;
let endorseMap = null;
let endorseMarker = null;
let petitions = [];
let referendums = [];

const base128Charset = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz' +
  'ÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖØÙÚÛÜÝÞßàáâãäåæçèéêëìíîïðñòóôõøùúûüýÿþ@$*£¢';

function encodeBase128(byteArray) { // Uint8Array
  function toBin(byteArray) {
    let end = '';
    for (let i in byteArray) {
      let aux = byteArray[i].toString(2);
      if (aux.length < 8)
        aux = '0'.repeat(8 - aux.length) + aux;
      end += aux;
    }
    return end;
  }
  const bin = toBin(byteArray);
  const sevenBits = bin.match(/.{1,7}/g);
  while (sevenBits[sevenBits.length - 1].length < 7)
    sevenBits[sevenBits.length - 1] += '0';
  let res = [];
  for (let i in sevenBits) {
    const interger = parseInt('0' + sevenBits[i], 2);
    res.push(base128Charset[interger]);
  }
  res = res.join('');
  return res;
}

function decodeBase128(text) {
  function toByteArray(bin) {
    const size = bin.length / 8;
    let res = new Uint8Array(size);
    const bytes = bin.match(/.{1,8}/g);
    for (let i in bytes)
      res[i] = parseInt(bytes[i], 2);
    return res;
  }
  let sevenBits = [];
  for (let i in text) {
    for (let j = 0; j < base128Charset.length; ++j) {
      if (text[i] === base128Charset[j]) {
        let aux = j.toString(2);
        let aux2 = '0'.repeat(7 - aux.length) + aux;
        sevenBits.push(aux2);
      }
    }
  }
  return toByteArray(sevenBits.join('')); // Uint8Array
}

function int64ToUint8Array(int64) {
  const byteArray = new Uint8Array(8);
  for (let i = 0; i < byteArray.length; i++) {
    const byte = int64 & 0xff;
    byteArray[i] = byte;
    int64 = (int64 - byte) / 256;
  }
  return byteArray;
}

function sanitizeWebservice(string) {
  if (!string)
    return '';
  string = string.replace(/[^a-z0-9-:./]/gi, '');
  return string;
}

async function importKey(key) {
  const bytes = base64ToByteArray('MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA' + key + 'IDAQAB');
  const publicKey = await crypto.subtle.importKey(
    'spki',
    bytes,
    {
      name: 'RSASSA-PKCS1-v1_5',
      hash: 'SHA-256'
    },
    true,
    ['verify']
  );

  return publicKey;
}

function base64ToByteArray(base64) {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++)
    bytes[i] = binaryString.charCodeAt(i);

  return bytes;
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
    renderToolbar: function() {
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
  setupLanguagePicker();
};

let app = new Framework7({ el: '#app', name: 'directdemocracy', routes: [{ path: '/', pageName: 'home' }] });

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

app.views.create('.view-main', { iosDynamicNavbar: false });

addEventListener('online', () => {
  console.log('online');
  if (localStorage.getItem('registered') && localStorage.getItem('publicKey')) {
    downloadCitizen();
    getReputationFromJudge();
  }
});

addEventListener('offline', () => {
  console.log('offline');
});

// Wait for Cordova to be initialized.
document.addEventListener('deviceready', onDeviceReady, false);

function keystoreFailure(e) {
  app.dialog.alert(e, 'Keystore failure');
}

async function publish(publication, signature, type) {
  publication.signature = signature.slice(0, -2);
  const nonce = signature.replaceAll('+', '-').replaceAll('/', '_');
  integrity.check(nonce, function(token) { // success
    if (TESTING && device.platform === 'iOS')
      token = 'N/A';
    fetch('https://app.directdemocracy.vote/api/integrity.php', {
      method: 'POST',
      headers: {
        'directdemocracy-version': directDemocracyVersion,
        'integrity-token': token,
        'user-notary': notary,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(publication)
    }).then(response => response.json())
      .then(async answer => {
        if (answer.hasOwnProperty('error'))
          app.dialog.alert(`${answer.error}<br>Please try again.`, 'Publication Error');
        else {
          if (type === 'citizen card') {
            updateCitizenCard();
            app.dialog.alert(translator.translate('citizen-card-published'), translator.translate('congratulations'));
            localStorage.setItem('registered', true);
          } else if (type === 'endorsement') {
            app.dialog.alert(`You successfully endorsed ${endorsed.givenNames} ${endorsed.familyName}`, 'Endorsement Success');
            hide('endorse-citizen');
            show('endorse-page');
            hide('endorse-button-preloader');
            enable('endorse-confirm');
            enable('endorse-cancel-confirm');
            for (let i in endorsements) { // remove if already in the endorsements list
              if (endorsements[i].signature === endorsed.signature) {
                endorsements.splice(i, 1);
                break;
              }
            }
            endorsements.push(endorsed);
            updateEndorsements();
          } else if (type === 'petition signature') {
            app.dialog.alert(`You successfully signed the petition entitled "${petitionProposal.title}"`, 'Signed!');
            petitionButton.textContent = 'Signed';
            petitionProposal.done = true;
            localStorage.setItem(`petitions`, JSON.stringify(petitions));
            disable(petitionButton);
          } else if (type === 'revocation') {
            app.dialog.alert(
              `You successfully revoked ${endorsementToRevoke.givenNames} ${endorsementToRevoke.familyName}`,
              'Revocation success');
            endorsements.splice(endorsements.indexOf(endorsementToRevoke), 1); // remove it from list
            endorsementToRevoke.revoke = true;
            endorsementToRevoke.published = revocationToPublish.published; // set the recovation date
            endorsements.push(endorsementToRevoke); // add it at the end of the list
            updateEndorsements();
          } else if (type === 'participation') {
            const binaryAppKey = await importKey(appKey);
            const blindSignature = base64ToByteArray(answer['blind_signature']);
            const signature = await rsaUnblind(binaryAppKey, voteBytes, blindSignature, blindInv);
            vote.appSignature = signature;
            vote.appKey = appKey;

            fetch(`${station}/api/vote.php`, {
              method: 'POST',
              headers: {
                'directdemocracy-version': directDemocracyVersion,
                'user-notary': notary,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify(vote)
            }).then(response => response.json())
              .then(async answer => {
                if (answer.hasOwnProperty('error'))
                  app.dialog.alert(`${answer.error}<br>Please try again.`, 'Vote Error');
                else {
                  console.log('Vote was casted');
                  console.log('It should be taken into account after some time');
                }
              });
          }
        }
        if (type === 'endorsement')
          enable('endorse-button');
      });
  }, function(message) { // integrity check failure
    console.error('Integrity check failure: ' + message);
    alert(message);
  });
}

async function publishCitizen(signature) {
  const bytes = base64ToByteArray(signature);
  citizenFingerprint = await crypto.subtle.digest('SHA-1', bytes);
  citizenFingerprint = String.fromCharCode(...new Uint8Array(citizenFingerprint));
  localStorage.setItem('citizenFingerprint', btoa(citizenFingerprint));
  publish(citizen, signature, 'citizen card');
}

function publishEndorsement(signature) {
  publish(endorsementToPublish, signature, 'endorsement');
}

function publishPetitionSignature(signature) {
  publish(petitionSignature, signature, 'petition signature');
}

function publishRevocation(signature) {
  publish(revocationToPublish, signature, 'revocation');
}

function publishParticipation(signature) {
  publish(participationToPublish, signature, 'participation');
}

async function signChallenge(signature) {
  const binaryString = citizenFingerprint + atob(signature);
  if (binaryString.length !== 276) // citizenFingerprint + atob(signature) is 276 bytes long, e.g., 20 + 256
    console.error('Unexpected binary string length: ' + binaryString.length);
  const buffer = new Uint8Array(binaryString.length);
  for (let i in buffer)
    buffer[i] = binaryString.charCodeAt(i);
  const code = encodeBase128(buffer); // code should a be 316 bytes long
  const qr = new QRious({ value: code, level: 'L', size: 1024, padding: 0 });
  document.getElementById('qrcode-image').src = qr.toDataURL();
  document.getElementById('qrcode-message').textContent = 'Ask citizen to scan this code';
  hide('home');
  show('qrcode');
}

function onDeviceReady() {
  directDemocracyVersion += ` (${device.platform})`;
  appKey = (device.isVirtual || TESTING) ? TEST_APP_KEY : PRODUCTION_APP_KEY;
  const successCreateKey = function(publicKey) {
    localStorage.setItem('publicKey', publicKey.slice(44, -6));
    showMenu();
  };
  if (!localStorage.getItem('publicKey'))
    Keystore.createKeyPair(PRIVATE_KEY_ALIAS, successCreateKey, keystoreFailure);
  else
    showMenu();
}

function showMenu() {
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

  if (!localStorage.getItem('registered'))
    showPage('register');
  else {
    showPage('splash');
    downloadCitizen();
  }

  document.getElementById('revoke').addEventListener('click', function() {
    function revokeCard() {
      localStorage.removeItem('registered');
      localStorage.removeItem('citizenFingerprint');
      localStorage.removeItem('publicKey');
      localStorage.removeItem('referendums');
      localStorage.removeItem('petitions');
      endorsements = [];
      citizenEndorsements = [];
      updateEndorsements();
      updateCitizenEndorsements();
      Keystore.createKeyPair(PRIVATE_KEY_ALIAS, function(publicKey) {
        localStorage.setItem('publicKey', publicKey.slice(44, -6));
        showPage('register');
        console.log('revoked card');
      }, keystoreFailure);
    }
    const text = '<p class="text-align-left">' +
    'If you revoke your citizen card, you will have to create a new one and get endorsements to be able to vote and sign. ' +
    'Do you really want to revoke your citizen card?</p><p>Please type <b>I understand</b> here:</p>';
    app.dialog.create({
      title: 'Revoke Citizen Card',
      text,
      content: '<div class="dialog-input-field input"><input type="text" class="dialog-input"></div>',
      buttons: [{
        text: app.params.dialog.buttonCancel,
        keyCodes: app.keyboardActions ? [27] : null
      }, {
        text: app.params.dialog.buttonOk,
        bold: true,
        keyCodes: app.keyboardActions ? [13] : null
      }],
      destroyOnClose: true,
      onClick: function(dialog, index) {
        if (index === 1) // OK
          revokeCard();
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
              revokeCard();
            }
          });
        }
      }
    }).open();
  });
  document.getElementById('register-given-names').addEventListener('input', validateRegistration);
  document.getElementById('register-family-name').addEventListener('input', validateRegistration);

  // setting up the ID picture
  document.getElementById('register-camera-picture').addEventListener('click', uploadPicture);
  document.getElementById('register-file-picture').addEventListener('click', uploadPicture);

  // setting-up the home location
  document.getElementById('register-location-button').addEventListener('click', function() {
    disable('register-location-button');
    let content = {};
    content.innerHTML = `<div class="sheet-modal" style="height: 100%">
  <div class="toolbar" style="margin-top:16px">
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
            fetch('https://nominatim.openstreetmap.org/reverse.php' +
              `?format=json&lat=${citizen.latitude}&lon=${citizen.longitude}&zoom=20`)
              .then((response) => response.json())
              .then((answer) => {
                registerMarker.setPopupContent(
                  `${answer.display_name}<br><br><center style="color:#999">` +
                  `(${citizen.latitude}, ${citizen.longitude})</center>`
                ).openPopup();
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
              getGeolocationPosition({ coords: { latitude: coords[0], longitude: coords[1] } });
            })
            .catch((error) => {
              console.error(`Could not fetch latitude and longitude from https://ipinfo.io/loc.`);
              console.error(error);
              getGeolocationPosition({ coords: { latitude: 46.517493, longitude: 6.629111 } }); // default to Lausanne
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
  document.getElementById('register-button').addEventListener('click', async function(event) {
    disable('register-button');
    let text = document.getElementById('register-button-text');
    const registration = 'registration';
    text.innerHTML = translator.translate(registration);
    text.setAttribute('data-i18n', registration);
    show('register-button-preloader');
    citizen.schema = `https://directdemocracy.vote/json-schema/${DIRECTDEMOCRACY_VERSION_MAJOR}/citizen.schema.json`;
    citizen.key = localStorage.getItem('publicKey');
    citizen.published = Math.trunc(new Date().getTime() / 1000);
    citizen.givenNames = document.getElementById('register-given-names').value.trim();
    citizen.familyName = document.getElementById('register-family-name').value.trim();
    citizen.signature = '';
    citizen.appKey = appKey;
    citizen.appSignature = '';
    Keystore.sign(PRIVATE_KEY_ALIAS, JSON.stringify(citizen), publishCitizen, keystoreFailure);

    return false;
  });

  function stopScanner(page) {
    hide('scanner');
    show(page);
    QRScanner.hide(function(status) {
      QRScanner.destroy(function(status) {
      });
    });
  }

  document.getElementById('cancel-scanner').addEventListener('click', function() {
    QRScanner.cancelScan(function(status) {
      stopScanner('home');
    });
  });

  function scan(callback) {
    QRScanner.prepare(function(error, status) {
      if (error)
        console.error(error._message);
      else {
        QRScanner.show(function(status) {
          hide('home');
          show('scanner');
          QRScanner.scan(callback);
        });
      }
    });
  }

  document.getElementById('endorse-me-button').addEventListener('click', function() {
    disable('endorse-me-button');
    scan(function(error, contents) {
      show('home');
      hide('scanner');
      if (error) {
        if (error.name !== 'SCAN_CANCELED')
          console.error(error.name);
        enable('endorse-me-button');
        stopScanner('home');
        return;
      }
      stopScanner('home');
      const length = decodeBase128(contents).length;
      if (length !== 20)
        console.error(`Wrong challenge received, size is ${length} whereas it should be 20.`);
      Keystore.sign(PRIVATE_KEY_ALIAS, contents, signChallenge, keystoreFailure);
    });
  });

  function scanChallengeAnswer(error, contents) {
    if (error) {
      if (error.name !== 'SCAN_CANCELED')
        console.error(error._message);
      enable('endorse-button');
      stopScanner('home');
      return;
    }
    stopScanner('home');
    if (contents.length !== 316)
      alert('Wrong contents size: ' + contents.length);
    const byteArray = decodeBase128(contents);
    if (byteArray.length !== 276)
      alert('Wrong byteArray size: ' + byteArray.length);
    let fingerprint = '';
    const hex = '0123456789abcdef';
    for (let i = 0; i < 20; i++) {
      const b = byteArray[i];
      fingerprint += hex[b >> 4] + hex[b & 15];
    }
    let binarySignature = '';
    for (let i = 20; i < 276; i++)
      binarySignature += String.fromCharCode(byteArray[i]);
    const signature = btoa(binarySignature).slice(0, -2);
    // get endorsee from fingerprint
    fetch(`${notary}/api/publication.php?fingerprint=${fingerprint}`)
      .then((response) => response.text())
      .then(async function(answer) {
        endorsed = JSON.parse(answer);
        if (endorsed.hasOwnProperty('error')) {
          app.dialog.alert(endorsed.error, 'Error getting citizen from notary');
          enable('endorse-button');
          return;
        }
        // verify challenge signature by endorsed
        const publicKey = await importKey(endorsed.key);
        let bytes = base64ToByteArray(signature); // FIXME: we should keep the signature as a byte array from the beginning
        const challengeArrayBuffer = new TextEncoder().encode(challenge);
        challenge = '';
        let verify = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', publicKey, bytes, challengeArrayBuffer);
        if (!verify) {
          app.dialog.alert('Cannot verify challenge signature', 'Error verifying challenge');
          enable('endorse-button');
          return;
        }
        // verify citizen signature on citizen card of endorsed
        let endorsedSignature = endorsed.signature;
        let endorsedAppSignature = endorsed.appSignature;
        endorsed.appSignature = '';
        endorsed.signature = '';
        bytes = base64ToByteArray(endorsedSignature);
        let encoded = new TextEncoder().encode(JSON.stringify(endorsed));
        verify = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', publicKey, bytes, encoded);
        if (!verify) {
          app.dialog.alert('Cannot verify citizen signature on citizen card', 'Error verifying signature');
          enable('endorse-button');
          return;
        }
        endorsed.signature = endorsedSignature;
        endorsed.appSignature = endorsedAppSignature;
        // verify app signature on citizen card of endorsed
        bytes = base64ToByteArray(endorsedAppSignature);
        encoded = new TextEncoder().encode(endorsedSignature);
        const binaryAppKey = await importKey(endorsed.appKey);
        verify = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', binaryAppKey, bytes, encoded);
        if (!verify) {
          app.dialog.alert('Cannot verify app signature on citizen card', 'Error verifying signature');
          enable('endorse-button');
          return;
        }
        hide('endorse-page');
        show('endorse-citizen');
        document.getElementById('endorse-picture-check').checked = false;
        document.getElementById('endorse-name-check').checked = false;
        document.getElementById('endorse-adult-check').checked = false;
        document.getElementById('endorse-coords-check').checked = false;
        show('endorse-citizen');
        document.getElementById('endorse-picture').src = endorsed.picture;
        document.getElementById('endorse-family-name').textContent = endorsed.familyName;
        document.getElementById('endorse-given-names').textContent = endorsed.givenNames;
        const lat = endorsed.latitude;
        const lon = endorsed.longitude;
        document.getElementById('endorse-coords').textContent = lat + ', ' + lon;
        let published = new Date(endorsed.published * 1000);
        document.getElementById('endorse-published').textContent = published.toISOString().slice(0, 10);
        if (endorseMap == null) {
          endorseMap = L.map('endorse-map', { dragging: false });
          endorseMap.whenReady(function() { setTimeout(() => { this.invalidateSize(); }, 0); });
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
            endorseMarker.setPopupContent(`${address}<br><br><center style="color:#999">(${lat}, ${lon})</center>`).openPopup();
          });
      });
  }

  function qrCodeDone() {
    hide('qrcode');
    show('home');
    if (challenge !== '')
      scan(scanChallengeAnswer);
  }

  document.getElementById('qrcode-done').addEventListener('click', qrCodeDone);

  document.getElementById('endorse-button').addEventListener('click', function() {
    disable('endorse-button');
    const randomBytes = new Uint8Array(20);
    crypto.getRandomValues(randomBytes);
    challenge = encodeBase128(randomBytes);
    const qr = new QRious({
      value: challenge,
      level: 'L',
      size: 512,
      padding: 0
    });
    document.getElementById('qrcode-image').src = qr.toDataURL();
    document.getElementById('qrcode-message').textContent = 'Ask citizen to scan this code';
    hide('home');
    show('qrcode');
  });

  document.getElementById('endorse-picture-check').addEventListener('change', updateEndorseConfirm);
  document.getElementById('endorse-name-check').addEventListener('change', updateEndorseConfirm);
  document.getElementById('endorse-adult-check').addEventListener('change', updateEndorseConfirm);
  document.getElementById('endorse-coords-check').addEventListener('change', updateEndorseConfirm);

  document.getElementById('endorse-cancel-confirm').addEventListener('click', function() {
    hide('endorse-citizen');
    show('endorse-page');
    enable('endorse-button');
  });

  document.getElementById('endorse-confirm').addEventListener('click', function(event) {
    show('endorse-button-preloader');
    disable(event.currentTarget);
    disable('endorse-cancel-confirm');
    endorsementToPublish = {
      schema: `https://directdemocracy.vote/json-schema/${DIRECTDEMOCRACY_VERSION_MAJOR}/endorsement.schema.json`,
      key: citizen.key,
      signature: '',
      published: Math.trunc(new Date().getTime() / 1000),
      appKey: appKey,
      appSignature: '',
      endorsedSignature: endorsed.signature
    };
    Keystore.sign(PRIVATE_KEY_ALIAS, JSON.stringify(endorsementToPublish), publishEndorsement, keystoreFailure);
  });

  document.getElementById('scan-referendum').addEventListener('click', function() {
    hide('referendum-page');
    disable('scan-referendum');
    disable('enter-referendum');
    scan(function(error, contents) {
      scanProposal(error, contents, 'referendum');
    });
  });

  document.getElementById('scan-petition').addEventListener('click', function() {
    hide('petition-page');
    disable('scan-petition');
    disable('enter-petition');
    scan(function(error, contents) {
      scanProposal(error, contents, 'petition');
    });
  });

  let referendumSearch = document.getElementById('enter-referendum');
  referendumSearch.addEventListener('keyup', function(event) {
    if (event.key === 'Enter')
      searchProposal('referendum');
  });
  referendumSearch.addEventListener('paste', function(event) {
    event.preventDefault();
    document.getElementById('enter-referendum').value = (event.clipboardData || window.clipboardData).getData('text');
    searchProposal('referendum');
  });

  let petitionSearch = document.getElementById('enter-petition');
  petitionSearch.addEventListener('keyup', function(event) {
    if (event.key === 'Enter')
      searchProposal('petition');
  });
  petitionSearch.addEventListener('paste', function(event) {
    event.preventDefault();
    document.getElementById('enter-petition').value = (event.clipboardData || window.clipboardData).getData('text');
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

  function scanProposal(error, contents, type) {
    stopScanner('home');
    show(`${type}-page`);
    enable(`scan-${type}`);
    enable(`enter-${type}`);
    if (error) {
      if (error.name !== 'SCAN_CANCELED')
        alert(error._message);
      return;
    }
    const binaryContents = decodeBase128(contents);
    let fingerprint = '';
    const hex = '0123456789abcdef';
    for (let i = 0; i < 20; i++) {
      const b = binaryContents[i];
      fingerprint += hex[b >> 4] + hex[b & 15];
    }
    getProposal(fingerprint, type);
  }

  async function getProposal(fingerprint, type) {
    fetch(`${notary}/api/proposal.php?fingerprint=${fingerprint}&latitude=${citizen.latitude}&longitude=${citizen.longitude}`)
      .then((response) => response.json())
      .then(async function(proposal) {
        if (proposal.error) {
          console.error(`Proposal error: ${proposal.error}`);
          return;
        }
        const signatureIsLegit = await verifyProposalSignature(proposal);
        if (!signatureIsLegit)
          return;
        const outdated = (proposal.deadline * 1000 < new Date().getTime());
        const deadline = new Date(proposal.deadline * 1000).toLocaleString();
        const title = `<b>${proposal.title}</b><br><br>`;
        if (type === 'petition' && proposal.secret) {
          app.dialog.alert(
            `${title}This proposal is a referendum, not a petition, please scan it from the <b>Vote</b> tab`,
            'Not a petition'
          );
        } else if (type === 'referendum' && !proposal.secret) {
          app.dialog.alert(
            `${title}This proposal is a petition, not a referendum, please scan it from the <b>Sign</b> tab`,
            'Not a referendum'
          );
        } else if (!proposal.inside) {
          const message = (type === 'petition')
            ? `You are not inside the area of this petition (which is <i>${proposal.areas[0].split('=')[1]}</i>). ` +
            'Therefore you cannot sign it.'
            : `You are not inside the area of this referendum (which is <i>${proposal.areas[0].split('=')[1]}</i>). ` +
            'Therefore you cannot vote.';
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
            const bytes = base64ToByteArray(p.signature);
            const bytesArray = await crypto.subtle.digest('SHA-1', bytes);
            const sha1 = Array.from(new Uint8Array(bytesArray), byte => ('0' + (byte & 0xFF).toString(16)).slice(-2)).join('');
            if (sha1 === fingerprint) {
              if (p.id !== undefined) {
                app.dialog.alert(`${title}You already have this ${type}.`);
                app.accordion.open(document.getElementById(`${type}-${p.id}`));
              } else { // already there, insert at position 0 and reset the missing fields
                p.id = 0;
                let i = 0;
                for (let p2 of proposals)
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

  async function verifyProposalSignature(proposal) {
    let p = {
      'schema': proposal.schema,
      'key': proposal.key,
      'signature': '',
      'published': proposal.published,
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

    const publicKey = await importKey(proposal.key);
    if (!publicKey)
      console.error('Failed to import public key for proposal');
    const bytes = base64ToByteArray(proposal.signature);
    const packetArrayBuffer = new TextEncoder().encode(JSON.stringify(p));
    const verify = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', publicKey, bytes, packetArrayBuffer);
    if (!verify) {
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
    title.textContent = proposal.title;
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
    a.textContent = proposal.title;
    let p = document.createElement('p');
    block.appendChild(p);
    p.textContent = proposal.description;
    p = document.createElement('p');
    block.appendChild(p);
    let button = document.createElement('button');
    if (type === 'referendum') {
      p = document.createElement('p');
      p.style.fontWeight = 'bold';
      p.textContent = proposal.question;
      block.appendChild(p);
      for (let answer of proposal.answers) {
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
          if (proposal.done || outdated || (proposal.judge === judge && !iAmEndorsedByJudge))
            disable(button);
          else
            enable(button);
        });
      }
    }
    let url = `https://nominatim.openstreetmap.org/ui/search.html?${proposal.areas.join('&')}&polygon_geojson=1`;
    p = document.createElement('p');
    let b = document.createElement('b');
    b.textContent = 'Area:';
    p.appendChild(b);
    a = document.createElement('a');
    a.classList.add('link', 'external');
    a.setAttribute('href', url);
    a.setAttribute('target', '_blank');
    a.textContent = proposal.areas[0].split('=')[1];
    p.appendChild(a);
    p = document.createElement('p');
    block.appendChild(p);
    b = document.createElement('b');
    b.textContent = 'Judge:';
    p.appendChild(b);
    a = document.createElement('a');
    a.classList.add('link', 'external');
    a.setAttribute('href', proposal.judge);
    a.setAttribute('target', '_blank');
    a.textContent = proposal.judge;
    p.appendChild(a);
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
      button.textContent = proposal.done ? 'Signed' : 'Sign';
      if (proposal.done || outdated || (proposal.judge === judge && !iAmEndorsedByJudge))
        disable(button);
      button.addEventListener('click', function() {
        app.dialog.confirm(
          'Your name and signature will be published to show publicly your support to this petition.',
          'Sign Petition?', function() {
            petitionSignature = {
              schema: `https://directdemocracy.vote/json-schema/${DIRECTDEMOCRACY_VERSION_MAJOR}/endorsement.schema.json`,
              key: citizen.key,
              signature: '',
              published: Math.trunc(new Date().getTime() / 1000),
              appKey: appKey,
              appSignature: '',
              endorsedSignature: proposal.signature
            };
            petitionButton = button;
            petitionProposal = proposal;
            Keystore.sign(PRIVATE_KEY_ALIAS, JSON.stringify(petitionSignature), publishPetitionSignature, keystoreFailure);
          });
      });
    } else { // referendum
      button.textContent = proposal.done ? 'Voted' : 'Vote';
      disable(button);
      button.addEventListener('click', function(event) {
        const answer = document.querySelector(`input[name="answer-${proposal.id}"]:checked`).value;
        app.dialog.confirm(
          `You are about to vote "${answer}" to this referendum. This cannot be changed after you cast your vote.`,
          'Vote?', async function() {
            // prepare the vote aimed at blind signature
            const ballotBytes = new Uint8Array(32);
            crypto.getRandomValues(ballotBytes);
            const randomNumber = new Uint8Array(1);
            crypto.getRandomValues(randomNumber);
            vote = {
              schema: '',
              referendum: proposal.signature,
              number: randomNumber[0], // FIXME: to be incremented for subsequent votes to the same referendum
              ballot: btoa(String.fromCharCode.apply(null, ballotBytes)),
              answer: answer
            };
            const referendumBytes = base64ToByteArray(vote.referendum);
            const numberBytes = int64ToUint8Array(vote.number);
            const answerBytes = new TextEncoder().encode(vote.answer);
            const l = referendumBytes.length + numberBytes.length + ballotBytes.length + answerBytes.length;
            voteBytes = new Uint8Array(l);
            let p = 0;
            voteBytes.set(referendumBytes);
            p += referendumBytes.length;
            voteBytes.set(numberBytes, p);
            p += numberBytes.length;
            voteBytes.set(ballotBytes, p);
            p += ballotBytes.length;
            voteBytes.set(answerBytes, p);
            p += answer.length;
            if (voteBytes.length !== p)
              console.error('vote length is wrong');
            const binaryAppKey = await importKey(appKey);
            const blind = await rsaBlind(binaryAppKey, voteBytes);
            blindInv = blind.inv;
            participationToPublish = {
              schema: `https://directdemocracy.vote/json-schema/${DIRECTDEMOCRACY_VERSION_MAJOR}/participation.schema.json`,
              key: citizen.key,
              signature: '',
              published: proposal.deadline,
              appKey: appKey,
              appSignature: '',
              referendum: proposal.signature,
              encryptedVote: btoa(String.fromCharCode(...blind.blindMessage))
            };
            Keystore.sign(PRIVATE_KEY_ALIAS, JSON.stringify(participationToPublish), publishParticipation, keystoreFailure);
          });
      });
    }
    let trashButton = document.createElement('button');
    grid.appendChild(trashButton);
    trashButton.classList.add('button', 'button-tonal');
    trashButton.innerHTML = '<i class="icon f7-icons" style="font-size:150%">trash</i>';
    trashButton.addEventListener('click', function() {
      const uppercaseType = type.charAt(0).toUpperCase() + type.slice(1);
      app.dialog.confirm(
        `This ${type} will be removed from your list, but you can fetch it again if needed.`,
        `Remove ${uppercaseType}?`, function() {
          document.getElementById(`${type}s`).removeChild(item);
          if (!proposal.done) { // actually remove it
            const index = proposals.indexOf(proposal);
            proposals.splice(index, 1);
            let i = 0;
            proposals.forEach(function(p) {
              p.id = i++;
            });
          } else { // remove useless fields, keep only done and signature
            delete proposal.id; // hidden
            delete proposal.published;
            delete proposal.participants;
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
    if (document.getElementById('register-picture').src === 'images/default-picture.png')
      return;
    if (document.getElementById('register-location').value === '')
      return;
    if (!document.getElementById('register-adult').checked)
      return;
    if (!document.getElementById('register-confirm').checked)
      return;

    enable('register-button');
  }

  function uploadPicture(event) {
    const sourceType = event.currentTarget === document.getElementById('register-camera-picture')
      ? Camera.PictureSourceType.CAMERA
      : Camera.PictureSourceType.PHOTOLIBRARY;
    function successCallback(imageData) {
      let content = {};
      content.innerHTML = `<div class="sheet-modal" style="height: 100%">
    <div class="toolbar" style="margin-top:16px">
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
            img.src = 'data:image/jpeg;base64,' + imageData;
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
    }
    function errorCallback(message) {
      // console.log('Cannot get picture: ' + message);
    }
    const options = {
      quality: 90,
      destinationType: Camera.DestinationType.DATA_URL,
      sourceType: sourceType,
      encodingType: Camera.EncodingType.JPEG,
      targetWidth: 1500,
      targetHeight: 2000,
      mediaType: Camera.MediaType.PICTURE,
      cameraDirection: Camera.Direction.BACK
    };
    navigator.camera.getPicture(successCallback, errorCallback, options);
  }
};

function updateProposalLink() {
  let proposal = document.getElementById('proposal');
  if (proposal)
    proposal.setAttribute('href', `${notary}/proposal.html?latitude=${citizen.latitude}&longitude=${citizen.longitude}`);
}

function updateSearchLinks() {
  document.getElementById('search-petition').setAttribute('href',
    `${notary}?tab=proposals&latitude=${citizen.latitude}&longitude=${citizen.longitude}`);
  document.getElementById('search-referendum').setAttribute('href',
    `${notary}?tab=proposals&latitude=${citizen.latitude}&longitude=${citizen.longitude}`);
}

function updateCitizenCard() {
  showPage('card');
  document.getElementById('citizen-picture').setAttribute('src', citizen.picture);
  document.getElementById('register-picture').setAttribute('src', citizen.picture);
  document.getElementById('citizen-given-names').textContent = citizen.givenNames;
  document.getElementById('register-given-names').value = citizen.givenNames;
  document.getElementById('citizen-family-name').textContent = citizen.familyName;
  document.getElementById('register-family-name').value = citizen.familyName;
  document.getElementById('citizen-coords').innerHTML =
    '<a class="link external" target="_blank" href="https://openstreetmap.org/?mlat=' +
    citizen.latitude + '&mlon=' + citizen.longitude + '&zoom=12">' +
    citizen.latitude + ', ' + citizen.longitude + '</a>';
  document.getElementById('register-location').value = citizen.latitude + ', ' + citizen.longitude;
  let published = new Date(citizen.published * 1000);
  document.getElementById('citizen-published').textContent = published.toISOString().slice(0, 10);
  citizenFingerprint = atob(localStorage.getItem('citizenFingerprint'));
  getReputationFromJudge();
  updateCitizenEndorsements();
}

function downloadCitizen() {
  fetch(`${notary}/api/citizen.php`, {
    method: 'POST',
    headers: {
      'directdemocracy-version': directDemocracyVersion,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: 'key=' + encodeURIComponent(localStorage.getItem('publicKey'))
  })
    .then((response) => response.json())
    .then((answer) => {
      if (answer.error)
        app.dialog.alert(answer.error + '.<br>Please try again.', 'Citizen Error');
      else {
        citizen = answer.citizen;
        citizen.key = localStorage.getItem('publicKey');
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
      const span = document.createElement('span');
      if (answer.error) {
        span.setAttribute('style', 'font-weight:bold;color:red');
        span.textContent = answer.error;
        reputation.innerHTML = '';
        reputation.appendChild(span);
        badge.classList.remove('color-blue');
        badge.classList.add('color-red');
      } else {
        iAmEndorsedByJudge = answer.endorsed;
        const color = answer.endorsed ? 'blue' : 'red';
        span.setAttribute('style', `font-weight:bold;color:${color}`);
        span.textContent = answer.reputation;
        reputation.innerHTML = '';
        reputation.appendChild(span);
        badge.classList.remove('color-red');
        badge.classList.remove('color-blue');
        badge.classList.add('color-' + color);
        updateProposals(petitions);
        updateProposals(referendums);
      }
    })
    .catch((error) => {
      app.dialog.alert(error, 'Could not get reputation from judge.');
    });
}

function updateProposals(proposals) {
  const type = (proposals === petitions) ? 'petition' : 'referendum';
  for (let proposal of proposals) {
    if (proposal.judge === judge) {
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
  if (citizenEndorsements.length === 0) {
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
  badge.textContent = endorsementCount;
  const plural = (citizenEndorsements.length > 1) ? 'endorsements' : 'endorsement';
  newElement(
    list,
    'div',
    'block-title no-margin-left no-margin-right',
    `${endorsementCount}/${citizenEndorsements.length} ${plural}`
  );
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
    message.style.fontSize = '82.353%';
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
    message.style.fontSize = '82.353%';
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
          disable(a);
          message.style.color = 'red';
          message.textContent = 'Revoking, please wait...';
          revocationToPublish = {
            schema: `https://directdemocracy.vote/json-schema/${DIRECTDEMOCRACY_VERSION_MAJOR}/endorsement.schema.json`,
            key: citizen.key,
            signature: '',
            published: Math.trunc(new Date().getTime() / 1000),
            appKey: appKey,
            appSignature: '',
            revoke: true,
            endorsedSignature: endorsement.signature
          };
          endorsementToRevoke = endorsement;
          Keystore.sign(PRIVATE_KEY_ALIAS, JSON.stringify(revocationToPublish), publishRevocation, keystoreFailure);
        }
        const text = '<p class="text-align-left">' +
          'You should revoke only a citizen who has moved or changed her citizen card. ' +
          'This might affect their ability to vote. Do you really want to revoke this citizen?' +
          `</p><p class="text-align-center"><b>${endorsement.givenNames}<br>${endorsement.familyName}</b></p><p>` +
          'Please type <b>I understand</b> here:' +
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
  badge.textContent = count;
  badge.style.display = (count === 0) ? 'none' : '';
}

// show either:
// 1. the register page when the citizen has not yet registered
// 2. the splash page when downloading registered citizen data
// 3. the card page once registered citizen data is available
// 4. the video scan page to get endorsed
function showPage(page) {
  const pages = ['splash', 'register', 'card'];
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

function newElement(parent, type, classes, textContent) {
  let element = document.createElement(type);
  if (parent)
    parent.appendChild(element);
  if (classes) {
    const classArray = classes.split(' ');
    classArray.forEach(function(c) {
      element.classList.add(c);
    });
  }
  if (typeof textContent !== 'undefined')
    element.textContent = textContent;
  return element;
}
