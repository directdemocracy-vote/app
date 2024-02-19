/* global Framework7, QRious, Keystore, L, Camera, Croppie, integrity, device, QRScanner */

import Translator from './translator.js';
import { rsaBlind, rsaUnblind, rsaVerifyBlind } from './rsa-blind.js';
import { pointInPolygons } from './point-in-polygons.js';

const TESTING = false; // if true, enforce the use of the test key for the app
const BETA = true; // if true, set the location to test villages (e.g., Le Poil for french locale and Bodie for english locale)

const DIRECTDEMOCRACY_VERSION_MAJOR = '2';
const DIRECTDEMOCRACY_VERSION_MINOR = '0';
const DIRECTDEMOCRACY_VERSION_BUILD = '54';

const TEST_APP_KEY = // public key of the test app
  'nRhEkRo47vT2Zm4Cquzavyh+S/yFksvZh1eV20bcg+YcCfwzNdvPRs+5WiEmE4eujuGPkkXG6u/DlmQXf2szMMUwGCkqJSPi6fa90pQKx81QHY8Ab4' +
  'z69PnvBjt8tt8L8+0NRGOpKkmswzaX4ON3iplBx46yEn00DQ9W2Qzl2EwaIPlYNhkEs24Rt5zQeGUxMGHy1eSR+mR4Ngqp1LXCyGxbXJ8B/B5hV4QI' +
  'or7U2raCVFSy7sNl080xNLuY0kjHCV+HN0h4EaRdR2FSw9vMyw5UJmWpCFHyQla42Eg1Fxwk9IkHhNe/WobOT1Jiy3Uxz9nUeoCQa5AONAXOaO2wtQ';
const PRODUCTION_APP_KEY = // public key of the genuine app
  'vD20QQ18u761ean1+zgqlDFo6H2Emw3mPmBxeU24x4o1M2tcGs+Q7G6xASRf4LmSdO1h67ZN0sy1tasNHH8Ik4CN63elBj4ELU70xZeYXIMxxxDqis' +
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
let voteButton = null;
let verifyButton = null;
let review = null;
let reviewMap = null;
let reviewMarker = null;
let petitions = [];
let referendums = [];
let previousSignature = null;
let certificateComment = ''; // 'in-person', 'remote', 'deleted', 'replaced', 'updated', 'transferred', 'revoked+...', etc.
let reviewAction = '';
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

async function verifySignature(message) {
  if (!message.hasOwnProperty('signature')) {
    console.error('message has no signature', message);
    return false;
  }
  if (!message.hasOwnProperty('key')) {
    console.error('message has no key', message);
    return false;
  }
  const signature = message.signature;
  message.signature = '';
  const publicKey = await importKey(message.key);
  if (!publicKey) {
    console.error('Failed to import public key for proposal');
    return false;
  }
  const bytes = base64ToByteArray(signature);
  const buffer = new TextEncoder().encode(JSON.stringify(message));
  const verify = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', publicKey, bytes, buffer);
  message.signature = signature;
  return verify;
}

function computeVoteBytes(vote) {
  const referendumBytes = base64ToByteArray(vote.referendum);
  const numberBytes = int64ToUint8Array(vote.number);
  const areaBytes = int64ToUint8Array(vote.area);
  const ballotBytes = base64ToByteArray(vote.ballot);
  const answerBytes = new TextEncoder().encode(vote.answer);
  const l = referendumBytes.length + numberBytes.length + areaBytes.length + ballotBytes.length + answerBytes.length;
  voteBytes = new Uint8Array(l);
  let p = 0;
  voteBytes.set(referendumBytes);
  p += referendumBytes.length;
  voteBytes.set(numberBytes, p);
  p += numberBytes.length;
  voteBytes.set(areaBytes, p);
  p += areaBytes.length;
  voteBytes.set(ballotBytes, p);
  p += ballotBytes.length;
  voteBytes.set(answerBytes, p);
  p += vote.answer.length;
  if (voteBytes.length !== p)
    console.error('vote length is wrong');
}

async function verifyBlind(vote) {
  computeVoteBytes(vote);
  const key = await importKey(appKey);
  const verify = rsaVerifyBlind(voteBytes, key, base64ToByteArray(vote.appSignature));
  return verify;
}

function readyToGo() {
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
          if (BETA)
            setBetaCoordinates();
        }
        break;
      }
    }
  });
  if (!localStorage.getItem('registered'))
    welcome();
  else {
    app.dialog.preloader(translator.translate('downloading-citizen'));
    downloadCitizen(true);
  }
}

function setBetaCoordinates() {
  if (translator.language === 'fr') { // French beta test in Le Poil, France
    currentLatitude = 43.9371;
    currentLongitude = 6.2847;
  } else { // English beta test in Bodie, USA
    currentLatitude = 38.2115;
    currentLongitude = -119.0126;
  }
}

translator.onready = function() {
  if (BETA)
    setBetaCoordinates();
  translatorIsReady = true;
  readyToGo();
};

let app = new Framework7({ el: '#app', name: 'directdemocracy', routes: [{ path: '/', pageName: 'home' }] });

app.on('pageInit', function(page) {
  if (page.name !== 'home')
    return;
  homePageIsReady = true;
  readyToGo();
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
    app.dialog.preloader(translator.translate('exporting'));
    transfer();
  } else if (type === 'endorse challenge')
    getCitizen(otherKey, 'endorse');
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
    app.dialog.alert(translator.translate('export-success-message'), translator.translate('export-success-title'));
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
        'app-time': Math.round(Date.now() / 1000),
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
            showPage('card');
            app.dialog.alert(translator.translate('citizen-card-published'), translator.translate('congratulations'));
            localStorage.setItem('registered', true);
            enableDangerButtons();
            if (review) {
              hide('review');
              show('home');
              review = null;
            }
          } else if (type === 'endorse') {
            document.getElementById('swiper-container').swiper.slideTo(1, 0, false); // show neighbor tab
            const message = translator.translate('endorsement-success-message', [review.givenNames, review.familyName]);
            app.dialog.alert(message, translator.translate('endorsement-success-title'), refreshEndorsements);
            hide('review');
            show('home');
          } else if (type === 'petition signature') {
            const message = translator.translate('petition-signed-message', petitionProposal.title);
            app.dialog.alert(message, translator.translate('petition-signed-title'));
            petitionButton.textContent = translator.translate('petition-signed-button');
            petitionProposal.signed = true;
            localStorage.setItem('petitions', JSON.stringify(petitions));
            disable(petitionButton);
          } else if (type === 'report') {
            const comment = certificateToPublish.comment;
            if (comment === 'deleted') {
              app.dialog.alert(translator.translate('deleted-message'), translator.translate('deleted-success'));
              deleteCitizen();
            } else if (comment.startsWith('revoked+')) {
              const message = translator.translate('revoke-message', [review.givenNames, review.familyName]);
              app.dialog.alert(message, translator.translate('revoke-success'), refreshEndorsements);
              hide('review');
              show('home');
            } else { // report
              const message = translator.translate('report-message', [review.givenNames, review.familyName]);
              app.dialog.alert(message, translator.translate('report-success'));
              hide('review');
              show('home');
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
                  const message = translator.translate('vote-message', referendumProposal.title);
                  app.dialog.alert(message, translator.translate('vote-success'));
                  translator.translateElement(voteButton, 're-vote');
                  if (referendumProposal.deadline * 1000 < new Date().getTime())
                    enable(voteButton);
                  enable(verifyButton);
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
      comment: certificateComment
    };
    certificateComment = '';
    previousSignature = null;
    Keystore.sign(PRIVATE_KEY_ALIAS, JSON.stringify(certificateToPublish), publishCertificate, keystoreFailure);
  }
}

