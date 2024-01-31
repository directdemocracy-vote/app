/* global Framework7, QRious, Keystore, L, Camera, Croppie, integrity, device, QRScanner */

import Translator from './translator.js';
import { rsaBlind, rsaUnblind } from './rsa-blind.js';
import { pointInPolygons } from './point-in-polygons.js';

const TESTING = false;

const DIRECTDEMOCRACY_VERSION_MAJOR = '2';
const DIRECTDEMOCRACY_VERSION_MINOR = '0';
const DIRECTDEMOCRACY_VERSION_BUILD = '51';
const DEBUGING = 1;

const TEST_APP_KEY = // public key of the test app
  'nRhEkRo47vT2Zm4Cquzavyh+S/yFksvZh1eV20bcg+YcCfwzNdvPRs+5WiEmE4eujuGPkkXG6u/DlmQXf2szMMUwGCkqJSPi6fa90pQKx81QHY8Ab4' +
  'z69PnvBjt8tt8L8+0NRGOpKkmswzaX4ON3iplBx46yEn00DQ9W2Qzl2EwaIPlYNhkEs24Rt5zQeGUxMGHy1eSR+mR4Ngqp1LXCyGxbXJ8B/B5hV4QI' +
  'or7U2raCVFSy7sNl080xNLuY0kjHCV+HN0h4EaRdR2FSw9vMyw5UJmWpCFHyQla42Eg1Fxwk9IkHhNe/WobOT1Jiy3Uxz9nUeoCQa5AONAXOaO2wtQ';
const PRODUCTION_APP_KEY = // public key of the genuine app
  DEBUGING ? TEST_APP_KEY
    : 'vD20QQ18u761ean1+zgqlDFo6H2Emw3mPmBxeU24x4o1M2tcGs+Q7G6xASRf4LmSdO1h67ZN0sy1tasNHH8Ik4CN63elBj4ELU70xZeYXIMxxxDqis' +
    'FgAXQO34lc2EFt+wKs+TNhf8CrDuexeIV5d4YxttwpYT/6Q2wrudTm5wjeK0VIdtXHNU5V01KaxlmoXny2asWIejcAfxHYSKFhzfmkXiVqFrQ5BHAf' +
    '+/ReYnfc+x7Owrm6E0N51vUHSxVyN/TCUoA02h5UsuvMKR4OtklZbsJjerwz+SjV7578H5FTh0E0sa7zYJuHaYqPevvwReXuggEsfytP/j2B3IgarQ';

const PRIVATE_KEY_ALIAS = 'DirectDemocracyApp';

let directDemocracyVersion =
  `${DIRECTDEMOCRACY_VERSION_MAJOR}.${DIRECTDEMOCRACY_VERSION_MINOR}.${DIRECTDEMOCRACY_VERSION_BUILD}`;
let appKey = '';
let languagePicker;
let homePageIsReady = false;
let translatorIsReady = false;
let challenge = '';
let challengeBytes = null;
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
let iAmTrustedByJudge = false;
let certificateToPublish = null;
let vote = null;
let voteBytes = null;
let blindInv = null;
let petitionButton = null;
let petitionProposal = null;
let referendumProposal = null;
let referendumButton = null;
let review = null;
let reviewMap = null;
let reviewMarker = null;
let petitions = [];
let referendums = [];
let previousSignature = null;
let reportComment = ''; // '', 'replaced', 'updated' or 'transferred'
let currentLatitude = 46.517493; // Lausanne
let currentLongitude = 6.629111;

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
    byteArray[7 - i] = byte;
    int64 = (int64 - byte) / 256;
  }
  return byteArray;
}

function byteArrayToFingerprint(byteArray) {
  let fingerprint = '';
  const hex = '0123456789abcdef';
  for (let i = 0; i < 20; i++) {
    const b = byteArray[i];
    fingerprint += hex[b >> 4] + hex[b & 15];
  }
  return fingerprint;
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

// Wait for Cordova to be initialized.
document.addEventListener('deviceready', onDeviceReady, false);

function keystoreFailure(e) {
  app.dialog.alert(e, 'Keystore failure');
}

function challengeResponse(type, id, key, signature) {
  fetch(`https://app.directdemocracy.vote/api/response.php?id=${id}&key=${encodeURIComponent(key)}&signature=${encodeURIComponent(signature)}`)
    .then(response => response.json())
    .then(async function(answer) {
      await challengeResponseHandler(answer, type, id, key, signature);
    });
}

async function challengeResponseHandler(answer, type, id, key, signature) {
  if (answer.error) {
    console.error(answer.error);
    return;
  }
  let otherKey = '';
  let otherSignature = '';
  let verify = false;
  for (const response of answer.response) {
    // verify that the challenge was correctly signed.
    otherKey = response['key'];
    otherSignature = response['signature'];
    const publicKey = await importKey(otherKey);
    let bytes = base64ToByteArray(otherSignature);
    const challengeArrayBuffer = new TextEncoder().encode(challenge);
    verify = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', publicKey, bytes, challengeArrayBuffer);
    if (verify)
      break;
    console.error('Cannot verify signature for challenge: ' + challenge);
  }
  if (!verify) {
    challengeResponse(type, id, key, signature);
    return;
  }
  // from here, I know the other guy by their key
  challenge = '';
  if (type === 'transfer challenge') {
    hide('qrcode');
    show('home');
    showPage('splash');
    app.dialog.preloader('Exporting...');
    transfer();
  } else if (type === 'endorse challenge')
    getCitizen(otherKey, 'key', '');
  else
    console.error('Unknown challenge: ' + type);
}

function transfer() {
  const fingerprint = byteArrayToFingerprint(base64ToByteArray(localStorage.getItem('citizenFingerprint')));
  fetch(`${notary}/api/transferred.php?fingerprint=${fingerprint}`)
    .then(response => response.json())
    .then(transferred);
}

function transferred(answer) {
  if (answer.error) {
    console.error(answer.error);
    return;
  }
  if (!answer.transferred)
    transfer();
  else {
    app.dialog.close(); // preloader
    app.dialog.alert('You successfully exported your citizen card.', 'Export Success');
    deleteCitizen();
  }
}

function deleteCitizen() {
  localStorage.removeItem('registered');
  localStorage.removeItem('citizenFingerprint');
  localStorage.removeItem('publicKey');
  localStorage.removeItem('referendums');
  localStorage.removeItem('petitions');
  endorsements = [];
  updateEndorsements();
  document.getElementById('register-given-names').value = '';
  document.getElementById('register-family-name').value = '';
  document.getElementById('register-picture').src = 'images/default-picture.png';
  document.getElementById('register-location').value = '';
  document.getElementById('register-adult').checked = false;
  document.getElementById('register-confirm').checked = false;
  showPage('splash');
  welcome();
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
        app.dialog.close(); // preloader
        if (answer.hasOwnProperty('error'))
          app.dialog.alert(`${answer.error}<br>Please try again.`, 'Publication Error');
        else {
          if (type === 'citizen card') {
            updateCitizenCard();
            app.dialog.alert(translator.translate('citizen-card-published'), translator.translate('congratulations'));
            localStorage.setItem('registered', true);
            enableDangerButtons();
            if (review) {
              hide('review');
              show('home');
              review = null;
            }
          } else if (type === 'endorse') {
            hide('review');
            show('home');
            document.getElementById('swiper-container').swiper.slideTo(1, 0, false); // show neighbor tab
            app.dialog.alert(`You successfully endorsed ${review.givenNames} ${review.familyName}`,
              'Endorsement Success', refreshEndorsements);
          } else if (type === 'petition signature') {
            app.dialog.alert(`You successfully signed the petition entitled "${petitionProposal.title}"`, 'Signed!');
            petitionButton.textContent = 'Signed';
            petitionProposal.signed = true;
            localStorage.setItem('petitions', JSON.stringify(petitions));
            disable(petitionButton);
          } else if (type === 'report') {
            const comment = certificateToPublish.comment;
            if (comment === 'deleted') {
              app.dialog.alert('You successfully deleted your citizen card.', 'Delete Success');
              deleteCitizen();
            } else if (comment.startsWith('revoked+')) {
              app.dialog.alert(`You successfully revoked ${review.givenNames} ${review.familyName}`,
                'Revoke Success', refreshEndorsements);
            } else { // report
              app.dialog.alert(`You successfully reported ${review.givenNames} ${review.familyName}`,
                'Report Success');
            }
          } else if (type === 'participation') {
            const binaryAppKey = await importKey(appKey);
            const blindSignature = base64ToByteArray(answer['blind_signature']);
            const signature = await rsaUnblind(binaryAppKey, voteBytes, blindSignature, blindInv);
            vote.appSignature = btoa(String.fromCharCode.apply(null, signature)).slice(0, -2);
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
                app.dialog.close(); // preloader
                if (answer.hasOwnProperty('error'))
                  app.dialog.alert(`${answer.error}<br>Please try again.`, 'Vote Error');
                else {
                  app.dialog.alert(`You successfully voted to the referendum entitled "${referendumProposal.title}"`, 'Voted!');
                  referendumButton.textContent = 'Re-vote';
                  if (referendumProposal.deadline * 1000 < new Date().getTime())
                    enable(referendumButton);
                  localStorage.setItem('referendums', JSON.stringify(referendums));
                }
              });
          } else if (type.endsWith(' challenge')) {
            app.dialog.close(); // preloader
            const code = 'app.directdemocracy.vote:' + answer['id'] + ':' + encodeBase128(challengeBytes);
            const qr = new QRious({ value: code, level: 'L', size: 1024, padding: 0 });
            document.getElementById('qrcode-image').src = qr.toDataURL();
            hide('home');
            show('qrcode');
            challengeResponse(type, answer['id'], publication.key, publication.signature);
          } else
            console.error('Unknown operation type: ' + type);
        }
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
  if (previousSignature) {
    certificateToPublish = {
      schema: `https://directdemocracy.vote/json-schema/${DIRECTDEMOCRACY_VERSION_MAJOR}/certificate.schema.json`,
      key: citizen.key,
      signature: '',
      published: Math.trunc(new Date().getTime() / 1000),
      appKey: appKey,
      appSignature: '',
      type: 'report',
      publication: previousSignature,
      comment: reportComment
    };
    reportComment = '';
    previousSignature = null;
    Keystore.sign(PRIVATE_KEY_ALIAS, JSON.stringify(certificateToPublish), publishCertificate, keystoreFailure);
  }
}

