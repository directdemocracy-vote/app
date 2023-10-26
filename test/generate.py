import base64
import json
import os
import requests
import sys
import time

from Crypto.Hash import SHA256
from Crypto.PublicKey import RSA
from Crypto.Signature import PKCS1_v1_5

notary = 'https://notary.directdemocracy.vote'


def public_key(key):
    return key.publicKey().exportKey('PEM')[27:-25].decode('ascii').replace("\n", '')

def generate_app():
    key = RSA.generate(2048)
    key_file = 'id_rsa'
    with open(key_file, 'wb') as file:
        os.chmod(key_file, 0o600)
        file.write(key.exportKey('PEM'))
    pkey_file = 'id_rsa.pub'
    with open(pkey_file, 'wb') as file:
        file.write(key.publickey().exportKey('PEM'))

def generate_citizens(save=False):
    with open('id_rsa', 'r') as file:
        app_key = RSA.importKey(file.read())
    if not os.path.isdir('key'):
        os.mkdir('key')
    for filename in os.listdir('citizen'):
        if filename.endswith('.json'):
            citizen_name = filename[:-5]
            print(citizen_name, end='', flush=True)
            citizen_file = os.path.join('citizen', filename)
            with open(citizen_file, 'r', encoding='utf8') as file:
                citizen = json.load(file)
            citizen['published'] = int(time.time())
            picture_file = os.path.join('picture', citizen_name + '.jpg')
            if not os.path.isfile(picture_file):
                sys.exit('missing ' + picture_file)
            file = open(picture_file, 'rb')
            if not file:
                sys.exit('Cannot open ' + picture_file)
            picture = file.read()
            citizen['picture'] = 'data:image/jpeg;base64,' + base64.b64encode(picture).decode('ascii')
            key = RSA.generate(2048)
            key_file = os.path.join('key', citizen_name + '.pem')
            with open(key_file, 'wb') as file:
                os.chmod(key_file, 0o600)
                file.write(key.exportKey('PEM'))
            citizen['key'] = public_key(key)
            citizen['signature'] = ''
            citizen['appKey'] = public_key(app_key)
            citizen['appSignature'] = ''
            message = json.dumps(citizen, ensure_ascii=False, separators=(',', ':')).encode('utf8')
            h = SHA256.new(message)
            citizen['signature'] = base64.b64encode(PKCS1_v1_5.new(key).sign(h)).decode('utf8')
            message = json.dumps(citizen, ensure_ascii=False, separators=(',', ':')).encode('utf8')
            h = SHA256.new(message)
            citizen['appSignature'] = base64.b64encode(PKCS1_v1_5.new(app_key).sign(h)).decode('utf8')
            url = notary + '/api/publish.php'
            response = requests.post(url, json=citizen)
            try:
                answer = json.loads(response.text)
            except ValueError:
                sys.exit('Failure: ' + response.text)
            if 'signature' not in answer:
                if 'error' in answer:
                    sys.exit('Error: ' + answer['error'])
                else:
                    sys.exit('Error: ' + response.text)
            if save:
                with open(citizen_file, 'w', encoding='utf8', newline='\n') as file:
                    file.write(json.dumps(citizen, indent=4, ensure_ascii=False))
                    file.write("\n")
            print('.', end='', flush=True)
            print('')


def generate_endorsements():
    with open('id_rsa', 'r') as file:
        app_key = RSA.importKey(file.read())
    for citizen_filename in os.listdir('citizen'):
        if citizen_filename.endswith('.json'):
            citizen_name = citizen_filename[:-5]
            print(citizen_name + ':', end='', flush=True)
            citizen_file = os.path.join('citizen', citizen_filename)
            with open(citizen_file, 'r', encoding='utf8') as file:
                citizen = json.load(file)
            for endorsed_filename in os.listdir('citizen'):
                if endorsed_filename.endswith('.json') and endorsed_filename != citizen_filename:
                    endorsed_name = endorsed_filename[:-5]
                    endorsed_file = os.path.join('citizen', endorsed_filename)
                    with open(endorsed_file, 'r', encoding='utf8') as file:
                        endorsed = json.load(file)
                    endorsement = {}
                    endorsement['schema'] = 'https://directdemocracy.vote/json-schema/2/endorsement.schema.json'
                    endorsement['key'] = citizen['key']
                    endorsement['signature'] = ''
                    endorsement['published'] = int(time.time())
                    endorsement['appKey'] = public_key(app_key)
                    endorsement['appSignature'] = ''
                    endorsement['endorsedSignature'] = endorsed['signature']
                    message = json.dumps(endorsement, ensure_ascii=False, separators=(',', ':')).encode('utf8')
                    h = SHA256.new(message)
                    key_file = os.path.join('key', citizen_name + '.pem')
                    with open(key_file, 'r') as file:
                        key = RSA.importKey(file.read())
                    endorsement['signature'] = base64.b64encode(PKCS1_v1_5.new(key).sign(h)).decode('utf8')
                    message = json.dumps(endorsement, ensure_ascii=False, separators=(',', ':')).encode('utf8')
                    h = SHA256.new(message)
                    endorsement['appSignature'] = base64.b64encode(PKCS1_v1_5.new(app_key).sign(h)).decode('utf8')
                    print(' ' + endorsed_name, end='', flush=True)
                    response = requests.post(notary + '/api/publish.php', json=endorsement)
                    try:
                        answer = json.loads(response.text)
                    except ValueError:
                        sys.exit('Failure: ' + response.text)
                    if 'error' in answer:
                        sys.exit('Error: ' + answer['error'])
            print('')


# generate_app()
generate_citizens()
generate_endorsements()
