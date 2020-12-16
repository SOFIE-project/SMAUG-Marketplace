import os
import sys
sys.path.append('../')

import json
import requests
import yaml
from project.config import BaseConfig
from project.did_utils import solve_did_challenge, build_client_wallet, create_mock_wallet
from project.models.smartLocker import SmartLockerJSONSerializer


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
LOCKER = ADDR + "/api/lockers"
GETTOKEN = ADDR + "/api/marketplace/gettoken"


mocked_data_path = os.path.join("tests", "mock_db_data.yaml")
with open(mocked_data_path, "r") as mock_data_content:
    mock_data = yaml.load(mock_data_content, Loader=yaml.SafeLoader)

WALLET_PATH = os.path.abspath(os.path.join("tests", 'mock_did_wallet.yaml'))


def test_add_user():
    print('\n... register users ...\n')
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


def test_challenge_did():
    print('\n... Get did challenges ...\n')
    for user in mock_data['smart_locker_owners']:
        response = requests.post(CHALLENGE_URL, json={'did': user['did']})
        print("challenge: ", response.text)
        user['challenge'] = json.loads(response.text)['message']


def test_get_token():
    print('\n... Solve challenge and get token ...\n')
    for user in mock_data['smart_locker_owners']:
        print('\n' + user['name'] + ' challenge ' + user['challenge'])
        proof = solve_did_challenge(build_client_wallet(WALLET_PATH), user['challenge'])
        payload = {'did': user['did'], 'challenge': user['challenge'], 'proof': proof}
        response = requests.post(TOKEN_URL, json=payload)
        if response.status_code is not 200:
            response = json.loads(response.content)
            print('Error ' + response['error'] + ', ' + response['message'])
            exit(1)
        response = json.loads(response.content)
        user['token'] = response['message']
        print('\n' + user['name'] + " token ", user['token'])


def test_authorization_header():
    print('\n... Testing Authorization token decorator ...')
    for user in mock_data['smart_locker_owners']:
        headers = {
            'Access-Control-Allow-Origin': '*',
            'Content-Type': 'application/json',
            'Authorization': user['token']
            #'Authorization': 'WrongToken'
        }
        response = requests.post(TEST_AUTH_DECORATOR, headers=headers)
        if response.status_code is not 200:
            response = json.loads(response.text)
            print('\n' + user['name'] + response['message'])
            exit(1)
        response = json.loads(response.text)
        print('\n' + user['name'] + ' ' + response['message'])


def test_add_lockers():
    print('\n... Add new locker ...\n')
    for locker, owner in zip(mock_data['smart_lockers'], mock_data.get('smart_locker_owners')):
        headers = {
            'Access-Control-Allow-Origin': '*',
            'Content-Type': 'application/json',
            'Authorization': owner.get('token')
        }
        response = requests.post(LOCKER, headers=headers, json=locker)
        if response.status_code is not 200:
            print("\nProlem for ", locker["name"], )
            print("Error Code: ", response.status_code)
            print("Error message: ", json.loads(response.content)["message"])
            return None
        else:
            print("\nAdded ", locker["name"])


def test_gettoken():
    print('\n... Get Token ...\n')
    test_token = mock_data["smart_locker_owners"][0].get("token")
    headers = {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json',
        'Authorization': test_token
    }
    response = requests.get(GETTOKEN, headers=headers, params='ethereum_address=0x4e02C82cF5F41090a6B73Ec4ED3fE1f64f9CB5bd')
    if response.status_code is not 200:
        print("Get token failed")
        print(response.status_code)
        print(response.content)
    else:
        digest = json.loads(response.content).get("digest")
        print("\nToken: ",digest)


def clear_db():
    print('\n Removing lockers form db \n')
    for locker in mock_data['smart_lockers']:
        response = requests.delete(LOCKER +"/"+ locker["id"])
        if response.status_code == 201:
            message = json.loads(response.content)['message']
            print("\n ", message)
        else:
            print("Locker not removed")
            exit()
    print('\n Removing users form db \n')
    for user in mock_data['smart_locker_owners']:
        response = requests.delete(REMOVE_USER + user['name'])
        if response.status_code == 201:
            message = json.loads(response.content)['message']
            print("\n ",message)
        else:
            print("User not removed")
            exit()


def main():
    print("___ INITIATING SMAUG API TESTS ___")
    print("\nAddress ", ADDR)
    test_add_user()
    test_challenge_did()
    test_get_token()
    test_authorization_header()
    test_add_lockers()
    test_gettoken()
    clear_db()


if __name__ == '__main__':
    main()