function publishCertificate(signature) {
  publish(certificateToPublish, signature, certificateToPublish.type);
}

function welcome() {
  let dialog = app.dialog.create({
    title: translator.translate('welcome-title'),
    text: translator.translate('welcome-question'),
    buttons: [{
      text: translator.translate('no'),
      onClick: function() {
        function importCitizen() {
          scan(function(error, contents) {
            scanQRCode(error, contents, 'challenge', 'transfer');
          });
        }
        function lost() {
          disableDangerButtons();
          showPage('me');
        }
        let dialog = app.dialog.create({
          title: translator.translate('import-title'),
          text: translator.translate('import-question'),
          buttons: [{
            text: translator.translate('yes'),
            onClick: function() {
              app.dialog.confirm(translator.translate('import-explanation'), translator.translate('import-title'),
                importCitizen, welcome);
            }
          }, {
            text: translator.translate('no'),
            onClick: function() {
              app.dialog.confirm(translator.translate('lost-explanation'), translator.translate('lost-title'), lost, welcome);
            }
          }, {
            text: translator.translate('cancel'),
            onClick: welcome
          }]
        });
        dialog.open();
      }
    }, {
      text: translator.translate('yes'),
      onClick: function() {
        app.dialog.confirm(translator.translate('first-step'), translator.translate('become-a-citizen'), function() {
          showPage('register');
          disableDangerButtons();
        }, welcome);
      }
    }]
  });
  dialog.open();
}

function showChecks(checks) {
  const children = document.getElementById('review-checklist').children;
  for (let i = 0; i < children.length; i++) {
    const item = children[i];
    if (item.id.endsWith('-check-item')) {
      const check = item.id.split('-')[1];
      document.getElementById(`review-${check}-check`).checked = false;
      if (checks.includes(check))
        item.classList.remove('display-none');
      else
        item.classList.add('display-none');
    }
  }
  document.getElementById('review-report_other-input-item').classList.add('display-none');
}

function showEndorseChecks(inPerson, warning) {
  translator.translateElement(document.getElementById('review-know-text'), inPerson ? 'review-standing' : 'review-know');
  showChecks(['know', 'adult', 'picture', 'name', 'coords']);
  const reviewConfirm = document.getElementById('review-confirm');
  translator.translateElement(reviewConfirm, 'endorse');
  certificateComment = inPerson ? 'in-person' : 'remote';
  reviewConfirm.classList.remove('display-none');
  translator.translateElement(document.getElementById('review-cancel'), 'cancel');
  translator.translateElement(document.getElementById('review-title'), 'endorse-a-citizen');
  translator.translateElement(document.getElementById('review-warning'), 'endorsement-warning');
}

function showRevokeChecks() {
  showChecks(['outdated', 'renamed', 'moved', 'died']);
  const reviewConfirm = document.getElementById('review-confirm');
  translator.translateElement(reviewConfirm, 'revoke');
  certificateComment = 'revoked';
  reviewConfirm.classList.remove('display-none');
  translator.translateElement(document.getElementById('review-cancel'), 'cancel');
  translator.translateElement(document.getElementById('review-title'), 'revoke-a-citizen');
  translator.translateElement(document.getElementById('report-radio'), 'revoke');
  translator.translateElement(document.getElementById('review-warning'), 'revoke-warning');
}

function showReportChecks() {
  showChecks(['report_ghost', 'report_duplicate', 'report_dead', 'report_address',
    'report_name', 'report_picture', 'report_other']);
  const reviewConfirm = document.getElementById('review-confirm');
  translator.translateElement(reviewConfirm, 'report');
  certificateComment = 'reported';
  reviewConfirm.classList.remove('display-none');
  translator.translateElement(document.getElementById('review-cancel'), 'cancel');
  translator.translateElement(document.getElementById('review-title'), 'report-a-citizen');
  translator.translateElement(document.getElementById('report-radio'), 'report');
  translator.translateElement(document.getElementById('review-warning'), 'report-warning');
}

function updateChecksDisplay(action) {
  const reviewConfirm = document.getElementById('review-confirm');
  const reviewCancel = document.getElementById('review-cancel');
  const reviewChoiceClassList = document.getElementById('review-choice-item').classList;
  const reviewChoices = document.getElementsByName('review-choice');
  if (action === 'endorse') {
    reviewChoiceClassList.remove('display-none');
    showEndorseChecks(true);
    return;
  }
  if (action === 'endorsed') {
    reviewChoiceClassList.remove('display-none');
    reviewChoices[0].checked = false;
    reviewChoices[1].checked = true;
    showRevokeChecks();
    return;
  }
  if (action.startsWith('revoked+')) { // already revoked
    let warning = translator.translate('you-revoked-this-neighbor') + ' (';
    if (action.search('address') !== -1)
      warning += translator.translate('moved') + ', ';
    if (action.search('name') !== -1)
      warning += translator.translate('renamed') + ', ';
    if (action.search('picture') !== -1)
      warning += translator.translate('outdated-picture') + ', ';
    if (action.search('died') !== -1)
      warning += translator.translate('died') + ', ';
    warning = warning.slice(0, -2) + ')';
    reviewChoiceClassList.remove('display-none');
    reviewChoices[0].checked = true;
    reviewChoices[1].checked = false;
    showEndorseChecks(false, warning);
    return;
  }
  let title, confirm, warning;
  let cancel = translator.translate('cancel');
  if (action === 'replace') {
    title = translator.translate('replace-citizen-card');
    confirm = translator.translate('replace');
    warning = translator.translate('replace-warning');
    reviewChoiceClassList.add('display-none');
    showChecks(['former']);
  } else if (action === 'transfer') {
    title = translator.translate('import-citizen-card');
    confirm = translator.translate('import');
    warning = translator.translate('import-warning');
    reviewChoiceClassList.add('display-none');
    showChecks(['former']);
  } else if (action === 'review') {
    title = translator.translate('review-a-neighbor');
    confirm = '';
    warning = '';
    cancel = translator.translate('close');
    showChecks([]);
    reviewChoiceClassList.remove('display-none');
    reviewChoices[0].checked = false;
    reviewChoices[1].checked = false;
  } else
    console.error('Unsupported comment in citizen review:"' + action + '"');
  if (confirm === '')
    reviewConfirm.classList.add('display-none');
  else
    reviewConfirm.classList.remove('display-none');
  reviewConfirm.textContent = confirm;
  reviewCancel.textContent = cancel;
  document.getElementById('review-title').textContent = title;
  document.getElementById('review-warning').textContent = warning;
}

