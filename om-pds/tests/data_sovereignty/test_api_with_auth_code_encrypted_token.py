
import pytest
import requests
import json
import datetime
import time
from nacl.public import PrivateKey, SealedBox
import nacl.encoding
import base64


def test_valid_auth_code_with_encryption():
    secret_key = PrivateKey.generate()
    public_key = secret_key.public_key.encode(nacl.encoding.HexEncoder)
    payload = {'grant-type':'auth_code', 'grant':'shared_secret_key', 
                'enc-key':public_key,
                'metadata':json.dumps({'aud': 'sofie-iot.eu'}),
        }
    response  = requests.post("http://localhost:9001/gettoken", data = payload)
    enc_token = response.text
    sealed_box = SealedBox(secret_key)
    token = sealed_box.decrypt(base64.urlsafe_b64decode(enc_token))
    print(public_key)
    print(secret_key.encode(nacl.encoding.HexEncoder))
    print(enc_token)
    assert(response.status_code == 200 ) 

