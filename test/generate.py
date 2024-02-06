import base64
import datetime
import json
import os
import pathlib
import random
import requests
import secrets
import sys
import time

from Crypto.Hash import SHA256, SHA384
from Crypto.PublicKey import RSA
from Crypto.Signature import PKCS1_v1_5, pss


# the station keys should be stored in key/station/id_rsa[.pub]
# the test app keys should be stored in key/app/id_rsa[.pub]

notary = 'https://notary.directdemocracy.vote'
judge_key = 'wir1Zite7d6pAbuaiISFc+/zB1h/8ZY3gl02DgAPKEOspYmybvPKE1yGwNT5FaHNUjsQfG6n5AoQmZlDr+v5ByNiSIDdOYAQALE3hBV41B/h/miMQSMuMb+VoduuiXhsvrfZLajt5E6UDj29EnB0z0J+BSMqET1qDhi80I3mAIS5WvvSw4USOxdyKV50foymzfGlP2cYyYAtFzjYyLmuORcBC10GZM3dEraUTfRZPGx8Q1wUWGy5miOlkjkVqa2ucl72gD7KBnkqjPW9r3/g1VkkzzWA1bEbwwGdLBVHhY1r41dWDtR7CxYtSZjUjRRUOLCIcMFuaGs6zVad+0W+uw'


def public_key(key):
    # we remove the first 70 characters, e.g., "-----BEGIN PUBLIC KEY-----MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA"
    # and the last 30 character "IDAQAB-----END PUBLIC KEY-----" so that the total length is reduced to 343 characters
    return key.publickey().exportKey('PEM').decode('utf8').replace("\n", '')[70:-30]


def generate_app():
    key = RSA.generate(2048)
    pathlib.Path('key/app').mkdir(parents=True, exist_ok=True)
    key_file = 'key/app/id_rsa'
    with open(key_file, 'wb') as file:
        os.chmod(key_file, 0o600)
        file.write(key.exportKey('PEM'))
    pkey_file = 'key/app/id_rsa.pub'
    with open(pkey_file, 'wb') as file:
        file.write(key.publickey().exportKey('PEM'))


def generate_citizens():
    pathlib.Path('key/citizen').mkdir(parents=True, exist_ok=True)
    with open('key/app/id_rsa', 'r') as file:
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
            citizen['picture'] = 'data:image/jpeg;base64,' + \
                base64.b64encode(picture).decode('utf8')
            key = RSA.generate(2048)
            key_file = os.path.join('key', 'citizen', citizen_name + '.pem')
            with open(key_file, 'wb') as file:
                os.chmod(key_file, 0o600)
                file.write(key.exportKey('PEM'))
            citizen['key'] = public_key(key)
            citizen['signature'] = ''
            citizen['appKey'] = public_key(app_key)
            citizen['appSignature'] = ''
            message = json.dumps(citizen, ensure_ascii=False, separators=(',', ':')).encode('utf8')
            h = SHA256.new(message)
            citizen['signature'] = base64.b64encode(PKCS1_v1_5.new(key).sign(h)).decode('utf8')[:-2]
            h = SHA256.new(citizen['signature'].encode('utf-8'))
            citizen['appSignature'] = base64.b64encode(PKCS1_v1_5.new(app_key).sign(h)).decode('utf8')[:-2]
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
            output = os.path.join('output', 'citizen', filename)
            with open(output, 'w', encoding='utf8', newline='\n') as file:
                file.write(json.dumps(citizen, indent=4, ensure_ascii=False))
                file.write("\n")
            print('.', end='', flush=True)
            print('')


def generate_endorsements(folder=None):
    with open('key/app/id_rsa', 'r') as file:
        app_key = RSA.importKey(file.read())
    for citizen_filename in os.listdir('output/citizen'):
        if citizen_filename.endswith('.json'):
            citizen_name = citizen_filename[:-5]
            print(citizen_name + ':', end='', flush=True)
            citizen_file = os.path.join('output', 'citizen', citizen_filename)
            with open(citizen_file, 'r', encoding='utf8') as file:
                citizen = json.load(file)
            if folder is None:
                folder = 'output/citizen'
            for endorsed_filename in os.listdir(folder):
                if endorsed_filename.endswith('.json') and endorsed_filename != citizen_filename:
                    endorsed_name = endorsed_filename[:-5]
                    endorsed_file = os.path.join(folder, endorsed_filename)
                    with open(endorsed_file, 'r', encoding='utf8') as file:
                        endorsed = json.load(file)
                    endorsement = {}
                    endorsement['schema'] = 'https://directdemocracy.vote/json-schema/2/certificate.schema.json'
                    endorsement['key'] = citizen['key']
                    endorsement['signature'] = ''
                    endorsement['published'] = int(time.time())
                    endorsement['appKey'] = public_key(app_key)
                    endorsement['appSignature'] = ''
                    endorsement['type'] = 'endorse'
                    endorsement['publication'] = endorsed['signature']
                    message = json.dumps(endorsement, ensure_ascii=False, separators=(',', ':')).encode('utf8')
                    h = SHA256.new(message)
                    key_file = os.path.join('key', 'citizen', citizen_name + '.pem')
                    with open(key_file, 'r') as file:
                        key = RSA.importKey(file.read())
                    endorsement['signature'] = base64.b64encode(PKCS1_v1_5.new(key).sign(h)).decode('utf8')[:-2]
                    h = SHA256.new(endorsement['signature'].encode('utf-8'))
                    endorsement['appSignature'] = base64.b64encode(PKCS1_v1_5.new(app_key).sign(h)).decode('utf8')[:-2]
                    response = requests.post(notary + '/api/publish.php', json=endorsement)
                    try:
                        answer = json.loads(response.text)
                    except ValueError:
                        print(endorsement)
                        sys.exit('Failure: ' + response.text)
                    if 'error' in answer:
                        sys.exit('Error: ' + answer['error'])
                    else:
                        print(' ' + endorsed_name, end='', flush=True)
            print('')


