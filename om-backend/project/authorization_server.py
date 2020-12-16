import json, requests, time, datetime, jwt
from flask import Flask, current_app as app
from requests import Response

GRANT = 'DID'
RESOURCE_DOMAIN = 'SMAUG'
TOKEN_TYPE = 'Bearer'


class AuthorizationServer(object):

    def __init__(self):
        from project import app_config as conf
        self.add_did_url = conf.PDS_ENDPOINT_URL
        self.server_url = conf.PDS_ENDPOINT_URL
        self.challenge_url = conf.PDS_CHALLENGE_URL
        self.token_url = conf.PDS_TOKEN_URL
        self.verify_token_url = conf.IAA_VERIFY_URL

    def add_did(self, did: str, verkey: str, user: str) -> Response:
        aud = user  # The domain name of the protected resources
        payload = {'action': 'add', 'did': str(did), 'verkey': str(verkey), 'password': 'thepassword', 'metadata': json.dumps({'aud': aud})}
        return post_request(self.add_did_url, payload)

    def create_challenge_response(self, did):
        payload = {'grant-type': GRANT, 'grant': did}
        return post_request(self.challenge_url, payload)

    def create_did_token_response(self, did, challenge, proof):
        payload = {'grant-type': GRANT, 'grant': did, 'challenge': challenge, 'proof': proof}
        return post_request(self.token_url, payload)

    def revoke_did_token(self, request):
        raise NotImplementedError

    def validate_token(self, token):
        headers = {"Authorization": "Bearer " + token, "Content-Type": "application/json", "Accept": "application/json"}
        return put_request(self.verify_token_url, headers)


    @staticmethod
    def decode_token(token):
        try:
            decode = jwt.decode(token, verify=False)
        except Exception as e:
            print(e)
            return False
        return True, decode


def post_request(url, payload):
    response = requests.Response()
    try:
        response = requests.post(url, data=payload)
    except requests.exceptions.ConnectionError:
        response.status_code = 503
    return response

def put_request(url, headers, payload={}):
    response = requests.Response()
    try:
        response = requests.put(url, headers=headers, data=payload)
    except requests.exceptions.ConnectionError:
        response.status_code = 503
    return response