import base64
import json
import os
import sys
import time

from Crypto.Hash import SHA256
from Crypto.PublicKey import RSA
from Crypto.Signature import PKCS1_v1_5

for filename in os.listdir('citizen'):
    if filename.endswith('.json'):
        citizen_name = filename[:-5]
        print(citizen_name)
        citizen_file = os.path.join('citizen', filename)
        if not os.path.isfile(citizen_file):
            sys.exit('missing ' + citizen_file)
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
        citizen['picture'] = base64.b64encode(picture).decode('ascii')
        key = RSA.generate(2048)
        key_file = os.path.join('key', citizen_name + '.key')
        with open(key_file, 'wb') as file:
            os.chmod(key_file, 0o600)
            file.write(key.exportKey('PEM'))
        pubkey = key.publickey().exportKey('PEM')[27:-25].decode('ascii').replace("\n", '')
        citizen['key'] = pubkey
        message = json.dumps(citizen, ensure_ascii=False).encode('utf8')
        h = SHA256.new(message)
        citizen['signature'] = base64.b64encode(PKCS1_v1_5.new(key).sign(h)).decode('utf8')
        with open(citizen_file, 'w', encoding='utf8', newline='\n') as file:
            file.write(json.dumps(citizen, indent=4, ensure_ascii=False))
            file.write("\n")

