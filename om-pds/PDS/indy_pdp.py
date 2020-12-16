from indy import did,wallet,crypto, anoncreds
import asyncio
import base64
import random
import json

class Indy_pdp:
    def __init__(self):
        with open('conf/indy.conf') as f:
            conf = json.load(f)
        self.acl = conf['acl']
        self.password = conf['admin_password']


    def create_nonce(self, length=30):
        return ''.join([str(random.randint(0, 9)) for i in range(length)])

    def add_did(self, client_did, client_verkey, metadata, password):
        if (password != self.password):
            return 401
        self.acl[client_did] = {}
        self.acl[client_did]['ver_key'] = client_verkey
        self.acl[client_did]['jwt_metadata'] = json.loads(metadata)
        return 200

    def authorize(self, grant, challenge = None, signature=None, only_wallet_lookup=False, user_generated_challenge=False):
        if (grant !=None and challenge == None):
            return 401, self.create_nonce()
        if (grant != None and challenge != None and signature != None):
            if not grant in self.acl:
                return 403, 'Signature verification failed'
            did = self.acl[grant]
            verkey = did['ver_key']
            verification = asyncio.get_event_loop().run_until_complete(
                crypto.crypto_verify(verkey, challenge.encode(), base64.b64decode(signature)))
            if(verification):
                return 200,  json.dumps(did['jwt_metadata'])
            else:
                return 403, 'Signature verification failed'
        else:
            return 403, 'Invalide or missing input parameters'
