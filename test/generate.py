import base64
import json
import os
import sys

for filename in os.listdir('citizen'):
    if filename.endswith('.json'):
        citizen_name = filename[:-5]
        print(citizen_name)
        citizen_file = os.path.join('citizen', filename)
        if not os.path.isfile(citizen_file):
            sys.exit('missing ' + citizen_file)
        with open(citizen_file, 'r', encoding='utf8') as file:
            citizen = json.load(file)
        picture_file = os.path.join('picture', citizen_name + '.jpg')
        if not os.path.isfile(picture_file):
            sys.exit('missing ' + picture_file)
        file = open(picture_file, 'rb')
        if not file:
            sys.exit('Cannot open ' + picture_file)
        picture = file.read()
        citizen['picture'] = base64.b64encode(picture).decode('ascii')
        with open(citizen_file, 'w', encoding='utf8', newline='\n') as file:
            file.write(json.dumps(citizen, indent=4, ensure_ascii=False))
            file.write("\n")