def generate_trusts():
    answer = requests.get('https://judge.directdemocracy.vote/api/trust.php')
    print(answer.text)


def generate_proposals():
    for proposal_filename in os.listdir('proposal'):
        if not proposal_filename.endswith('.json'):
            continue
        print(proposal_filename[:-5], end='', flush=True)
        filename = os.path.join('proposal', proposal_filename)
        with open(filename, 'r', encoding='utf8') as file:
            proposal = json.load(file)
            if 'area_name' in proposal:
                answer = requests.get('https://judge.directdemocracy.vote/api/publish_area.php?' + proposal['area_name'])
                try:
                    j = answer.json()
                except ValueError:
                    print(': ' + answer.text)
                    quit()
                if 'error' in j:
                    print(': ' + j['error'])
                    quit()
                proposal['area'] = j['id']
                del proposal['area_name']
            if proposal['published'] == '':
                proposal['published'] = int(time.time())
            elif not isinstance(proposal['published'], int):
                proposal['published'] = datetime.datetime.fromisoformat(
                    proposal['published']).timestamp()
            if not isinstance(proposal['deadline'], int):
                proposal['deadline'] = datetime.datetime.fromisoformat(
                    proposal['deadline']).timestamp()
            answer = requests.post('https://judge.directdemocracy.vote/api/publish_proposal.php', json=proposal).json()
            if 'error' in answer:
                print(': ' + answer['error'])
            else:
                print('.')
            proposal['key'] = judge_key
            proposal['signature'] = answer['signature']
            output = os.path.join('output', 'proposal', proposal_filename)
            with open(output, 'w', encoding='utf8', newline='\n') as file:
                file.write(json.dumps(proposal, indent=4, ensure_ascii=False))
                file.write("\n")


