import os
import sys
sys.path.append('../')

import json
import requests
import yaml
from project.config import BaseConfig
from project.did_utils import solve_did_challenge, build_client_wallet, create_mock_wallet

config = BaseConfig()
# OM BACKEND
ADDR = "http://" + getattr(config, 'HOST') + ":" + str(getattr(config, 'PORT'))
#ADDR = "http://127.0.0.1:61234"
ADD_DID_URL = ADDR + "/api/registration"
CHALLENGE_URL = ADDR + "/api/getchallenge"
TOKEN_URL = ADDR +"/api/gettoken"
VERIFY_TOKEN = ADDR + '/api/verify_token'
TEST_AUTH_DECORATOR = ADDR + '/api/test_route'
REMOVE_USER = ADDR + '/api/remove_user/'


mocked_data_path = os.path.join("tests", "mock_db_data.yaml")
with open(mocked_data_path, "r") as mock_data_content:
    mock_data = yaml.load(mock_data_content, Loader=yaml.SafeLoader)

WALLET_PATH = os.path.abspath(os.path.join("tests", 'mock_did_wallet.yaml'))


def setup():
    print("... Register test user ...")
    create_mock_wallet(WALLET_PATH)
    for user in mock_data['smart_locker_owners']:
        print("Register: ", user['name'])
        response = requests.post(ADD_DID_URL, json=json.dumps(user))
        if response.status_code is not 200:
            response = json.loads(response.content)
            print("Failed error: ", response['error'])
            print(response['message'])
            exit(1)
        else:
            print('-> user registered')