// action may be either:
// 'replace': replace my own citizen card (no choice)
// 'transfer': transfer my own citizen card (no choice)
// 'endorse': review a face-to-face citizen (preselect endorse)
// 'review': review an online citizen (no preselection)
// 'endorsed': review an already endorsed citizen (preselect revoke), or
// 'revoked+...': review already revoked citizen who endorses me (preselect endorse)

function reviewCitizen(publication, action) {
  updateChecksDisplay(action);
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
  const distance = distanceAsText(citizen.latitude, citizen.longitude, publication.latitude, publication.longitude);
  document.getElementById('distance').textContent = distance;
  translator.translateElement(document.getElementById('report-radio'), action === 'review' ? 'report' : 'revoke');
  const reputation = document.getElementById('review-reputation');
  fetch(`${judge}/api/reputation.php?key=${encodeURIComponent(publication.key)}`)
    .then(response => response.json())
    .then(answer => {
      if (answer.error) {
        app.dialog.alert(answer.error, 'Could not get reputation from judge.');
        reputation.textContent = 'N/A';
        reputation.style.color = 'red';
      } else {
        reputation.textContent = formatReputation(answer.reputation);
        reputation.style.color = answer.trusted === 1 ? 'green' : 'red';
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
  hide('home');
  show('review');
  document.getElementById('review-page').scrollTop = 0;
  reviewAction = action;
}

async function getCitizen(reference, action) {
  app.dialog.preloader(translator.translate('getting-citizen'));
  const parameter = (reference.length === 40) ? `fingerprint=${reference}` : `key=${encodeURIComponent(reference)}`;
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
      if (reference.length === 40) {
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
        console.error(publication);
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
      reviewCitizen(publication, action);
    });
}

function addProposal(proposal, type, open) {
  function setVerifyButton(button) {
    if (proposal.ballot === null)
      disable(button);
    let icon;
    let text;
    if (!proposal.hasOwnProperty('verified')) {
      icon = 'rectangle';
      text = 'verify';
    } else if (proposal.verified === 'verified') {
      icon = 'rectangle_badge_checkmark';
      text = 'verified';
      button.classList.remove('color-orange');
      button.classList.remove('color-red');
      button.classList.add('color-green');
    } else if (proposal.verified === 'not found') {
      icon = 'rectangle_on_rectangle_angled';
      text = 'verify';
      button.classList.remove('color-green');
      button.classList.remove('color-red');
      button.classList.add('color-orange');
    } else { // 'app', 'station', 'tampered', 'missing', '' (unknown error)
      icon = 'rectangle_badge_xmark';
      text = 'error';
      button.classList.remove('color-green');
      button.classList.remove('color-orange');
      button.classList.add('color-red');
    }
    button.innerHTML = '';
    const i = document.createElement('i');
    button.appendChild(i);
    i.classList.add('icon', 'f7-icons', 'margin-right-half');
    i.style.fontSize = '150%';
    i.textContent = icon;
    const span = document.createElement('span');
    button.appendChild(span);
    translator.translateElement(span, text);
  }

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
  translator.translateElement(b, 'area-header');
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
  translator.translateElement(b, 'judge-header');
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
  p.innerHTML = '<b data-i18n="deadline-header">' + translator.translate('deadline-header') +
  `</b> <span${outdated ? ' style="color:red"' : ''}>${deadline}</span>`;
  let grid = document.createElement('div');
  block.appendChild(grid);
  grid.classList.add('grid', type === 'petition' ? 'grid-cols-2' : 'grid-cols-3', 'grid-gap');
  grid.appendChild(button);
  button.classList.add('button', 'button-fill');
  if (type === 'petition') {
    translator.translateElement(button, proposal.signed ? 'petition-signed-button' : 'sign');
    if (proposal.signed || outdated || (proposal.judge === judge && !iAmTrustedByJudge))
      disable(button);
    button.addEventListener('click', function() {
      app.dialog.confirm(
        translator.translate('petition-explanation'), translator.translate('sign-question'), async function() {
          disable(button);
          app.dialog.preloader(translator.translate('signing'));
          if (await getGreenLightFromProposalJudge(proposal.judge,
            proposal.key, proposal.deadline, proposal.trust, 'petition') === false) {
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
    const vButton = document.createElement('button');
    grid.appendChild(vButton);
    vButton.classList.add('button', 'button-fill');
    setVerifyButton(vButton);
    vButton.addEventListener('click', async function(event) {
      app.dialog.preloader(translator.translate('verifying-vote'));
      let result = '';
      let bits = Math.round(proposal.participants / 100);
      const b = base64ToByteArray(proposal.ballot);
      let bin = '';
      for (let i = 0; i < b.length; i++)
        bin += b[i].toString(2).padStart(8, '0');
      do {
        let fromBin = '';
        for (let i = 0; i < bits; i++)
          fromBin += bin[i];
        fromBin += '0'.repeat(256 - bits);
        let from = '';
        for (let i = 0; i < 256; i += 8) {
          const v = parseInt(fromBin.substring(i, i + 8), 2);
          from += v.toString(16);
        }
        const url = `${notary}/api/verify.php?signature=${encodeURIComponent(proposal.signature)}&from=${from}`;
        const response = await fetch(url);
        if (!response.ok) {
          result = `bad response (${response.status}) from server`;
          break;
        }
        let answer;
        try {
          answer = await response.json();
        } catch (e) {
          result = e.message;
          break;
        }
        if (answer.error) {
          console.error(answer.error);
          result = answer.error;
        } else if (answer.length === 0)
          result = 'not found';
        else {
          for (vote of answer) {
            if (!await verifySignature(vote)) { // bad station signature
              result = 'station';
              break;
            }
            if (!await verifyBlind(vote)) { // bad app signature
              result = 'app';
              break;
            }
            if (vote.ballot === proposal.ballot) {
              result = vote.answer === proposal.answer ? 'verified' : 'tampered';
              break;
            }
          }
          if (!result) {
            const last = answer[answer.length - 1];
            const lb = base64ToByteArray(last.ballot);
            let lastBin = '';
            for (let i = 0; i < lb.length; i++)
              lastBin += lb[i].toString(2).padStart(8, '0');
            if (lastBin > bin)
              result = 'not found';
          }
        }
        if (result)
          break;
        do
          bits++;
        while (bits !== 256 && bin[bits - 1] === '0');
        if (bits === 256)
          break;
      } while (true);
      app.dialog.close(); // preloader
      if (result === 'not found' && outdated)
        result = 'missing';
      proposal.verified = result;
      localStorage.setItem('referendums', JSON.stringify(referendums));
      setVerifyButton(vButton);
      if (result === 'verified')
        app.dialog.alert(translator.translate('vote-verified-message'), translator.translate('vote-verified-title'));
      else if (result === 'app')
        app.dialog.alert('The votes returned by the notary are corrupted: wrong app signature', 'Votes Corrupted');
      else if (result === 'station')
        app.dialog.alert('The votes returned by the notary are corrupted: wrong station signature.', 'Votes Corrupted');
      else if (result === 'tampered')
        app.dialog.alert('Your vote was tampered (your answer to the question was modified).', 'Vote Tampered');
      else if (result === 'not found')
        app.dialog.alert(translator.translate('vote-not-found-message'), translator.translate('vote-not-found-title'));
      else if (result === 'missing')
        app.dialog.alert('Your vote is missing after the expiry of the deadline.', 'Vote Missing');
      else if (result === '') {
        app.dialog.alert('An unknown error occurred while verifying your vote. please try again later.',
          'Vote Verification Error');
      }
    });
    translator.translateElement(button, proposal.ballot === null ? 'vote' : 're-vote');
    if (outdated || (proposal.judge === judge && !iAmTrustedByJudge))
      disable(button);
    button.addEventListener('click', function(event) {
      const checked = document.querySelector(`input[name="answer-${proposal.id}"]:checked`);
      const answer = checked ? checked.value : '';
      const explanation = translator.translate('vote-explanation', answer);
      const text = (checked ? explanation : translator.translate('blank-explanation')) +
       translator.translate('vote-change-explanation');
      app.dialog.confirm(text, translator.translate('vote-confirm'), async function() {
        // prepare the vote aimed at blind signature
        disable(button);
        app.dialog.preloader(translator.translate('voting'));
        const greenLight = await getGreenLightFromProposalJudge(proposal.judge, proposal.key, proposal.deadline, proposal.trust,
          'referendum');
        if (greenLight === false) {
          enable(button);
          return;
        }
        const area = await getLocalAreaFromProposalJudge(proposal.key);
        if (area === 0) {
          enable(button);
          return;
        }
        if (proposal.ballot === null) {
          let ballotBytes = new Uint8Array(32);
          crypto.getRandomValues(ballotBytes);
          proposal.ballot = btoa(String.fromCharCode.apply(null, ballotBytes));
        }
        const randomNumber = new Uint8Array(1);
        crypto.getRandomValues(randomNumber);
        proposal.number += randomNumber[0];
        proposal.answer = answer;
        vote = {
          referendum: proposal.signature,
          number: proposal.number,
          area: area,
          ballot: proposal.ballot,
          answer: answer
        };
        computeVoteBytes(vote);
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
          area: area
        };
        voteButton = button;
        verifyButton = vButton;
        referendumProposal = proposal;
        Keystore.sign(PRIVATE_KEY_ALIAS, JSON.stringify(participationToPublish), function(signature) {
          participationToPublish.encryptedVote = btoa(String.fromCharCode(...blind.blindMessage));
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
    const message = translator.translate(type === 'petition' ? 'petition-removal-message' : 'referendum-removal-message');
    const title = translator.translate(type === 'petition' ? 'petition-removal-title' : 'referendum-removal-title');
    app.dialog.confirm(message, title, function() {
      document.getElementById(`${type}s`).removeChild(item);
      if ((!proposal.secret && !proposal.signed) || (proposal.secret && proposal.ballot === null)) { // actually remove it
        const index = proposals.indexOf(proposal);
        proposals.splice(index, 1);
        let i = 0;
        proposals.forEach(function(p) {
          p.id = i++;
        });
      } else { // remove useless fields, keep only signature, signed, number, ballot, answer and verified
        delete proposal.id; // hidden
        delete proposal.key;
        delete proposal.published;
        delete proposal.participants;
        delete proposal.title;
        delete proposal.description;
        delete proposal.areaLocal;
        delete proposal.areaName;
        delete proposal.areaSignature;
        delete proposal.areas;
        delete proposal.deadline;
        delete proposal.corpus;
        delete proposal.participation;
        delete proposal.answers;
        delete proposal.question;
        delete proposal.judge;
        delete proposal.secret;
        delete proposal.website;
        delete proposal.trust;
        delete proposal.trusted;
        delete proposal.type;
        delete proposal.results;
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
    signature: proposal.signature,
    published: proposal.published,
    area: proposal.area,
    title: proposal.title,
    description: proposal.description
  };
  if (proposal.question)
    p.question = proposal.question;
  if (proposal.answers)
    p.answers = proposal.answers;
  p.type = proposal.type;
  p.secret = proposal.secret;
  p.deadline = proposal.deadline;
  if (proposal.website)
    p.website = proposal.website;
  p.trust = proposal.trust;
  if (!await verifySignature(p)) {
    app.dialog.alert('Cannot verify the signature of this proposal.', 'Wrong proposal signature');
    return false;
  }
  let a = {
    schema: `https://directdemocracy.vote/json-schema/${DIRECTDEMOCRACY_VERSION_MAJOR}/area.schema.json`,
    key: proposal.areaKey,
    signature: proposal.areaSignature,
    published: proposal.areaPublished,
    id: proposal.area,
    name: proposal.areaName,
    polygons: proposal.areaPolygons,
    local: proposal.areaLocal
  };
  if (!await verifySignature(a)) {
    app.dialog.alert('Cannot verify the signature of the area of this proposal', 'Wrong area signature');
    return false;
  }
  if (proposal.areaKey !== proposal.key) {
    app.dialog.alert('Proposal and area key mismeatch', 'Wrong proposal or area');
    return false;
  }
  return true;
}

function testProposalTrust(proposalTrust, certificateIssued, now, proposalType) {
  let trust;
  if (proposalTrust > 315576000) // if more than 10 years, we consider it as a date
    trust = proposalTrust;
  else // we consider it as a delay from now
    trust = now - proposalTrust;
  if (certificateIssued > trust) {
    let details;
    if (proposalTrust > 315576000) {
      const date = new Date(proposalTrust * 1000).toISOString().replace('T', ' ').substring(0, 19);
      details = translator.translate('trusted-since', date);
    } else {
      const hours = Math.floor(proposalTrust / 3600);
      if (hours === 1)
        details = translator.translate('trusted-1-hour');
      else if (hours <= 24)
        details = translator.translate('trusted-x-hours', hours);
      else {
        const days = Math.ceil(hours / 24);
        details = translator.translate('trusted-x-days', days);
      }
    }
    const message = translator.translate(proposalType === 'petition'
      ? 'trusted-petition-message'
      : 'trusted-referendum-message');
    app.dialog.alert(message + details, translator.translate('too-early-trust'));
    return false;
  }
  return true;
}

async function getProposal(fingerprint, type) {
  const message = translator.translate(type === 'petition' ? 'getting-petition' : 'getting-referendum');
  app.dialog.preloader(message);
  fetch(`${notary}/api/proposal.php?fingerprint=${fingerprint}&citizen=${encodeURIComponent(citizen.signature)}`)
    .then(response => response.json())
    .then(async proposal => {
      app.dialog.close(); // preloader
      enable(`scan-${type}`);
      enable(`enter-${type}`);
      if (proposal.error) {
        app.dialog.alert(proposal.error, 'Proposal search error');
        return;
      }
      if (proposal.trusted === 0) {
        app.dialog.alert(translator.translate('untrusted-message'), translator.translate('untrusted-title'));
        return;
      }
      if (proposal.trusted === -1) {
        app.dialog.alert(translator.translate('distrusted-message'), translator.translate('distrusted-title'));
        return;
      }
      if (!testProposalTrust(proposal.trust, proposal.trusted, Math.round(Date.now() / 1000), proposal.type))
        return;
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
      if (type === 'petition' && proposal.secret)
        app.dialog.alert(title + translator.translate('not-a-petition-message'), translator.translate('not-a-petition-title'));
      else if (type === 'referendum' && !proposal.secret) {
        app.dialog.alert(title + translator.translate('not-a-referendum-message'),
          translator.translate('not-a-referendum-title'));
      } else if (!pointInPolygons([citizen.longitude, citizen.latitude], proposal.areaPolygons)) {
        const areaName = proposal.areaName[0].split('=')[1];
        const message = translator.translate(type === 'petition' ? 'wrong-petition-area' : 'wrong-referendum-area', areaName);
        app.dialog.alert(`${title}${message}`, translator.translate('wrong-area'));
      } else if (outdated) {
        const message = translator.translate(type === 'petition'
          ? 'petition-deadline-passed'
          : 'referendum-deadline-passed',
        deadline);
        app.dialog.alert(`${title}${message}`, translator.translate('deadline-passed'));
      } else {
        let already = false;
        let proposals = (type === 'petition') ? petitions : referendums;
        for (let p of proposals) {
          const bytes = base64ToByteArray(p.signature);
          const bytesArray = await crypto.subtle.digest('SHA-1', bytes);
          const sha1 = Array.from(new Uint8Array(bytesArray), byte => ('0' + (byte & 0xFF).toString(16)).slice(-2)).join('');
          if (sha1 === fingerprint) {
            if (p.id !== undefined) {
              app.dialog.alert(title + translator.translate(type === 'petition' ? 'already-petition' : 'already referendum'));
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

function sendChallenge(otherAppUrl, challengeId, key, signature, action) {
  const sig = signature.slice(0, -2);
  fetch(`https://${otherAppUrl}/api/challenge.php?id=${challengeId}&key=${encodeURIComponent(key)}&signature=${encodeURIComponent(sig)}`)
    .then(response => response.json())
    .then(async answer => {
      if (answer.error) {
        console.error(answer.error);
        app.dialog.alert(answer.error + '.<br>Please try again.', 'Challenge Error', function() {
          scan(function(error, contents) {
            scanQRCode(error, contents, 'challenge', action);
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
        app.dialog.alert(translator.translate('cannot-verify-challenge'), translator.translate('verification-error'));
        return;
      }
      getCitizen(key, action);
    });
}

async function scanQRCode(error, contents, type, action = '') {
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
    if (action === 'transfer') { // generate a key and sign the challenge
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
      sendChallenge(otherAppUrl, challengeId, key, signature, action);
    } else { // endorse with own key
      Keystore.sign(PRIVATE_KEY_ALIAS, challenge, function(signature) {
        sendChallenge(otherAppUrl, challengeId, citizen.key, signature, action);
      }, keystoreFailure);
    }
  } else {
    const fingerprint = byteArrayToFingerprint(decodeBase128(contents));
    if (type === 'me')
      getCitizen(fingerprint, 'replace');
    else if (type === 'neighbor')
      getCitizen(fingerprint, 'review');
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

  function iUnderstandDialog(message, title, callback) {
    const iUnderstand = translator.translate('i-understand');
    const iUnderstandBold = `<b>${iUnderstand}</b>`;
    const pleaseType = translator.translate('please-type', iUnderstandBold);
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
      certificateComment = 'updated';
      const button = document.getElementById('register-button');
      button.textContent = 'Update';
      disable(button);
      translator.translateElement(document.getElementById('tab-me-title'), 'update-citizen-card');
      document.getElementById('register-given-names').value = citizen.givenNames;
      document.getElementById('register-family-name').value = citizen.familyName;
      document.getElementById('register-picture').src = citizen.picture;
      document.getElementById('register-location').value = citizen.latitude + ', ' + citizen.longitude;
      document.getElementById('register-adult').checked = true;
      document.getElementById('register-confirm').checked = false;
      showPage('register');
      disableDangerButtons();
    }
    if (endorsements.length > 0)
      iUnderstandDialog(translator.translate('update-explanation'), translator.translate('update-title'), updateCard);
    else
      updateCard();
  });

  document.getElementById('export').addEventListener('click', function(event) {
    function exportCard() {
      app.dialog.preloader(translator.translate('preparing-qr-code'));
      challengeBytes = new Uint8Array(20);
      crypto.getRandomValues(challengeBytes);
      challenge = encodeBase128(challengeBytes);
      translator.translateElement(document.getElementById('qrcode-message'), 'scan-this-qr-code');
      Keystore.sign(PRIVATE_KEY_ALIAS, challenge, function(signature) {
        publish({ key: citizen.key, signature: '', appKey: appKey }, signature, 'transfer challenge');
      }, keystoreFailure);
    }
    app.dialog.confirm(translator.translate('export-explanation'), translator.translate('export-title'), exportCard);
  });

  document.getElementById('delete').addEventListener('click', function(event) {
    function deleteCard() {
      app.dialog.preloader(translator.translate('deleting'));
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
    app.dialog.confirm(translator.translate('delete-explanation'), translator.translate('delete-title'), deleteCard);
  });

  function choiceChange(event) {
    const button = event.currentTarget;
    disable('review-confirm');
    if (reviewAction === 'endorse') {
      if (button.value === 'endorse') // face-to-face
        showEndorseChecks(true);
      else
        showReportChecks(true);
    } else if (reviewAction === 'review') {
      if (button.value === 'endorse')
        showEndorseChecks(false); // offline
      else
        showReportChecks(false);
    } else if (reviewAction === 'endorsed') {
      if (button.value === 'endorse')
        showEndorseChecks(false); // offline
      else
        showRevokeChecks(false);
    } else if (reviewAction.startsWith('revoked+')) {
      if (button.value === 'endorse')
        showEndorseChecks(false); // offline
      else
        showRevokeChecks(false, reviewAction.substring(8));
    } else
      console.error('Unsupported review action: ' + reviewAction);
  }
  const reviewChoice = document.getElementsByName('review-choice');
  reviewChoice[0].addEventListener('click', choiceChange);
  reviewChoice[1].addEventListener('click', choiceChange);

  document.getElementById('review-former-check').addEventListener('click', function(event) {
    if (event.currentTarget.checked)
      enable('review-confirm');
    else
      disable('review-confirm');
  });

  function endorsementChecks() {
    if (document.getElementById('review-know-check').checked &&
      document.getElementById('review-adult-check').checked &&
      document.getElementById('review-picture-check').checked &&
      document.getElementById('review-name-check').checked &&
      document.getElementById('review-coords-check').checked)
      enable('review-confirm');
    else
      disable('review-confirm');
  }
  document.getElementById('review-know-check').addEventListener('click', endorsementChecks);
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
    if (other.checked === false)
      document.getElementById('review-report_other-input-item').classList.add('display-none');
    else
      document.getElementById('review-report_other-input-item').classList.remove('display-none');
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
    certificateComment = '';
    review = null;
  });

  document.getElementById('review-confirm').addEventListener('click', function(event) {
    if (certificateComment === 'in-person' || certificateComment === 'remote') { // endorse
      app.dialog.preloader(translator.translate('endorsing'));
      certificateToPublish = {
        schema: `https://directdemocracy.vote/json-schema/${DIRECTDEMOCRACY_VERSION_MAJOR}/certificate.schema.json`,
        key: citizen.key,
        signature: '',
        published: Math.trunc(new Date().getTime() / 1000),
        appKey: appKey,
        appSignature: '',
        type: 'endorse',
        publication: review.signature,
        comment: certificateComment
      };
      certificateComment = '';
      Keystore.sign(PRIVATE_KEY_ALIAS, JSON.stringify(certificateToPublish), publishCertificate, keystoreFailure);
    } else if (certificateComment === 'revoked') {
      app.dialog.confirm(translator.translate('revoke-explanation'), translator.translate('revoke-title'), function() {
        app.dialog.preloader(translator.translate('revoking'));
        if (document.getElementById('review-died-check').checked)
          certificateComment += '+died';
        else {
          if (document.getElementById('review-moved-check').checked)
            certificateComment += '+address';
          if (document.getElementById('review-renamed-check').checked)
            certificateComment += '+name';
          if (document.getElementById('review-outdated-check').checked)
            certificateComment += '+picture';
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
          comment: certificateComment
        };
        certificateComment = '';
        Keystore.sign(PRIVATE_KEY_ALIAS, JSON.stringify(certificateToPublish), publishCertificate, keystoreFailure);
      });
    } else if (certificateComment === 'reported') {
      app.dialog.confirm(translator.translate('report-explanation'), translator.translate('report-title'), function() {
        app.dialog.preloader(translator.translate('reporting'));
        if (document.getElementById('review-report_ghost-check').checked)
          certificateComment = 'ghost';
        else if (document.getElementById('review-report_duplicate-check').checked)
          certificateComment = 'duplicate';
        else if (document.getElementById('review-report_dead-check').checked)
          certificateComment = 'died';
        else if (document.getElementById('review-report_other-check').checked)
          certificateComment = 'other';
        else {
          certificateComment = '';
          if (document.getElementById('review-report_address-check').checked)
            certificateComment += '+address';
          if (document.getElementById('review-report_name-check').checked)
            certificateComment += '+name';
          if (document.getElementById('review-report_picture-check').checked)
            certificateComment += '+picture';
          certificateComment = certificateComment.substring(1); // remove the first char ('+')
        }
        const input = document.getElementById('review-report_other-input').value.trim();
        if (input !== '')
          certificateComment += ':' + input;
        certificateToPublish = {
          schema: `https://directdemocracy.vote/json-schema/${DIRECTDEMOCRACY_VERSION_MAJOR}/certificate.schema.json`,
          key: citizen.key,
          signature: '',
          published: Math.trunc(new Date().getTime() / 1000),
          appKey: appKey,
          appSignature: '',
          type: 'report',
          publication: review.signature,
          comment: certificateComment
        };
        certificateComment = '';
        Keystore.sign(PRIVATE_KEY_ALIAS, JSON.stringify(certificateToPublish), publishCertificate, keystoreFailure);
      });
    } else {
      if (certificateComment === 'replaced')
        app.dialog.preloader(translator.translate('replacing'));
      else if (certificateComment === 'transferred')
        app.dialog.preloader(translator.translate('importing'));
      else {
        console.error('Unsupport certificateComment in review-confirm button click: "' + certificateComment + '"');
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
            if (!BETA) {
              currentLatitude = roundGeo(position.coords.latitude);
              currentLongitude = roundGeo(position.coords.longitude);
            }
            registerMap.setView([currentLatitude, currentLongitude], 18);
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
                console.error('Status ' + json.status + ': ' + json.error.title + ': ' + json.error.message);
              } else {
                const coords = answer.split(',');
                if (!BETA) {
                  currentLatitude = parseFloat(coords[0]);
                  currentLongitude = parseFloat(coords[1]);
                }
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
    const action = certificateComment === 'updated' ? 'updating' : 'registering';
    translator.translateElement(button, action);
    app.dialog.preloader(button.textContent);
    if (action === 'updating') {
      translator.translateElement(document.getElementById('tab-me-title'), 'become-citizen');
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
    if (previousSignature && certificateComment === 'updated') {
      showPage('card');
      enableDangerButtons();
      certificateComment = '';
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
      scanQRCode(error, contents, 'challenge', 'endorse');
    });
  });

  document.getElementById('qrcode-cancel').addEventListener('click', function() {
    hide('qrcode');
    show('home');
  });

  document.getElementById('show-qrcode').addEventListener('click', function() {
    app.dialog.preloader(translator.translate('preparing-qr-code'));
    challengeBytes = new Uint8Array(20);
    crypto.getRandomValues(challengeBytes);
    challenge = encodeBase128(challengeBytes);
    translator.translateElement(document.getElementById('qrcode-message'), 'ask-citizen-to-scan-this-code');
    Keystore.sign(PRIVATE_KEY_ALIAS, challenge, function(signature) {
      publish({ key: citizen.key, signature: '', appKey: appKey }, signature, 'endorse challenge');
    }, keystoreFailure);
  });

  document.getElementById('remote-endorsement').addEventListener('click', function() {
    const fingerprint = byteArrayToFingerprint(base64ToByteArray(localStorage.getItem('citizenFingerprint')));
    window.plugins.socialsharing.shareWithOptions({
      message: translator.translate('remote-endorsement-invite'),
      subject: 'DirectDemocracy',
      url: `https://app.directdemocracy.vote/invite.html?fingerprint=${fingerprint}`
    });
  });

  document.getElementById('scan-me').addEventListener('click', function() {
    hide('me-page');
    disable('scan-me');
    disable('enter-me');
    scan(function(error, contents) {
      scanQRCode(error, contents, 'me', 'replace');
    });
  });

  document.getElementById('scan-neighbor').addEventListener('click', function() {
    hide('neighbor-page');
    disable('scan-neighbor');
    disable('enter-neighbor');
    scan(function(error, contents) {
      scanQRCode(error, contents, 'neighbor', 'review');
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
      if (type === 'me' || type === 'neighbor')
        getCitizen(value, 'review');
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
    if (previousSignature && certificateComment === 'updated' && // test for change
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
  const searchMe = document.getElementById('search-me');
  if (searchMe)
    searchMe.setAttribute('href', `${notary}?tab=citizens&me=true`);
  const searchNeighbor = document.getElementById('search-neighbor');
  if (searchNeighbor)
    searchNeighbor.setAttribute('href', `${notary}?tab=citizens`);
  const searchPetitions = document.getElementById('search-petition');
  if (searchPetitions)
    searchPetitions.setAttribute('href', `${notary}?tab=proposals&latitude=${citizen.latitude}&longitude=${citizen.longitude}`);
  const searchReferendums = document.getElementById('search-referendum');
  if (searchReferendums) {
    searchReferendums.setAttribute('href',
      `${notary}?tab=proposals&latitude=${citizen.latitude}&longitude=${citizen.longitude}`);
  }
}

function updateCitizenCard() {
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

function downloadCitizen(initial) {
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
      app.dialog.close(); // preloader
      if (answer.error) {
        if (answer.error === 'citizen not found') {
          app.dialog.confirm(translator.translate('citizen-card-not-found'),
            translator.translate('citizen-card-not-found-title'), function() {
              window.localStorage.removeItem('registered');
              welcome();
            });
        } else
          app.dialog.alert(answer.error + '.<br>Please try again.', 'Citizen Error');
      } else {
        citizen = answer.citizen;
        citizen.key = localStorage.getItem('publicKey');
        endorsements = answer.endorsements;
        if (endorsements.error)
          app.dialog.alert(endorsements.error, 'Citizen Endorsement Error');
        updateCitizenCard();
        updateEndorsements();
        updateProposalLink();
        updateSearchLinks();
        if (initial) {
          showPage('card');
          let swiper = document.getElementById('swiper-container');
          swiper.setAttribute('speed', '300');
          swiper.swiper.allowTouchMove = true;
        }
      }
    })
    .catch((error) => {
      app.dialog.alert('Cannot connect to the notary.<br>Please try again.', 'Citizen Error');
      console.error(error);
    });
}

function refreshEndorsements() {
  app.dialog.preloader(translator.translate('updating-neighbors'));
  downloadCitizen(false);
  // FIXME: remove this
  /*
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
        app.dialog.close(); // preloader
      }
    })
    .catch((error) => {
      app.dialog.alert('Cannot connect to the notary.<br>Please try again.', 'Neighbors Update Error');
      console.error(error);
    });
    */
}
document.getElementById('reload').addEventListener('click', function(event) {
  app.dialog.preloader(translator.translate('reloading'));
  downloadCitizen(false);
});

function formatReputation(reputation) {
  if (reputation !== 'N/A') {
    const percent = Math.round(100 * parseFloat(reputation));
    if (percent >= 0 && percent <= 100)
      return percent + '%';
  }
  return 'N/A';
}

function updateReputation(reputationValue, endorsed) {
  let reputation = document.getElementById('citizen-reputation');
  const span = document.createElement('span');
  const color = endorsed ? 'blue' : 'red';
  span.setAttribute('style', `font-weight:bold;color:${color}`);
  span.textContent = formatReputation(reputationValue);
  reputation.innerHTML = '';
  reputation.appendChild(span);
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

async function getGreenLightFromProposalJudge(judgeUrl, judgeKey, proposalDeadline, proposalTrust, type) {
  const url = `${notary}/api/reputation.php?judge=${encodeURIComponent(judgeKey)}&key=${encodeURIComponent(citizen.key)}`;
  const response = await fetch(url);
  const answer = await response.json();
  if (answer.error) {
    if (judgeUrl === judge) {
      iAmTrustedByJudge = false;
      updateReputation('N/A', false);
    }
    app.dialog.alert(answer.error, 'Could not get reputation from notary');
    return false;
  }
  if (answer.key !== judgeKey) {
    app.dialog.alert(`Wrong judge key while getting reputation from notary.`, `Wrong judge key`);
    return false;
  }
  if (!await verifySignature(answer)) {
    app.dialog.alert('Failed to verify judge signature.', 'Bad response from notary');
    return false;
  }
  if (judgeUrl === judge) {
    iAmTrustedByJudge = answer.trusted;
    updateReputation(answer.reputation, answer.trusted);
  }
  const timeDifference = Math.round(Date.now() / 1000) - answer.timestamp;
  if (Math.abs(timeDifference) > 60) {
    app.dialog.alert(translator.translate('time-difference', timeDifference),
      translator.translate('time-mismatch'));
    return false;
  }
  if (answer.timestamp >= proposalDeadline) {
    app.dialog.alert(translator.translate(type === 'petition'
      ? 'petition-deadline-passed-short'
      : 'referendum-deadline-passed-short'
    ), translator.translate('deadline-passed'));
    return false;
  }
  const reputation = formatReputation(answer.reputation);
  if (answer.trusted === 0) {
    app.dialog.alert(translator.translate('untrusted-message') + ' ' +
    translator.translate('reputation-message', reputation),
    translator.translate('untrusted-title'));
    return false;
  } else if (answer.trusted === -1) {
    app.dialog.alert(translator.translate('distrusted-message') + ' ' +
    translator.translate('reputation-message', reputation),
    translator.translate('distrusted-title'));
    return false;
  }
  const issued = parseInt(answer.issued);
  if (!testProposalTrust(proposalTrust, issued, answer.timestamp, type))
    return false;
  return true;
}

async function getLocalAreaFromProposalJudge(judgeKey) {
  const url = `${notary}/api/publish_area.php?judge=${encodeURIComponent(judgeKey)}` +
                                             `&lat=${citizen.latitude}&lon=${citizen.longitude}`;
  const response = await fetch(url);
  const answer = await response.json();
  if (answer.error) {
    app.dialog.alert(answer.error, 'Could not get local area from notary');
    return 0;
  }
  if (answer.key !== judgeKey) {
    app.dialog.alert('Wrong judge key returned by notary for local area.', 'Local area error');
    return 0;
  }
  if (!await verifySignature(answer)) {
    app.dialog.alert('Wrong signature for judge area.', 'Wrong signature');
    return 0;
  }
  return answer.id;
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

function distanceAsText(lat1, lon1, lat2, lon2) {
  const d = distanceInMeter(lat1, lon1, lat2, lon2);
  let text;
  if (d >= 10000)
    text = `${Math.round(d / 1000)} km`;
  else if (d > 1000)
    text = `${Math.round(d / 100) / 10} km`;
  else
    text = `${Math.round(d)} m`;
  return text;
}

function distanceInMeter(lat1, lon1, lat2, lon2) {
  const R = 6371e3;
  const p1 = lat1 * Math.PI / 180;
  const p2 = lat2 * Math.PI / 180;
  const deltaP = p2 - p1;
  const deltaLon = lon2 - lon1;
  const deltaLambda = (deltaLon * Math.PI) / 180;
  const a = Math.sin(deltaP / 2) * Math.sin(deltaP / 2) +
            Math.cos(p1) * Math.cos(p2) *
            Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const d = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * R;
  return d;
}

function updateEndorsements() {
  let list = document.getElementById('endorsements-list');
  list.innerHTML = '';
  if (endorsements.length === 0)
    return;
  let endorsedYouCount = 0;
  let endorsedCount = 0;
  for (const endorsement of endorsements) {
    if (endorsement.hasOwnProperty('endorsedYou'))
      endorsedYouCount++;
    if (endorsement.hasOwnProperty('endorsed'))
      endorsedCount++;
  }
  newElement(
    list,
    'div',
    'block-title no-margin-left no-margin-right',
    translator.translate('your-neighbors')
  ).setAttribute('data-i18n', 'your-neighbors');
  const infoText = translator.translate('you-are-endorsed-by', [endorsedYouCount, endorsedCount]);
  const info = newElement(list, 'div', 'no-margin-left no-margin-right', infoText);
  info.style.fontSize = '85%';
  info.setAttribute('data-i18n', 'you-are-endorsed-by');
  info.setAttribute('data-i18n-1', endorsedYouCount);
  info.setAttribute('data-i18n-2', endorsedCount);
  let medias = newElement(list, 'div', 'list media-list margin-top-half');
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
    const distance = distanceAsText(citizen.latitude, citizen.longitude, endorsement.latitude, endorsement.longitude);
    newElement(div, 'div', 'item-subtitle align-self-flex-start', distance);
    let icon;
    let day;
    let color;
    let comment;
    let otherIcon;
    let otherDay;
    let otherColor;
    let otherComment;
    if (endorsement.hasOwnProperty('endorsed')) {
      day = new Date(endorsement.endorsed * 1000).toISOString().slice(0, 10);
      color = endorsement.endorsedComment === 'in-person' ? 'green' : 'blue';
      icon = 'arrow_left';
      comment = endorsement.endorsedComment;
    } else if (endorsement.hasOwnProperty('revoked')) {
      day = new Date(endorsement.revoked * 1000).toISOString().slice(0, 10);
      color = 'red';
      icon = 'arrow_left';
      comment = endorsement.revokedComment;
    } else
      day = false;
    if (endorsement.hasOwnProperty('endorsedYou')) {
      otherDay = new Date(endorsement.endorsedYou * 1000).toISOString().slice(0, 10);
      otherColor = endorsement.endorsedYouComment === 'in-person' ? 'green' : 'blue';
      otherIcon = 'arrow_right';
      otherComment = endorsement.endorsedYouComment;
    } else if (endorsement.hasOwnProperty('revokedYou')) {
      otherDay = new Date(endorsement.revokedYou * 1000).toISOString().slice(0, 10);
      otherColor = 'red';
      otherIcon = 'arrow_right';
      otherComment = endorsement.revokedYouComment;
    } else
      otherDay = false;
    if (day !== false || otherDay !== false) {
      if (day === otherDay && color === otherColor && comment === otherComment) {
        otherDay = false;
        icon = 'arrow_right_arrow_left';
      }
      if (otherComment === 'remote')
        otherComment = 'endorsed-you-remotely';
      else if (otherComment === 'in-person')
        otherComment = 'endorsed-you-in-person';
      else if (otherComment === 'revoked+address')
        otherComment = 'revoked-moved';
      else if (otherComment === 'revoked+name')
        otherComment = 'revoked-name';
      else if (otherComment === 'revoked+picture')
        otherComment = 'revoked-picture';
      else if (otherComment === 'revoked+address+name')
        otherComment = 'revoked-address-name';
      else if (otherComment === 'revoked+address+picture')
        otherComment = 'revoked-address-picture';
      else if (otherComment === 'revoked+name+picture')
        otherComment = 'revoked-name-picture';
      else if (otherComment === 'revoked+address+name+picture')
        otherComment = 'revoked-address-name-picture';
      else if (otherComment === 'revoked+died')
        otherComment = 'revoked-died';
      else if (otherComment)
        console.error('Unsupported other comment: ' + otherComment);
      if (comment === 'remote')
        comment = 'you-endorsed-remotely';
      else if (comment === 'in-person')
        comment = 'you-endorsed-in-person';
      else if (comment === 'revoked+address')
        comment = 'you-revoked-moved';
      else if (comment === 'revoked+name')
        comment = 'you-revoked-name';
      else if (comment === 'revoked+picture')
        comment = 'you-revoked-picture';
      else if (comment === 'revoked+address+name')
        comment = 'you-revoked-address-name';
      else if (comment === 'revoked+address+picture')
        comment = 'you-revoked-address-picture';
      else if (comment === 'revoked+name+picture')
        comment = 'you-revoked-name-picture';
      else if (comment === 'revoked+address+name+picture')
        comment = 'you-revoked-address-name-picture';
      else if (comment === 'revoked+died')
        comment = 'you-revoked-died';
      else if (comment)
        console.error('Unsupported comment: ' + comment);

      let other = otherDay
        ? `<i class="icon f7-icons" style="font-size:150%;font-weight:bold;color:${otherColor}">${otherIcon}</i> ${otherDay}` +
        `${day ? ' ' : ''}`
        : '';
      let main = day
        ? `<i class="icon f7-icons" style="font-size:150%;font-weight:bold;color:${color}">${icon}</i> ${day}`
        : '';
      let message = newElement(div, 'div', 'item-subtitle align-self-flex-start');
      message.style.fontSize = '82.353%';
      if (other !== '') {
        newElement(message, 'span', '', other, true).addEventListener('click', function(event) {
          const c = comment ? translator.translate(comment, [endorsement.givenNames, endorsement.familyName]) : '';
          const oc = otherComment ? translator.translate(otherComment, [endorsement.givenNames, endorsement.familyName]) : '';
          app.dialog.alert(icon === 'arrow_right_arrow_left' ? oc + '<br>' + c : oc);
        });
      }
      if (main !== '') {
        newElement(message, 'span', '', main, true).addEventListener('click', function(event) {
          const c = comment ? translator.translate(comment, [endorsement.givenNames, endorsement.familyName]) : '';
          const oc = otherComment ? translator.translate(otherComment, [endorsement.givenNames, endorsement.familyName]) : '';
          app.dialog.alert(icon === 'arrow_right_arrow_left' ? c + '<br>' + oc : c);
        });
      }
    }
    div = newElement(li, 'div', 'item-inner display-flex flex-direction-column');
    div.style.width = '28px';
    a = newElement(div, 'a', 'link');
    let trustIcon;
    if (endorsement.hasOwnProperty('trusted')) {
      if (endorsement.trusted === 1) {
        trustIcon = 'checkmark_seal_fill';
        color = 'green';
      } else {
        trustIcon = 'xmark_seal_fill';
        color = 'red';
      }
    } else {
      trustIcon = 'checkmark_seal';
      color = 'grey';
    }
    let i = newElement(a, 'i', 'f7-icons', trustIcon);
    i.style.color = color;
    let d = newElement(div, 'div', 'display-none', '...');
    d.style.width = '28px';
    d.style.textAlign = 'center';
    d.style.fontSize = '90%';
    d.style.fontWeight = 'bold';
    d.style.color = 'green';
    a.addEventListener('click', function() {
      d.classList.remove('display-none');
      d.textContent = '...';
      d.style.color = 'grey';
      i.style.color = 'grey';
      i.textContent = 'checkmark_seal';
      fetch(`${judge}/api/reputation.php?key=${encodeURIComponent(endorsement.key)}`)
        .then(response => response.json())
        .then(answer => {
          if (answer.hasOwnProperty('error'))
            console.error(answer.error);
          else {
            if (answer.hasOwnProperty('reputation'))
              d.textContent = formatReputation(answer.reputation);
            if (answer.hasOwnProperty('trusted')) {
              if (answer.trusted === 1) { // trusted
                d.style.color = 'green';
                i.style.color = 'green';
                i.textContent = 'checkmark_seal_fill';
              } else { // never trusted or distrusted
                d.style.color = 'red';
                i.style.color = 'red';
                i.textContent = 'xmark_seal_fill';
              }
            } else
              d.style.color = 'grey';
          }
        });
    });
    a = newElement(div, 'a', 'link');
    newElement(a, 'i', 'f7-icons', 'doc_text_search');
    a.addEventListener('click', function() {
      let action;
      if (endorsement.hasOwnProperty('revokedComment'))
        action = endorsement.revokedComment.replace('revoke+', 'revoked+');
      else if (endorsement.hasOwnProperty('endorsed'))
        action = 'endorsed';
      else
        action = 'review';
      getCitizen(endorsement.key, action);
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
