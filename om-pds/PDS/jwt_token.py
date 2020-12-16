import json
import random
import base64
import jwt
import nacl.encoding
from nacl.public import SealedBox

class JWT_token:
   def generate_token(self, private_key, metadata = None, enc_key=None, token_type=None ):
        claims = {}
        metadata = json.loads(metadata)
        #create token_id
        if 'aud' in metadata:
            claims['aud'] = metadata['aud']
        if 'sub' in metadata:
            claims['sub'] = metadata['sub']
        if 'exp' in metadata:
            claims['exp'] = metadata['exp']
        if 'nbf' in metadata:
            claims['nbf'] = metadata['nbf']
        claims['jti'] = random.getrandbits(256)
        token = jwt.encode(claims,private_key, algorithm='RS256')
        if enc_key:
            public_key = nacl.public.PublicKey(enc_key,nacl.encoding.HexEncoder)
            sealed_box = SealedBox(public_key)
            token = sealed_box.encrypt(token)
            token = base64.urlsafe_b64encode(token)
        #return 200, {'code':200,'message':token.decode('utf-8')}
        return token, claims