function publishCertificate(signature) {
  publish(certificateToPublish, signature, certificateToPublish.type);
}

function welcome() {
  let dialog = app.dialog.create({
    title: 'Welcome to directdemocracy!',
    text: 'This app will allow you to vote securely and anonymously. Is it your first time with directdemocracy?',
    buttons: [{
      text: 'No',
      onClick: function() {
        function importCitizen() {
          scan(function(error, contents) {
            scanQRCode(error, contents, 'challenge', 'transferred');
          });
        }
        function lost() {
          disableDangerButtons();
          showPage('me');
        }
        let dialog = app.dialog.create({
          title: 'Import Citizen Card',
          text: 'It is recommended to import your citizen card from the phone containing it. ' +
            'Do you have this phone on hand?',
          buttons: [{
            text: 'Yes',
            onClick: function() {
              app.dialog.confirm('On the phone containing your citizen card, ' +
                'go to the Settings in the Danger Zone, click the "Export Citizen Card" button and ' +
                'following the instructions. Then, press OK to scan the export QR code.',
                'Import Citizen Card', importCitizen, welcome);
            }
          }, {
            text: 'No',
            onClick: function() {
              app.dialog.confirm('If you lost access to your citizen card, ' +
                'you will have to search your current citizen card from a notary database ' +
                'and scan its QR code (or copy/paste its reference). ' +
                'Then, you will have to get endorsed again by your neighbors.',
                'Lost Citizen Card', lost, welcome);
            }
          }, {
            text: 'Cancel',
            onClick: welcome
          }]
        });
        dialog.open();
      }
    }, {
      text: 'Yes',
      onClick: function() {
        app.dialog.confirm('The first step to become a citizen of directdemocracy is to create your citizen card.',
          'Become a Citizen', function() {
            showPage('register');
            disableDangerButtons();
          }, welcome);
      }
    }]
  });
  dialog.open();
}

function updateChecksDisplay(comment) {
  const reviewConfirm = document.getElementById('review-confirm');
  const reviewCancel = document.getElementById('review-cancel');
  let title, confirm, warning, checks;
  let cancel = 'Cancel';
  if (comment === 'replaced') {
    title = 'Replace Your Citizen Card';
    confirm = 'Replace';
    warning = 'Warning: a wrong replacement may affect your reputation.';
    checks = ['former'];
    reviewCancel.classList.add('color-red');
    reviewConfirm.classList.remove('color-red');
  } else if (comment === 'transferred') {
    title = 'Import Your Citizen Card';
    confirm = 'Import';
    warning = 'Warning: a wrong import may affect your reputation';
    checks = ['former'];
    reviewCancel.classList.add('color-red');
    reviewConfirm.classList.remove('color-red');
  } else if (comment === 'revoked') {
    title = 'Revoke a Neighbor';
    confirm = 'Revoke';
    warning = 'Warning: a wrong revoke may affect your reputation';
    checks = ['outdated', 'renamed', 'moved', 'died'];
    reviewCancel.classList.remove('color-red');
    reviewConfirm.classList.add('color-red');
  } else if (comment.startsWith('revoked+')) { // already revoked
    title = 'Review a Neighbor';
    confirm = '';
    warning = 'You already revoked this neighbor (';
    if (comment.search('address') !== -1)
      warning += 'moved, ';
    if (comment.search('name') !== -1)
      warning += 'renamed, ';
    if (comment.search('picture') !== -1)
      warning += 'outdated picture, ';
    if (comment.search('died') !== -1)
      warning += 'died, ';
    warning = warning.slice(0, -2) + ')';
    checks = [];
    cancel = 'Close';
    reviewCancel.classList.remove('color-red');
  } else if (comment === 'reported') {
    title = 'Report a Neighborg';
    confirm = 'Report';
    warning = 'Warning: a wrong report may affect your reputation';
    checks = ['report_ghost', 'report_duplicate', 'report_dead', 'report_address', 'report_name', 'report_picture',
      'report_other'];
    reviewCancel.classList.remove('color-red');
    reviewConfirm.classList.add('color-red');
  } else if (comment === '') {
    title = 'Endorse a Neighbor';
    confirm = 'Endorse';
    warning = 'Warning: a wrong endorsement may affect your reputation';
    checks = ['standing', 'adult', 'picture', 'name', 'coords'];
    reviewCancel.classList.add('color-red');
    reviewConfirm.classList.remove('color-red');
  } else
    console.error('Unsupported comment in citizen review:"' + comment + '"');
  if (confirm === '')
    reviewConfirm.classList.add('display-none');
  else
    reviewConfirm.classList.remove('display-none');
  reviewConfirm.textContent = confirm;
  reviewCancel.textContent = cancel;
  document.getElementById('review-title').textContent = title;
  document.getElementById('review-warning').textContent = warning;
  const children = document.getElementById('review-checklist').children;
  for (let i = 0; i < children.length; i++) {
    const item = children[i];
    const check = item.id.split('-')[1];
    document.getElementById(`review-${check}-check`).checked = false;
    if (checks.includes(check))
      item.classList.remove('display-none');
    else
      item.classList.add('display-none');
  }
}

