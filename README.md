# *directdemocracy.vote* sample app

This repository contains the source code of the sample smartphone app for *[directdemocracy.vote](https://directdemocracy.vote)* available from https://app.directdemocracy.vote.

The app is developed mostly in Javascript using [Framework7](https://framework7.io/) and ported to Android and iOS with [Cordova](https://cordova.apache.org/).
It requires the development of Cordova plugins for:
- Accessing from a common interface the [Android Play Integrity](https://developer.android.com/google/play/integrity) and [Apple iOS DeviceCheck](https://developer.apple.com/documentation/devicecheck).
- Accessing from a common interface the [Android Keystore](https://source.android.com/docs/security/features/keystore) and [Apple iOS Secure Enclave](https://developer.apple.com/documentation/security/certificate_key_and_trust_services/keys/protecting_keys_with_the_secure_enclave).

It is currently under development and not yet available on the Android Play Store or Apple App Store.

## Installation

You will need a simple web server running a recent version of PHP.

## Dependencies

PHP dependencies should be installed by running `composer install` at the root of this repository.
They include the Google Cloud API client library for PlayIntegrity to check the integrity of the phone and DirectDemocracy app.