def generate_signatures_and_votes(rate):
    print('Generating signatures')
    with open('key/app/id_rsa', 'r') as file:
        app_key = RSA.importKey(file.read())
    with open('key/station/id_rsa', 'r') as file:
        station_key = RSA.importKey(file.read())
    for citizen_filename in os.listdir('output/citizen'):
        if citizen_filename.endswith('.json'):
            citizen_name = citizen_filename[:-5]
            print(citizen_name + ':', end='', flush=True)
            citizen_file = os.path.join('output', 'citizen', citizen_filename)
            with open(citizen_file, 'r', encoding='utf8') as file:
                citizen = json.load(file)
            for proposal_filename in os.listdir('output/proposal'):
                if not proposal_filename.endswith('.json'):
                    continue
                if random.randrange(100) / 100 > rate:
                    continue
                print(' ' + proposal_filename[:-5], end='', flush=True)
                proposal_filename = os.path.join('output', 'proposal', proposal_filename)
                with open(proposal_filename, 'r', encoding='utf8') as file:
                    proposal = json.load(file)
                    if proposal['type'] == 'referendum':
                        r = requests.get('https://notary.directdemocracy.vote/api/publish_area.php?judge=' +
                                          requests.utils.quote(proposal['key']) +
                                          '&lat=' + str(citizen['latitude']) + '&lon=' + str(citizen['longitude']))
                        answer = r.json()
                        if 'error' in answer:
                            print('Could not get local area from notary')
                            quit()
                        if 'key' in answer and answer['key'] != proposal['key']:
                            print('Wrong judge key returned by notary for local area.')
                            quit()
                        area = int(answer['id'])
                        choice_index = random.randrange(len(proposal['answers'] * 5) + 1)
                        choice = '' if choice_index == 0 else proposal['answers'][int((choice_index - 1) / 5)]
                        participation = {}
                        participation['schema'] = 'https://directdemocracy.vote/json-schema/2/participation.schema.json'
                        participation['key'] = citizen['key']
                        participation['signature'] = ''
                        participation['published'] = int(time.time())
                        participation['appKey'] = public_key(app_key)
                        participation['appSignature'] = ''
                        participation['referendum'] = proposal['signature']
                        participation['area'] = area
                        message = json.dumps(participation, ensure_ascii=False, separators=(',', ':')).encode('utf8')
                        h = SHA256.new(message)
                        key_file = os.path.join('key', 'citizen', citizen_name + '.pem')
                        with open(key_file, 'r') as file:
                            key = RSA.importKey(file.read())
                        participation['signature'] = base64.b64encode(PKCS1_v1_5.new(key).sign(h)).decode('utf8')[:-2]
                        h = SHA256.new(participation['signature'].encode('utf-8'))
                        participation['appSignature'] = base64.b64encode(PKCS1_v1_5.new(app_key).sign(h)).decode('utf8')[:-2]
                        response = requests.post(notary + '/api/publish.php', json=participation)
                        try:
                            answer = json.loads(response.text)
                        except ValueError:
                            print(participation)
                            sys.exit('Failure: ' + response.text)
                        if 'error' in answer:
                            sys.exit('Error: ' + answer['error'])
                        else:
                            print(' (P', end='', flush=True)

                        ballot = secrets.token_bytes(32)
                        vote = {}
                        vote['schema'] = 'https://directdemocracy.vote/json-schema/2/vote.schema.json'
                        vote['key'] = public_key(station_key)
                        vote['signature'] = ''
                        vote['published'] = int(time.time())
                        vote['appKey'] = public_key(app_key)
                        vote['appSignature'] = ''
                        vote['referendum'] = proposal['signature']
                        vote['number'] = random.randrange(256)
                        vote['area'] = area
                        vote['ballot'] = base64.b64encode(ballot).decode('utf8')
                        vote['answer'] = choice
                        voteBytes = base64.b64decode(vote['referendum'] + '==')
                        voteBytes += vote['number'].to_bytes(8)
                        voteBytes += vote['area'].to_bytes(8)
                        voteBytes += ballot
                        voteBytes += str.encode(vote['answer'])
                        vote['appSignature'] = base64.b64encode(pss.new(app_key).sign(SHA384.new(voteBytes))).decode('utf8')[:-2]
                        # FIXME: the appSignature is broken (skipped by the notary publisher for the test app)
                        message = json.dumps(vote, ensure_ascii=False, separators=(',', ':')).encode('utf8')
                        h = SHA256.new(message)
                        vote['signature'] = base64.b64encode(PKCS1_v1_5.new(station_key).sign(h)).decode('utf8')[:-2]
                        response = requests.post(notary + '/api/publish.php', json=vote)
                        try:
                            answer = json.loads(response.text)
                        except ValueError:
                            print(vote)
                            sys.exit('Failure: ' + response.text)
                        if 'error' in answer:
                            print(vote)
                            sys.exit('Error: ' + answer['error'])
                        else:
                            print(', V: ' + choice + ')', end='', flush=True)
                    elif proposal['type'] == 'petition':
                        signature = {}
                        signature['schema'] = 'https://directdemocracy.vote/json-schema/2/certificate.schema.json'
                        signature['key'] = citizen['key']
                        signature['signature'] = ''
                        signature['published'] = int(time.time())
                        signature['appKey'] = public_key(app_key)
                        signature['appSignature'] = ''
                        signature['type'] = 'sign'
                        signature['publication'] = proposal['signature']
                        message = json.dumps(signature, ensure_ascii=False, separators=(',', ':')).encode('utf8')
                        h = SHA256.new(message)
                        key_file = os.path.join('key', 'citizen', citizen_name + '.pem')
                        with open(key_file, 'r') as file:
                           key = RSA.importKey(file.read())
                        signature['signature'] = base64.b64encode(PKCS1_v1_5.new(key).sign(h)).decode('utf8')[:-2]
                        h = SHA256.new(signature['signature'].encode('utf-8'))
                        signature['appSignature'] = base64.b64encode(PKCS1_v1_5.new(app_key).sign(h)).decode('utf8')[:-2]
                        response = requests.post(notary + '/api/publish.php', json=signature)
                        try:
                            answer = json.loads(response.text)
                        except ValueError:
                            sys.exit('Failure: ' + response.text)
                        if 'error' in answer:
                            print(signature)
                            sys.exit('Error: ' + answer['error'])
                        print(' (S),', end='', flush=True)
                    else:
                        print('ERROR: unsupported proposal type: ' + proposal['type'])
            print('')


#generate_citizens()
#generate_endorsements()
generate_endorsements('output/other')
#generate_trusts()
#generate_proposals()
#generate_signatures_and_votes(1)