// comment may be either '' (endorse), 'replaced', 'transferred', 'revoked', 'revoked+...' (already revoked) or 'reported'
function reviewCitizen(publication, comment) {
  updateChecksDisplay(comment);
  disable('review-confirm');
  document.getElementById('review-online').setAttribute('href',
    `${notary}/citizen.html?signature=${encodeURIComponent(publication.signature)}`);
  document.getElementById('review-picture').src = publication.picture;
  document.getElementById('review-given-names').textContent = publication.givenNames;
  document.getElementById('review-family-name').textContent = publication.familyName;
  document.getElementById('review-coords').textContent = publication.latitude + ', ' + publication.longitude;
  const published = new Date(publication.published * 1000);
  document.getElementById('review-published').textContent = published.toISOString().slice(0, 10);
  document.getElementById('review-reputation').textContent = '...';
  const lat = publication.latitude;
  const lon = publication.longitude;
  if (reviewMap == null) {
    reviewMap = L.map('review-map', { dragging: false });
    reviewMap.whenReady(function() { setTimeout(() => { this.invalidateSize(); }, 0); });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://openstreetmap.org/copyright">OpenStreetMap</a>'
    }).addTo(reviewMap);
    reviewMarker = L.marker([lat, lon]).addTo(reviewMap);
  } else
    reviewMarker.setLatLng([lat, lon]);
  reviewMarker.bindPopup(lat + ', ' + lon);
  reviewMap.setView([lat, lon], 18);
  reviewMap.on('contextmenu', function(event) {
    return false;
  });
  const reputation = document.getElementById('review-reputation');
  fetch(`${judge}/api/reputation.php?key=${encodeURIComponent(publication.key)}`)
    .then(response => response.json())
    .then(answer => {
      if (answer.error) {
        app.dialog.alert(answer.error, 'Could not get reputation from judge.');
        reputation.textContent = 'N/A';
        reputation.style.color = 'red';
      } else {
        reputation.textContent = answer.reputation;
        reputation.style.color = answer.trusted ? 'blue' : 'red';
      }
    })
    .catch((error) => {
      app.dialog.alert(error, 'Failed to get reputation from judge.');
      reputation.textContent = 'N/A';
      reputation.style.color = 'red';
    });
  fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=12`)
    .then(response => response.json())
    .then(answer => {
      const address = answer.display_name;
      reviewMarker.setPopupContent(
        `${address}<br><br><center style="color:#999">(${lat}, ${lon})</center>`).openPopup();
    });
  review = publication;
  reportComment = comment;
  hide('home');
  show('review');
  document.getElementById('review-page').scrollTop = 0;
}

async function getCitizen(reference, type, comment) {
  app.dialog.preloader('Getting Citizen...');
  if (type !== 'fingerprint' && type !== 'key') {
    console.error('wrong citizen reference: ' + type);
    return;
  }
  const parameter = (type === 'key') ? `key=${encodeURIComponent(reference)}` : `fingerprint=${reference}`;
  fetch(`${notary}/api/publication.php?${parameter}`)
    .then(response => response.json())
    .then(async publication => {
      app.dialog.close(); // preloader
      document.getElementById('enter-me').value = '';
      enable('scan-me');
      enable('enter-me');
      if (publication.error) {
        app.dialog.alert(publication.error, 'Citizen search error');
        return;
      }
      if (type === 'fingerprint') {
        const sha1Bytes = await crypto.subtle.digest('SHA-1', base64ToByteArray(publication.signature + '=='));
        const sha1 = Array.from(new Uint8Array(sha1Bytes), byte => ('0' + (byte & 0xFF).toString(16)).slice(-2)).join('');
        if (reference !== sha1) {
          app.dialog.alert('Fingerprint mismatch.', 'Cititen search error');
          return;
        }
      } else if (reference !== publication.key) {
        app.dialog.alert('Key mismatch.', 'Citizen search error');
        return;
      }
      const signature = publication.signature;
      const appSignature = publication.appSignature;
      publication.appSignature = '';
      publication.signature = '';
      let publicKey = await importKey(publication.key);
      let buffer = new TextEncoder().encode(JSON.stringify(publication));
      let verify = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', publicKey, base64ToByteArray(signature), buffer);
      if (!verify) {
        app.dialog.alert('Failed to verify citizen signature', 'Citizen search error');
        console.log(publication);
        return;
      }
      publication.signature = signature;
      publicKey = await importKey(publication.appKey);
      buffer = new TextEncoder().encode(signature);
      verify = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', publicKey, base64ToByteArray(appSignature), buffer);
      if (!verify) {
        app.dialog.alert('Failed to verify app signature', 'Citizen search error');
        return;
      }
      reviewCitizen(publication, comment);
    });
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
  title.textContent = proposal.areaName[0].split('=')[1] + ' (' + (proposal.id + 1) + ')';
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
      const d = document.createElement('div');
      block.appendChild(d);
      const label = document.createElement('label');
      d.appendChild(label);
      label.classList.add('checkbox', 'no-ripple', 'display-inline-flex', 'align-items-center', 'margin-bottom-half');
      const input = document.createElement('input');
      label.appendChild(input);
      input.setAttribute('type', 'checkbox');
      input.setAttribute('name', `answer-${proposal.id}`);
      input.setAttribute('value', answer);
      const i = document.createElement('i');
      i.classList.add('margin-right-half', 'icon-checkbox');
      label.appendChild(i);
      const div = document.createElement('div');
      label.appendChild(div);
      div.appendChild(document.createTextNode(answer));
      input.addEventListener('change', function(event) {
        if (event.currentTarget.checked) {
          const block = event.currentTarget.parentNode.parentNode.parentNode;
          const inputs = block.querySelectorAll('input');
          for (let i = 0; i < inputs.length; i++) {
            if (inputs[i] === event.currentTarget)
              continue;
            if (inputs[i].checked)
              inputs[i].checked = false;
          }
        }
        if (outdated || (proposal.judge === judge && !iAmTrustedByJudge))
          disable(button);
        else
          enable(button);
      });
    }
  }
  let url = `https://nominatim.openstreetmap.org/ui/search.html?${proposal.areaName.join('&')}&polygon_geojson=1`;
  p = document.createElement('p');
  block.appendChild(p);
  let b = document.createElement('b');
  b.textContent = 'Area: ';
  p.appendChild(b);
  a = document.createElement('a');
  a.classList.add('link', 'external');
  a.setAttribute('href', url);
  a.setAttribute('target', '_blank');
  a.textContent = proposal.areaName[0].split('=')[1];
  p.appendChild(a);
  p = document.createElement('p');
  block.appendChild(p);
  b = document.createElement('b');
  b.textContent = 'Judge: ';
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
  p.innerHTML = `<b>Deadline:</b> <span${outdated ? ' style="color:red"' : ''}>${deadline}</span>`;
  let grid = document.createElement('div');
  block.appendChild(grid);
  grid.classList.add('grid', 'grid-cols-2', 'grid-gap');
  grid.appendChild(button);
  button.classList.add('button', 'button-fill');
  if (type === 'petition') {
    button.textContent = proposal.signed ? 'Signed' : 'Sign';
    if (proposal.signed || outdated || (proposal.judge === judge && !iAmTrustedByJudge))
      disable(button);
    button.addEventListener('click', function() {
      app.dialog.confirm(
        'Your name and signature will be published to show publicly your support to this petition.',
        'Sign Petition?', async function() {
          disable(button);
          app.dialog.preloader('Signing...');
          if (await getGreenLightFromJudge(proposal.judge, proposal.key, proposal.deadline, 'petition') === false) {
            enable(button);
            return;
          }
          const petitionSignature = {
            schema: `https://directdemocracy.vote/json-schema/${DIRECTDEMOCRACY_VERSION_MAJOR}/certificate.schema.json`,
            key: citizen.key,
            signature: '',
            published: Math.trunc(new Date().getTime() / 1000),
            appKey: appKey,
            appSignature: '',
            type: 'sign',
            publication: proposal.signature
          };
          petitionButton = button;
          petitionProposal = proposal;
          Keystore.sign(PRIVATE_KEY_ALIAS, JSON.stringify(petitionSignature), function(signature) {
            publish(petitionSignature, signature, 'petition signature');
          }, keystoreFailure);
        });
    });
  } else { // referendum
    button.textContent = proposal.ballot === null ? 'Vote' : 'Re-vote';
    if (outdated || (proposal.judge === judge && !iAmTrustedByJudge))
      disable(button);
    button.addEventListener('click', function(event) {
      const checked = document.querySelector(`input[name="answer-${proposal.id}"]:checked`);
      const answer = checked ? checked.value : '';
      const text = (checked ? `You are about to vote "${answer}" to this referendum. `
        : 'You are about to abstain to vote to this referendum. ' +
        'Your vote will be counted as an abstention in the results. ') +
        'You will be able to change your vote until the deadline of the referendum.';
      app.dialog.confirm(text, 'Vote?', async function() {
        // prepare the vote aimed at blind signature
        disable(button);
        app.dialog.preloader('Voting...');
        const greenLight = await getGreenLightFromJudge(proposal.judge, proposal.key, proposal.deadline, 'referendum');
        if (greenLight === false) {
          enable(button);
          return;
        }
        let ballotBytes;
        if (proposal.ballot === null) {
          ballotBytes = new Uint8Array(32);
          crypto.getRandomValues(ballotBytes);
          proposal.ballot = btoa(String.fromCharCode.apply(null, ballotBytes));
        } else
          ballotBytes = base64ToByteArray(proposal.ballot);

        const randomNumber = new Uint8Array(1);
        crypto.getRandomValues(randomNumber);
        proposal.number += randomNumber[0];
        proposal.answer = answer;
        vote = {
          referendum: proposal.signature,
          number: proposal.number,
          ballot: proposal.ballot,
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
        const participationToPublish = {
          schema: `https://directdemocracy.vote/json-schema/${DIRECTDEMOCRACY_VERSION_MAJOR}/participation.schema.json`,
          key: citizen.key,
          signature: '',
          published: proposal.deadline,
          appKey: appKey,
          appSignature: '',
          referendum: proposal.signature,
          encryptedVote: btoa(String.fromCharCode(...blind.blindMessage))
        };
        referendumButton = button;
        referendumProposal = proposal;
        Keystore.sign(PRIVATE_KEY_ALIAS, JSON.stringify(participationToPublish), function(signature) {
          publish(participationToPublish, signature, 'participation');
        }, keystoreFailure);
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
        if ((!proposal.secret && !proposal.signed) || (proposal.secret && proposal.ballot === null)) { // actually remove it
          const index = proposals.indexOf(proposal);
          proposals.splice(index, 1);
          let i = 0;
          proposals.forEach(function(p) {
            p.id = i++;
          });
        } else { // remove useless fields, keep only signature, signed, number, ballot and answer
          delete proposal.id; // hidden
          delete proposal.key;
          delete proposal.published;
          delete proposal.participants;
          delete proposal.title;
          delete proposal.description;
          delete proposal.areaName;
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

async function verifyProposalSignature(proposal) {
  if (proposal.schema !== `https://directdemocracy.vote/json-schema/${DIRECTDEMOCRACY_VERSION_MAJOR}/proposal.schema.json`) {
    app.dialog.alert('This document is not a valid proposal.', 'Wrong proposal');
    return false;
  }
  let p = {
    schema: proposal.schema,
    key: proposal.key,
    signature: '',
    published: proposal.published,
    area: proposal.area,
    title: proposal.title,
    description: proposal.description
  };
  if (proposal.question)
    p.question = proposal.question;
  if (proposal.answers) {
    p.answers = proposal.answers;
    p.answers.pop(); // remove the last one which is empty (abstention)
  }
  p.type = proposal.type;
  p.secret = proposal.secret;
  p.deadline = proposal.deadline;
  if (proposal.website)
    p.website = proposal.website;
  p.trust = proposal.trust;
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
  let a = {
    schema: `https://directdemocracy.vote/json-schema/${DIRECTDEMOCRACY_VERSION_MAJOR}/area.schema.json`,
    key: proposal.areaKey,
    signature: '',
    published: proposal.areaPublished,
    id: proposal.area,
    name: proposal.areaName,
    polygons: proposal.areaPolygons,
    local: proposal.areaLocal
  };
  const areaPublicKey = await importKey(proposal.areaKey);
  if (!areaPublicKey)
    console.error('Failed to import public key for area');
  const areaBytes = base64ToByteArray(proposal.areaSignature);
  const areaPacketArrayBuffer = new TextEncoder().encode(JSON.stringify(a));
  const areaVerify = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', areaPublicKey, areaBytes, areaPacketArrayBuffer);
  if (!areaVerify) {
    console.log(JSON.stringify(a));
    app.dialog.alert('Cannot verify the signature of the area of this proposal', 'Wrong area signature');
    return false;
  }
  if (proposal.areaKey !== proposal.key) {
    app.dialog.alert('Proposal and area key mismeatch', 'Wrong proposal or area');
    return false;
  }
  return true;
}

async function getProposal(fingerprint, type) {
  const item = type.charAt(0).toUpperCase() + type.slice(1);
  app.dialog.preloader(`Getting ${item}...`);
  fetch(`${notary}/api/proposal.php?fingerprint=${fingerprint}`)
    .then(response => response.json())
    .then(async proposal => {
      app.dialog.close(); // preloader
      enable(`scan-${type}`);
      enable(`enter-${type}`);
      if (proposal.error) {
        app.dialog.alert(proposal.error, 'Proposal search error');
        return;
      }
      const sha1Bytes = await crypto.subtle.digest('SHA-1', base64ToByteArray(proposal.signature + '=='));
      const sha1 = Array.from(new Uint8Array(sha1Bytes), byte => ('0' + (byte & 0xFF).toString(16)).slice(-2)).join('');
      if (fingerprint !== sha1) {
        app.dialog.alert('Fingerprint mismatch.', 'Proposal search error');
        return;
      }
      if (!await verifyProposalSignature(proposal))
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
      } else if (!pointInPolygons([citizen.longitude, citizen.latitude], proposal.areaPolygons)) {
        const message = (type === 'petition')
          ? `You are not inside the area of this petition (which is <i>${proposal.areaName[0].split('=')[1]}</i>). ` +
          'Therefore you cannot sign it.'
          : `You are not inside the area of this referendum (which is <i>${proposal.areaName[0].split('=')[1]}</i>). ` +
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
            } else { // already there, insert at position 0 and restore the missing fields
              p.id = 0;
              let i = 0;
              for (let p2 of proposals)
                p2.id = i++;
              p.key = proposal.key;
              p.title = proposal.title;
              p.description = proposal.description;
              p.areaName = proposal.areaName;
              p.deadline = proposal.deadline;
              p.corpus = proposal.corpus;
              p.participation = proposal.participation;
              p.published = proposal.published;
              p.judge = proposal.judge;
              if (proposal.website !== '')
                p.website = proposal.website;
              if (proposal.secret) {
                p.question = proposal.question;
                p.answers = proposal.answers;
              }
              addProposal(p, type, true);
            }
            already = true;
            break;
          }
        }
        if (!already) { // move proposals id by one
          let i = 1;
          proposals.forEach(function(p) {
            let e = document.getElementById(`${type}-${p.id}`);
            if (e) {
              p.id = i++;
              e.setAttribute('id', p.id);
            }
          });
          delete proposal.schema;
          delete proposal.area;
          delete proposal.areaKey;
          delete proposal.areaPolygons;
          delete proposal.areaPublished;
          if (proposal.question === '')
            delete proposal.question;
          if (proposal.answer === '')
            delete proposal.answers;
          if (proposal.website === '')
            delete proposal.website;
          if (proposal.secret) {
            proposal.number = 0;
            proposal.ballot = null;
            proposal.answer = null;
          } else
            proposal.signed = false;
          proposal.id = 0; // preprend new proposal at id 0
          proposals.unshift(proposal);
          addProposal(proposal, type, true);
        }
        localStorage.setItem(`${type}s`, JSON.stringify(proposals));
      }
    });
}

function stopScanner(page) {
  hide('scanner');
  show(page);
  QRScanner.hide(function(status) {
    QRScanner.destroy(function(status) {
    });
  });
}

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

function sendChallenge(otherAppUrl, challengeId, key, signature, comment) {
  const sig = signature.slice(0, -2);
  fetch(`https://${otherAppUrl}/api/challenge.php?id=${challengeId}&key=${encodeURIComponent(key)}&signature=${encodeURIComponent(sig)}`)
    .then(response => response.json())
    .then(async answer => {
      if (answer.error) {
        console.error(answer.error);
        app.dialog.alert(answer.error + '.<br>Please try again.', 'Challenge Error', function() {
          scan(function(error, contents) {
            scanQRCode(error, contents, 'challenge', comment);
          });
        });
        return;
      }
      const key = answer['key']; // FIXME: check key format
      const signature = answer['signature']; // FIXME: check signature format
      const publicKey = await importKey(key);
      let bytes = base64ToByteArray(signature);
      const challengeArrayBuffer = new TextEncoder().encode(challenge);
      challenge = '';
      let verify = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', publicKey, bytes, challengeArrayBuffer);
      if (!verify) {
        app.dialog.alert('Cannot verify challenge signature', 'Error verifying challenge');
        return;
      }
      getCitizen(key, 'key', comment);
    });
}

async function scanQRCode(error, contents, type, comment = '') {
  stopScanner('home');
  if (type !== 'challenge') {
    show(`${type}-page`);
    enable(`scan-${type}`);
    enable(`enter-${type}`);
  }
  if (error) {
    if (error.name !== 'SCAN_CANCELED')
      alert(error._message);
    if (type === 'challenge' && !localStorage.getItem('registered'))
      welcome();
    return;
  }
  if (type === 'challenge') { // transfer or endorse
    const contentsArray = contents.split(':');
    const otherAppUrl = contentsArray[0];
    const challengeId = parseInt(contentsArray[1]);
    challenge = contentsArray[2];

    if (otherAppUrl !== 'app.directdemocracy.vote') {
      app.dialog.alert(`Importing a citizen card from app "{$otherAppUrl}" is not supported by your app`, 'Unsupported App');
      return;
    }
    if (comment === 'transferred') { // generate a key and sign the challenge
      const k = await crypto.subtle.generateKey({
        name: 'RSASSA-PKCS1-v1_5',
        modulusLength: 2048,
        publicExponent: new Uint8Array([0x01, 0x00, 0x01]),
        hash: 'SHA-256'
      },
        true, ['sign']);
      const exported = await crypto.subtle.exportKey('spki', k.publicKey);
      const key = btoa(String.fromCharCode.apply(null, new Uint8Array(exported))).slice(44, -6);
      challengeBytes = decodeBase128(challenge);
      const challengeArrayBuffer = new TextEncoder().encode(challenge);
      const s = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', k.privateKey, challengeArrayBuffer);
      const signature = btoa(String.fromCharCode.apply(null, new Uint8Array(s)));
      sendChallenge(otherAppUrl, challengeId, key, signature, comment);
    } else { // endorse with own key
      Keystore.sign(PRIVATE_KEY_ALIAS, challenge, function(signature) {
        sendChallenge(otherAppUrl, challengeId, citizen.key, signature, comment);
      }, keystoreFailure);
    }
  } else {
    const fingerprint = byteArrayToFingerprint(decodeBase128(contents));
    if (type === 'me')
      getCitizen(fingerprint, 'fingerprint', 'replaced');
    else if (type === 'neighbor')
      getCitizen(fingerprint, 'fingerprint', 'reported');
    else
      getProposal(fingerprint, type);
  }
}

function onDeviceReady() {
  directDemocracyVersion += ` (${device.platform})`;
  document.getElementById('version').textContent = `version ${directDemocracyVersion}`;
  appKey = (device.isVirtual || TESTING) ? TEST_APP_KEY : PRODUCTION_APP_KEY;
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
  showPage('splash');
  if (!localStorage.getItem('registered'))
    welcome();
  else
    downloadCitizen();

  function iUnderstandDialog(message, title, callback) {
    const iUnderstand = 'I understand';
    const iUnderstandBold = `<b>${iUnderstand}</b>`;
    const pleaseType = `Please type ${iUnderstandBold} here:`;
    const text = `<p class="text-align-left">${message}</p><p>${pleaseType}</p>`;
    app.dialog.create({
      title,
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
          callback();
      },
      on: {
        open: function(d) {
          let input = d.$el.find('.dialog-input')[0];
          let okButton = d.$el.find('.dialog-button')[1];
          disable(okButton);
          input.addEventListener('input', function(event) {
            if (event.target.value === iUnderstand)
              enable(okButton);
            else
              disable(okButton);
          });
          input.addEventListener('change', function(event) {
            if (event.target.value === iUnderstand) {
              d.close();
              callback();
            }
          });
        }
      }
    }).open();
  }

  document.getElementById('update').addEventListener('click', function(event) {
    function updateCard() {
      previousSignature = citizen.signature;
      reportComment = 'updated';
      const button = document.getElementById('register-button');
      button.textContent = 'Update';
      disable(button);
      document.getElementById('tab-me-title').textContent = 'Update Citizen Card';
      document.getElementById('register-given-names').value = citizen.givenNames;
      document.getElementById('register-family-name').value = citizen.familyName;
      document.getElementById('register-picture').src = citizen.picture;
      document.getElementById('register-location').value = citizen.latitude + ', ' + citizen.longitude;
      document.getElementById('register-adult').checked = true;
      document.getElementById('register-confirm').checked = false;
      showPage('register');
      disableDangerButtons();
    }
    if (endorsements.length > 0) {
      iUnderstandDialog('Updating your citizen card is needed only if you move or need to change your name (got married?). ' +
        "Your referendum and petition lists will be emptied so you won't be able to change any vote that you already cast. " +
        'Also, you will loose your endorsements and have to get endorsed again to be able to vote and sign again. ' +
        'Note that your updated citizen card should still refer to you and not to someone else. ' +
        'Do you really want to update your citizen card?',
        'Update Citizen Card?', updateCard);
    } else
      updateCard();
  });

  document.getElementById('export').addEventListener('click', function(event) {
    function exportCard() {
      app.dialog.preloader('Preparing QR Code...');
      challengeBytes = new Uint8Array(20);
      crypto.getRandomValues(challengeBytes);
      challenge = encodeBase128(challengeBytes);
      document.getElementById('qrcode-message').textContent = 'Scan this code';
      Keystore.sign(PRIVATE_KEY_ALIAS, challenge, function(signature) {
        publish({ key: citizen.key, signature: '', appKey: appKey }, signature, 'transfer challenge');
      }, keystoreFailure);
    }
    app.dialog.confirm('If you export your citizen card to another phone, it will be deleted from this phone. ' +
      'You need to have another phone on which you installed the directdemocracy app and deleted any citizen card from it. ' +
      'On this other phone, follow the instructions of the initial setup dialog to import your citizen card. ' +
      'Then, press OK to display the export QR code.',
      'Export Citizen Card?', exportCard);
  });

  document.getElementById('delete').addEventListener('click', function(event) {
    function deleteCard() {
      app.dialog.preloader('Deleting...');
      certificateToPublish = {
        schema: `https://directdemocracy.vote/json-schema/${DIRECTDEMOCRACY_VERSION_MAJOR}/certificate.schema.json`,
        key: citizen.key,
        signature: '',
        published: Math.trunc(new Date().getTime() / 1000),
        appKey: appKey,
        appSignature: '',
        type: 'report',
        publication: citizen.signature,
        comment: 'deleted'
      };
      Keystore.sign(PRIVATE_KEY_ALIAS, JSON.stringify(certificateToPublish), publishCertificate, keystoreFailure);
    }
    app.dialog.confirm("You should not delete your citizen card unless you don't want to be a citizen any more. " +
      'If possible, you should rather update it or transfer it to another phone. ' +
      'Are you sure want to delete your citizen card? There is no way back!',
      'Delete Citizen Card?', deleteCard);
  });

  document.getElementById('review-former-check').addEventListener('click', function(event) {
    if (event.currentTarget.checked)
      enable('review-confirm');
    else
      disable('review-confirm');
  });

  function endorsementChecks() {
    if (document.getElementById('review-standing-check').checked &&
      document.getElementById('review-adult-check').checked &&
      document.getElementById('review-picture-check').checked &&
      document.getElementById('review-name-check').checked &&
      document.getElementById('review-coords-check').checked)
      enable('review-confirm');
    else
      disable('review-confirm');
  }
  document.getElementById('review-standing-check').addEventListener('click', endorsementChecks);
  document.getElementById('review-adult-check').addEventListener('click', endorsementChecks);
  document.getElementById('review-picture-check').addEventListener('click', endorsementChecks);
  document.getElementById('review-name-check').addEventListener('click', endorsementChecks);
  document.getElementById('review-coords-check').addEventListener('click', endorsementChecks);

  function revokeChecks(event) {
    const died = document.getElementById('review-died-check');
    const moved = document.getElementById('review-moved-check');
    const renamed = document.getElementById('review-renamed-check');
    const outdated = document.getElementById('review-outdated-check');
    if (event.currentTarget === died && died.checked) {
      moved.checked = false;
      renamed.checked = false;
      outdated.checked = false;
    } else if (moved.checked || renamed.checked || outdated.checked)
      died.checked = false;
    if (moved.checked || renamed.checked || outdated.checked || died.checked)
      enable('review-confirm');
    else
      disable('review-confirm');
  }
  document.getElementById('review-moved-check').addEventListener('click', revokeChecks);
  document.getElementById('review-renamed-check').addEventListener('click', revokeChecks);
  document.getElementById('review-outdated-check').addEventListener('click', revokeChecks);
  document.getElementById('review-died-check').addEventListener('click', revokeChecks);

  function reportChecks(event) {
    const ghost = document.getElementById('review-report_ghost-check');
    const duplicate = document.getElementById('review-report_duplicate-check');
    const dead = document.getElementById('review-report_dead-check');
    const address = document.getElementById('review-report_address-check');
    const name = document.getElementById('review-report_name-check');
    const picture = document.getElementById('review-report_picture-check');
    const other = document.getElementById('review-report_other-check');
    const input = document.getElementById('review-report_other-input');
    if (event.currentTarget === ghost && ghost.checked) {
      duplicate.checked = false;
      dead.checked = false;
      address.checked = false;
      name.checked = false;
      picture.checked = false;
      other.checked = false;
    } else if (event.currentTarget === duplicate && duplicate.checked) {
      ghost.checked = false;
      dead.checked = false;
      address.checked = false;
      name.checked = false;
      picture.checked = false;
      other.checked = false;
    } else if (event.currentTarget === dead && dead.checked) {
      ghost.checked = false;
      duplicate.checked = false;
      address.checked = false;
      name.checked = false;
      picture.checked = false;
      other.checked = false;
    } else if (event.currentTarget === other && other.checked) {
      ghost.checked = false;
      duplicate.checked = false;
      dead.checked = false;
      address.checked = false;
      name.checked = false;
      picture.checked = false;
      input.focus();
    } else if (address.checked || name.checked || picture.checked) {
      ghost.checked = false;
      duplicate.checked = false;
      dead.checked = false;
      other.checked = false;
    }
    if (ghost.checked || duplicate.checked || dead.checked ||
      address.checked || name.checked || picture.checked ||
      (other.checked && input.value.trim() !== ''))
      enable('review-confirm');
    else
      disable('review-confirm');
  }
  document.getElementById('review-report_ghost-check').addEventListener('click', reportChecks);
  document.getElementById('review-report_duplicate-check').addEventListener('click', reportChecks);
  document.getElementById('review-report_dead-check').addEventListener('click', reportChecks);
  document.getElementById('review-report_address-check').addEventListener('click', reportChecks);
  document.getElementById('review-report_name-check').addEventListener('click', reportChecks);
  document.getElementById('review-report_picture-check').addEventListener('click', reportChecks);
  document.getElementById('review-report_other-check').addEventListener('click', reportChecks);
  document.getElementById('review-report_other-input').addEventListener('input', reportChecks);

  document.getElementById('review-cancel').addEventListener('click', function(event) {
    hide('review');
    show('home');
    reportComment = '';
    review = null;
  });

  document.getElementById('review-confirm').addEventListener('click', function(event) {
    if (reportComment === '') { // endorse
      app.dialog.preloader('Endorsing...');
      certificateToPublish = {
        schema: `https://directdemocracy.vote/json-schema/${DIRECTDEMOCRACY_VERSION_MAJOR}/certificate.schema.json`,
        key: citizen.key,
        signature: '',
        published: Math.trunc(new Date().getTime() / 1000),
        appKey: appKey,
        appSignature: '',
        type: 'endorse',
        publication: review.signature
      };
      Keystore.sign(PRIVATE_KEY_ALIAS, JSON.stringify(certificateToPublish), publishCertificate, keystoreFailure);
    } else if (reportComment === 'revoked') {
      app.dialog.confirm('Revoking a neighbor may impact their reputation, are you sure you want to proceed?',
        'Revoke Neighbor?', function() {
          app.dialog.preloader('Revoking...');
          if (document.getElementById('review-died-check').checked)
            reportComment += '+died';
          else {
            if (document.getElementById('review-moved-check').checked)
              reportComment += '+address';
            if (document.getElementById('review-renamed-check').checked)
              reportComment += '+name';
            if (document.getElementById('review-outdated-check').checked)
              reportComment += '+picture';
          }
          certificateToPublish = {
            schema: `https://directdemocracy.vote/json-schema/${DIRECTDEMOCRACY_VERSION_MAJOR}/certificate.schema.json`,
            key: citizen.key,
            signature: '',
            published: Math.trunc(new Date().getTime() / 1000),
            appKey: appKey,
            appSignature: '',
            type: 'report',
            publication: review.signature,
            comment: reportComment
          };
          reportComment = '';
          Keystore.sign(PRIVATE_KEY_ALIAS, JSON.stringify(certificateToPublish), publishCertificate, keystoreFailure);
        });
    } else if (reportComment === 'reported') {
      app.dialog.confirm('Reporting a neighbor may impact their reputation, are you sure you want to proceed?',
        'Report Neighbor?', function() {
          app.dialog.preloader('Reporting...');
          if (document.getElementById('review-report_ghost-check').checked)
            reportComment = 'ghost';
          else if (document.getElementById('review-report_duplicate-check').checked)
            reportComment = 'duplicate';
          else if (document.getElementById('review-report_dead-check').checked)
            reportComment = 'died';
          else if (document.getElementById('review-report_other-check').checked)
            reportComment = 'other';
          else {
            reportComment = '';
            if (document.getElementById('review-report_address-check').checked)
              reportComment += '+address';
            if (document.getElementById('review-report_name-check').checked)
              reportComment += '+name';
            if (document.getElementById('review-report_picture-check').checked)
              reportComment += '+picture';
            reportComment = reportComment.substring(1); // remove the first char ('+')
          }
          const input = document.getElementById('review-report_other-input').value.trim();
          if (input !== '')
            reportComment += ':' + input;
          certificateToPublish = {
            schema: `https://directdemocracy.vote/json-schema/${DIRECTDEMOCRACY_VERSION_MAJOR}/certificate.schema.json`,
            key: citizen.key,
            signature: '',
            published: Math.trunc(new Date().getTime() / 1000),
            appKey: appKey,
            appSignature: '',
            type: 'report',
            publication: review.signature,
            comment: reportComment
          };
          reportComment = '';
          Keystore.sign(PRIVATE_KEY_ALIAS, JSON.stringify(certificateToPublish), publishCertificate, keystoreFailure);
        });
    } else {
      if (reportComment === 'replaced')
        app.dialog.preloader('Replacing...');
      else if (reportComment === 'transferred')
        app.dialog.preloader('Importing...');
      else {
        console.error('Unsupport reportComment in review-confirm button click: "' + reportComment + '"');
        return;
      }
      previousSignature = review.signature;
      Keystore.createKeyPair(PRIVATE_KEY_ALIAS, function(publicKey) {
        citizen.schema = `https://directdemocracy.vote/json-schema/${DIRECTDEMOCRACY_VERSION_MAJOR}/citizen.schema.json`;
        citizen.key = publicKey.slice(44, -6);
        citizen.published = Math.trunc(new Date().getTime() / 1000);
        citizen.givenNames = review.givenNames;
        citizen.familyName = review.familyName;
        citizen.picture = review.picture;
        citizen.latitude = review.latitude;
        citizen.longitude = review.longitude;
        citizen.signature = '';
        citizen.appKey = appKey;
        citizen.appSignature = '';
        localStorage.setItem('publicKey', citizen.key);
        Keystore.sign(PRIVATE_KEY_ALIAS, JSON.stringify(citizen), publishCitizen, keystoreFailure);
      });
    }
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
            registerMarker.setPopupContent(currentLatitude + ', ' + currentLongitude).openPopup();
            fetch('https://nominatim.openstreetmap.org/reverse' +
              `?format=json&lat=${currentLatitude}&lon=${currentLongitude}&zoom=20`)
              .then(response => response.json())
              .then(answer => {
                registerMarker.setPopupContent(
                  `${answer.display_name}<br><br><center style="color:#999">` +
                  `(${currentLatitude}, ${currentLongitude})</center>`
                ).openPopup();
              })
              .catch((error) => {
                console.error(`Could not fetch address at ${currentLatitude}, ${currentLongitude}.`);
                console.error(error);
              });
          }

          function getGeolocationPosition(position) {
            geolocation = true;
            currentLatitude = roundGeo(position.coords.latitude);
            currentLongitude = roundGeo(position.coords.longitude);
            registerMap.setView([currentLatitude, currentLongitude], 12);
            setTimeout(function() {
              registerMarker.setLatLng([currentLatitude, currentLongitude]);
              updateLocation();
            }, 500);
          }

          function roundGeo(v) {
            return Math.round(v * 1000000) / 1000000;
          }
          if (navigator.geolocation)
            navigator.geolocation.getCurrentPosition(getGeolocationPosition);
          fetch(`https://ipinfo.io/loc`)
            .then(response => response.text())
            .then(answer => {
              if (geolocation)
                return;
              if (answer.startsWith('{')) {
                const json = JSON.parse(answer);
                console.log('Status ' + json.status + ': ' + json.error.title + ': ' + json.error.message);
              } else {
                const coords = answer.split(',');
                currentLatitude = parseFloat(coords[0]);
                currentLongitude = parseFloat(coords[1]);
              }
              getGeolocationPosition({ coords: { latitude: currentLatitude, longitude: currentLongitude } });
            })
            .catch((error) => {
              console.error(`Could not fetch latitude and longitude from https://ipinfo.io/loc.`);
              console.error(error);
              getGeolocationPosition({ coords: { latitude: currentLatitude, longitude: currentLongitude } });
            });
          let registerMap = L.map('register-map').setView([currentLatitude, currentLongitude], 2);
          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://openstreetmap.org/copyright">OpenStreetMap</a>'
          }).addTo(registerMap);
          registerMap.whenReady(function() {
            setTimeout(() => {
              this.invalidateSize();
            }, 0);
          });
          let registerMarker = L.marker([currentLatitude, currentLongitude]).addTo(registerMap)
            .bindPopup(currentLatitude + ',' + currentLongitude);
          let e = document.getElementById('register-map');
          const rect = e.getBoundingClientRect();
          const h = screen.height - rect.top;
          e.style.height = h + 'px';
          updateLocation();
          registerMap.on('contextmenu', function(event) {
            return false;
          });
          registerMap.on('click', function onMapClick(e) {
            currentLatitude = roundGeo(e.latlng.lat);
            currentLongitude = roundGeo(e.latlng.lng);
            registerMarker.setLatLng([currentLatitude, currentLongitude]);
            updateLocation();
          });
        },
        close: function() {
          document.getElementById('register-location').value = currentLatitude + ', ' + currentLongitude;
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
    const button = document.getElementById('register-button');
    const action = reportComment === 'updated' ? 'updating' : 'registering';
    button.textContent = translator.translate(action);
    button.setAttribute('data-i18n', action);
    app.dialog.preloader(button.textContent);
    if (action === 'updating') {
      document.getElementById('tab-me-title').textContent = translator.translate('become-citizen');
      localStorage.removeItem('registered');
      localStorage.removeItem('citizenFingerprint');
      localStorage.removeItem('publicKey');
      localStorage.removeItem('referendums');
      localStorage.removeItem('petitions');
      endorsements = [];
      updateEndorsements();
    }
    Keystore.createKeyPair(PRIVATE_KEY_ALIAS, function(publicKey) {
      citizen.schema = `https://directdemocracy.vote/json-schema/${DIRECTDEMOCRACY_VERSION_MAJOR}/citizen.schema.json`;
      citizen.key = publicKey.slice(44, -6);
      citizen.published = Math.trunc(new Date().getTime() / 1000);
      citizen.givenNames = document.getElementById('register-given-names').value.trim();
      citizen.familyName = document.getElementById('register-family-name').value.trim();
      citizen.picture = document.getElementById('register-picture').src;
      citizen.latitude = currentLatitude;
      citizen.longitude = currentLongitude;
      citizen.appKey = appKey;
      citizen.appSignature = '';
      citizen.signature = '';
      localStorage.setItem('publicKey', citizen.key);
      Keystore.sign(PRIVATE_KEY_ALIAS, JSON.stringify(citizen), publishCitizen, keystoreFailure);
    }, keystoreFailure);
    return false;
  });

  document.getElementById('cancel-register-button').addEventListener('click', function(event) {
    if (previousSignature && reportComment === 'updated') {
      showPage('card');
      enableDangerButtons();
      reportComment = '';
      previousSignature = null;
    } else {
      showPage('splash');
      welcome();
    }
  });

  document.getElementById('cancel-scanner').addEventListener('click', function() {
    QRScanner.cancelScan(function(status) {
      stopScanner('home');
    });
  });

  document.getElementById('scan-qrcode').addEventListener('click', function() {
    scan(function(error, contents) {
      scanQRCode(error, contents, 'challenge');
    });
  });

  document.getElementById('qrcode-cancel').addEventListener('click', function() {
    hide('qrcode');
    show('home');
  });

  document.getElementById('show-qrcode').addEventListener('click', function() {
    app.dialog.preloader('Preparing QR Code...');
    challengeBytes = new Uint8Array(20);
    crypto.getRandomValues(challengeBytes);
    challenge = encodeBase128(challengeBytes);
    document.getElementById('qrcode-message').textContent = 'Ask citizen to scan this code';
    Keystore.sign(PRIVATE_KEY_ALIAS, challenge, function(signature) {
      publish({ key: citizen.key, signature: '', appKey: appKey }, signature, 'endorse challenge');
    }, keystoreFailure);
  });

  document.getElementById('scan-me').addEventListener('click', function() {
    hide('me-page');
    disable('scan-me');
    disable('enter-me');
    scan(function(error, contents) {
      scanQRCode(error, contents, 'me');
    });
  });

  document.getElementById('scan-neighbor').addEventListener('click', function() {
    hide('neighbor-page');
    disable('scan-neighbor');
    disable('enter-neighbor');
    scan(function(error, contents) {
      scanQRCode(error, contents, 'neighbor');
    });
  });

  document.getElementById('scan-referendum').addEventListener('click', function() {
    hide('referendum-page');
    disable('scan-referendum');
    disable('enter-referendum');
    scan(function(error, contents) {
      scanQRCode(error, contents, 'referendum');
    });
  });

  document.getElementById('scan-petition').addEventListener('click', function() {
    hide('petition-page');
    disable('scan-petition');
    disable('enter-petition');
    scan(function(error, contents) {
      scanQRCode(error, contents, 'petition');
    });
  });

  document.getElementById('cancel-me').addEventListener('click', function() {
    enableDangerButtons();
    showPage('splash');
    welcome();
  });

  const meSearch = document.getElementById('enter-me');
  meSearch.addEventListener('keyup', function(event) {
    if (event.key === 'Enter')
      searchFingerprint('me');
  });
  meSearch.addEventListener('paste', function(event) {
    event.preventDefault();
    event.currentTarget.value = event.clipboardData.getData('text');
    searchFingerprint('me');
  });
  meSearch.addEventListener('input', function(event) {
    if (event.currentTarget.value.length === 40)
      searchFingerprint('me');
  });

  const neighborSearch = document.getElementById('enter-neighbor');
  neighborSearch.addEventListener('keyup', function(event) {
    if (event.key === 'Enter')
      searchFingerprint('neighbor');
  });
  neighborSearch.addEventListener('paste', function(event) {
    event.preventDefault();
    event.currentTarget.value = event.clipboardData.getData('text');
    searchFingerprint('neighbor');
  });
  neighborSearch.addEventListener('input', function(event) {
    if (event.currentTarget.value.length === 40)
      searchFingerprint('neighbor');
  });

  let referendumSearch = document.getElementById('enter-referendum');
  referendumSearch.addEventListener('keyup', function(event) {
    if (event.key === 'Enter')
      searchFingerprint('referendum');
  });
  referendumSearch.addEventListener('paste', function(event) {
    event.preventDefault();
    event.currentTarget.value = event.clipboardData.getData('text');
    searchFingerprint('referendum');
  });
  referendumSearch.addEventListener('input', function(event) {
    if (event.currentTarget.value.length === 40)
      searchFingerprint('referendum');
  });

  const petitionSearch = document.getElementById('enter-petition');
  petitionSearch.addEventListener('keyup', function(event) {
    if (event.key === 'Enter')
      searchFingerprint('petition');
  });
  petitionSearch.addEventListener('paste', function(event) {
    event.preventDefault();
    event.currentTarget.value = event.clipboardData.getData('text');
    searchFingerprint('petition');
  });
  petitionSearch.addEventListener('input', function(event) {
    if (event.currentTarget.value.length === 40)
      searchFingerprint('petition');
  });

  function setNotary() {
    localStorage.setItem('notary', notary);
    document.getElementById('notary').value = notary;
    updateSearchLinks();
    updateProposalLink();
  }

  function searchFingerprint(type) {
    let value = document.getElementById(`enter-${type}`).value;
    if (value.length === 40) {
      disable(`scan-${type}`);
      disable(`enter-${type}`);
      if (type === 'me')
        getCitizen(value, 'fingerprint', '');
      else
        getProposal(value, type);
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

  function validateRegistration() {
    disable('register-button');
    const givenNames = document.getElementById('register-given-names').value.trim();
    if (givenNames === '')
      return;
    const familyName = document.getElementById('register-family-name').value.trim();
    if (familyName === '')
      return;
    const picture = document.getElementById('register-picture').src;
    if (picture === 'images/default-picture.png')
      return;
    const location = document.getElementById('register-location').value;
    if (location === '')
      return;
    if (!document.getElementById('register-adult').checked)
      return;
    if (!document.getElementById('register-confirm').checked)
      return;
    const coords = location.split(', ');
    const latitude = parseFloat(coords[0]);
    const longitude = parseFloat(coords[1]);
    if (previousSignature && reportComment === 'updated' && // test for change
      givenNames === citizen.givenNames &&
      familyName === citizen.familyName &&
      picture === citizen.picture &&
      latitude === citizen.latitude &&
      longitude === citizen.longitude)
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
            }).then(result => {
              document.getElementById('register-picture').setAttribute('src', result);
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
  document.getElementById('search-me').setAttribute('href', `${notary}?tab=citizens&me=true`);
  document.getElementById('search-neighbor').setAttribute('href', `${notary}?tab=citizens`);
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
  updateEndorsements();
}

function downloadCitizen() {
  app.dialog.preloader('Downloading Citizen...');
  fetch(`${notary}/api/citizen.php`, {
    method: 'POST',
    headers: {
      'directdemocracy-version': directDemocracyVersion,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: 'key=' + encodeURIComponent(localStorage.getItem('publicKey'))
  })
    .then(response => response.json())
    .then(answer => {
      if (answer.error)
        app.dialog.alert(answer.error + '.<br>Please try again.', 'Citizen Error');
      else {
        citizen = answer.citizen;
        citizen.key = localStorage.getItem('publicKey');
        endorsements = answer.endorsements;
        if (endorsements.error)
          app.dialog.alert(endorsements.error, 'Citizen Endorsement Error');
        updateCitizenCard();
        updateEndorsements();
        updateProposalLink();
        updateSearchLinks();
        let swiper = document.getElementById('swiper-container');
        swiper.setAttribute('speed', '300');
        swiper.swiper.allowTouchMove = true;
        app.dialog.close(); // preloader
      }
    })
    .catch((error) => {
      app.dialog.alert('Cannot connect to the notary.<br>Please try again.', 'Citizen Error');
      console.error(error);
    });
}

function refreshEndorsements() {
  app.dialog.preloader('Updating Neighbors...');
  fetch(`${notary}/api/citizen.php`, {
    method: 'POST',
    headers: {
      'directdemocracy-version': directDemocracyVersion,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: 'key=' + encodeURIComponent(localStorage.getItem('publicKey'))
  })
    .then(response => response.json())
    .then(answer => {
      if (answer.error)
        app.dialog.alert(answer.error + '.<br>Please try again.', 'Neighbors Update Error');
      else {
        endorsements = answer.endorsements;
        if (endorsements.error)
          app.dialog.alert(endorsements.error, 'Citizen Endorsement Error');
        updateEndorsements();
        hide('review');
        show('home');
        app.dialog.close(); // preloader
      }
    })
    .catch((error) => {
      app.dialog.alert('Cannot connect to the notary.<br>Please try again.', 'Neighbors Update Error');
      console.error(error);
    });
}

function updateReputation(reputationValue, endorsed) {
  let reputation = document.getElementById('citizen-reputation');
  let badge = document.getElementById('reputation-badge');
  const span = document.createElement('span');
  const color = endorsed ? 'blue' : 'red';
  span.setAttribute('style', `font-weight:bold;color:${color}`);
  span.textContent = Math.round(reputationValue * 100) + '%';
  reputation.innerHTML = '';
  reputation.appendChild(span);
  badge.classList.remove(`color-red`);
  badge.classList.remove(`color-blue`);
  badge.classList.add(`color-${color}`);
  updateProposals(petitions);
  updateProposals(referendums);
}

function getReputationFromJudge() {
  fetch(`${judge}/api/reputation.php?key=${encodeURIComponent(citizen.key)}`)
    .then(response => response.json())
    .then(answer => {
      if (answer.error) {
        app.dialog.alert(answer.error, 'Could not get reputation from judge.');
        updateReputation('N/A', false);
        iAmTrustedByJudge = false;
      } else {
        iAmTrustedByJudge = answer.trusted;
        updateReputation(answer.reputation, answer.trusted);
      }
    })
    .catch((error) => {
      app.dialog.alert(error, 'Could not get reputation from judge.');
      updateReputation('N/A', false);
      iAmTrustedByJudge = false;
    });
}

async function getGreenLightFromJudge(judgeUrl, judgeKey, proposalDeadline, type) {
  const randomBytes = new Uint8Array(20);
  crypto.getRandomValues(randomBytes);
  challenge = btoa(String.fromCharCode.apply(null, randomBytes));
  const url = `${judge}/api/reputation.php?key=${encodeURIComponent(citizen.key)}&challenge=${encodeURIComponent(challenge)}`;
  const response = await fetch(url);
  const answer = await response.json();
  if (answer.error) {
    if (judgeUrl === judge) {
      iAmTrustedByJudge = false;
      updateReputation('N/A', false);
    }
    app.dialog.alert(answer.error, 'Could not get reputation from judge');
    return false;
  }
  const publicKey = await importKey(judgeKey);
  let signature = base64ToByteArray(answer.signature);
  let verify = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', publicKey, signature, randomBytes);
  if (!verify) {
    app.dialog.alert('Failed to verify judge challenge.', 'Bad response from judge');
    return false;
  }
  if (judgeUrl === judge) {
    iAmTrustedByJudge = answer.trusted;
    updateReputation(answer.reputation, answer.trusted);
  }
  if (answer.timestamp >= proposalDeadline) {
    app.dialog.alert(`The deadline of the ${type} has passed.`, 'Deadline passed');
    return false;
  }
  if (answer.trusted !== true) {
    const reputation = Number(answer.reputation);
    app.dialog.alert(`You are not trusted by the judge of this ${type}. Your reputation from this judge is ${reputation}`,
      'Not trusted');
    return false;
  }
  return true;
}

function updateProposals(proposals) {
  const type = (proposals === petitions) ? 'petition' : 'referendum';
  for (let proposal of proposals) {
    if (proposal.judge === judge) {
      let button = document.querySelector(`#${type}-${proposal.id} > div > div > div > button`);
      if (button) {
        if (iAmTrustedByJudge &&
          proposal.deadline * 1000 > new Date().getTime() &&
          ((!proposal.secret && !proposal.signed) || proposal.secret))
          enable(button);
        else
          disable(button);
      }
    }
  }
}

function updateEndorsements() {
  let list = document.getElementById('endorsements-list');
  let badge = document.getElementById('reputation-badge');
  list.innerHTML = '';
  if (endorsements.length === 0) {
    badge.style.background = 'red';
    badge.innerHTML = '!';
    return;
  }
  let endorsementCount = endorsements.length;
  badge.textContent = endorsementCount;
  newElement(
    list,
    'div',
    'block-title no-margin-left no-margin-right',
    `Your Neighbors: ${endorsementCount}/${endorsements.length}`
  );
  let medias = newElement(list, 'div', 'list media-list');
  let ul = newElement(medias, 'ul');
  endorsements.forEach(function(endorsement) {
    let li = newElement(ul, 'li', 'item-content no-padding-left no-padding-right no-margin-left no-margin-right');
    let div = newElement(li, 'div', 'item-media');
    let img = newElement(div, 'img');
    img.src = endorsement.picture;
    img.style.width = '75px';
    div = newElement(li, 'div', 'item-inner display-flex flex-direction-column');
    let a = newElement(div, 'a', 'link external display-block align-self-flex-start');
    a.href = `${notary}/citizen.html?signature=${encodeURIComponent(endorsement.signature)}&judge=${judge}`;
    a.target = '_blank';
    newElement(a, 'div', 'item-title', endorsement.givenNames);
    newElement(a, 'div', 'item-title', endorsement.familyName);
    let icon;
    let day;
    let color;
    let otherIcon;
    let otherDay;
    let otherColor;
    if (endorsement.hasOwnProperty('endorsed') && endorsement.hasOwnProperty('endorsedYou')) {
      day = new Date(endorsement.endorsed * 1000).toISOString().slice(0, 10);
      otherDay = new Date(endorsement.endorsedYou * 1000).toISOString().slice(0, 10);
      if (day === otherDay) {
        icon = 'arrow_right_arrow_left';
        color = 'green';
        otherDay = false;
      } else {
        icon = 'arrow_left';
        color = 'green';
        otherIcon = 'arrow_right';
        otherColor = 'green';
      }
    } else {
      if (endorsement.hasOwnProperty('reported')) {
        icon = 'xmark';
        color = 'red';
        day = new Date(endorsement.reported * 1000).toISOString().slice(0, 10);
      } else if (endorsement.hasOwnProperty('endorsed')) {
        icon = 'arrow_left';
        color = 'green';
        day = new Date(endorsement.endorsed * 1000).toISOString().slice(0, 10);
      } else
        day = false;
      if (endorsement.hasOwnProperty('reportedYou')) {
        otherIcon = 'xmark';
        otherColor = 'red';
        otherDay = new Date(endorsement.reportedYou * 1000).toISOString().slice(0, 10);
      } else if (endorsement.hasOwnProperty('endorsedYou')) {
        otherIcon = 'arrow_right';
        otherColor = 'green';
        otherDay = new Date(endorsement.endorsedYou * 1000).toISOString().slice(0, 10);
      } else
        otherDay = false;
    }
    let message;
    if (day) {
      message = newElement(div, 'div', 'item-subtitle align-self-flex-start',
        `<i class="icon f7-icons" style="font-size:150%;font-weight:bold;color:${color}">${icon}</i> ` + day, true);
      message.style.fontSize = '82.353%';
    }
    if (otherDay) {
      message = newElement(div, 'div', 'item-subtitle align-self-flex-start',
        `<i class="icon f7-icons" style="font-size:150%;font-weight:bold;color:${otherColor}">${otherIcon}</i> ` +
        otherDay, true);
      message.style.fontSize = '82.353%';
    }
    div = newElement(li, 'div', 'item-inner display-flex flex-direction-column');
    div.style.width = '28px';
    a = newElement(div, 'a', 'link');
    let i = newElement(a, 'i', 'f7-icons', 'checkmark_seal_fill');
    i.style.color = 'green';
    let d = newElement(div, 'div', 'display-none', '...');
    d.style.width = '28px';
    d.style.textAlign = 'center';
    d.style.fontSize = '90%';
    d.style.fontWeight = 'bold';
    d.style.color = 'green';
    a.addEventListener('click', function() {
      d.classList.remove('display-none');
      fetch(`${judge}/api/reputation.php?key=${encodeURIComponent(endorsement.key)}`)
        .then(response => response.json())
        .then(answer => {
          if (answer.hasOwnProperty('error'))
            console.error(answer.error);
          else {
            if (answer.hasOwnProperty('reputation')) {
              const reputation = Math.round(100 * parseFloat(answer.reputation));
              if (reputation >= 0 && reputation <= 100)
                d.textContent = reputation + '%';
              else
                d.textContent = 'N/A';
            }
            if (answer.hasOwnProperty('trusted'))
              d.style.color = answer.trusted ? 'green' : 'red';
            else
              d.style.color = 'grey';
          }
        });
    });
    a = newElement(div, 'a', 'link');
    i = newElement(a, 'i', 'f7-icons', 'doc_text_search');
    a.addEventListener('click', function() {
      const comment = endorsement.hasOwnProperty('reportedComment') ? endorsement.reportedComment : 'revoked';
      getCitizen(endorsement.key, 'key', comment);
    });
  });
}

// show either:
// 1. the register page when the citizen has not yet registered
// 2. the splash page when downloading registered citizen data
// 3. the card page once registered citizen data is available
// 4. the video scan page to get endorsed
function showPage(page) {
  const pages = ['splash', 'register', 'me', 'card'];
  if (!pages.includes(page)) {
    console.error(`Page '${page}' not found`);
    return;
  }
  show(`${page}-page`);
  pages.forEach(function(p) {
    if (p !== page)
      hide(`${p}-page`);
  });
  const cards = ['neighbor', 'vote', 'sign'];
  cards.forEach(function(i) {
    const tabbar = `tabbar-${i}`;
    if (page === 'card')
      enable(tabbar);
    else
      disable(tabbar);
  });
  document.getElementById('swiper-container').swiper.slideTo(0, 0, false);
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

function newElement(parent, type, classes, content, innerHTML) {
  let element = document.createElement(type);
  if (parent)
    parent.appendChild(element);
  if (classes) {
    const classArray = classes.split(' ');
    classArray.forEach(function(c) {
      element.classList.add(c);
    });
  }
  if (typeof content !== 'undefined') {
    if (innerHTML === true)
      element.innerHTML = content;
    else
      element.textContent = content;
  }
  return element;
}

function disableDangerButtons() {
  disable('update');
  disable('export');
  disable('delete');
}

function enableDangerButtons() {
  enable('update');
  enable('export');
  enable('delete');
}
