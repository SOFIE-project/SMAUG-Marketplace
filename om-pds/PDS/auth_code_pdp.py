import jwt
import json
from web3 import Web3

class Auth_code_pdp:
    def __init__(self):
        with open('conf/auth_code.conf') as f:
            conf = json.load(f)
        self.psk = conf['pre_shared_key']

    def authorize(self, grant):
        if (grant == self.psk):
            return 200
        else:
            return 403