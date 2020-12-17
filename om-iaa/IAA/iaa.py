from werkzeug.wrappers       import Request, Response
from werkzeug.datastructures import Headers
from jwt_pep                 import jwt_pep
from jwt_erc721_pep          import jwt_erc721_pep
from w3c_vc_pep              import w3c_vc_pep
from http_proxy              import http_proxy

import json
import sys
import asyncio
import requests
import base64

  

class IAAHandler():
    def __init__(self):
        with open('conf/iaa.conf') as f:
            self.conf = json.load(f)
        self.jwt_pep = jwt_pep()
        self.jwt_erc721_pep = jwt_erc721_pep()
        self.w3c_vc_pep = w3c_vc_pep()
        self.http_proxy = http_proxy()

    def wsgi_app(self, environ, start_response):
        req      = Request(environ)
        path     = environ.get('PATH_INFO')
        code     = 403
        resource = {}
        output = 'Invalide or missing input parameters'
        output_header = {}
        auth    = req.headers.get('Authorization')
        if (path in self.conf['resources']):
            resource = self.conf['resources'][path]
        elif ('default' in self.conf['resources']):
            resource = self.conf['resources']["default"]
        is_client_authorized = False
        error_code = 0
        if ('authorization' in resource and auth):
            auth_type, auth_grant = auth.split(" ",1)
            '''
            if (auth_type == 'VC'):
                proof = req.headers.get('VC-proof')
                if (proof):
                    verification = vc_agent.verify_token(auth_grant + proof, self.as_public_key)
                    print(verification)
                else:
                    code = 401
                    nonce = Indy.create_nonce()
                    output_header['WWW-Authenticate'] = "VC challenge=" + nonce
            if (auth_type == "DID"):
                loop = asyncio.get_event_loop()
                code, output = loop.run_until_complete(
                    Indy.verify_did(token, challenge, proof, self.wallet_handle, self.pool_handle, True))
            '''
            #*********W3C-VC***********
            if (resource['authorization']['type'] == "w3c-vc" and auth_type == "Bearer-W3C-VC"):
                if ('signing_key' not in resource['authorization']):
                    with open(resource['authorization']['signing_key_file'], mode='rb') as file: 
                        resource['authorization']['signing_key'] = file.read()
                result, error_code = self.w3c_vc_pep.verify_w3c_vc(vc=base64.urlsafe_b64decode(auth_grant).decode(), 
                    signing_key  = resource['authorization']['signing_key'],  
                    filter= resource['authorization']['filters'])
                if (result == True):
                    is_client_authorized = True

            #*********JWT***********
            if (resource['authorization']['type'] == "jwt" and auth_type == "Bearer"):
                if ('signing_key' not in resource['authorization']):
                    with open(resource['authorization']['signing_key_file'], mode='rb') as file: 
                        resource['authorization']['signing_key'] = file.read()
                result, error_code = self.jwt_pep.verify_bearer(token=auth_grant, 
                    signing_key  = resource['authorization']['signing_key'], 
                    tokens_expire = resource['authorization']['tokens_expire'], 
                    filter= resource['authorization']['filters'])
                if (result == True):
                    is_client_authorized = True

            #*********JWT+ERC721*********** 
            if (resource['authorization']['type'] == "jwt-erc721" and auth_type == "Bearer-ERC721"):
                if ('signing_key' not in resource['authorization']):
                    with open(resource['authorization']['signing_key_file'], mode='rb') as file: 
                        resource['authorization']['signing_key'] = file.read()
                result, error_code = self.jwt_erc721_pep.verify_bearer_erc721(auth_grant, resource['authorization']['signing_key'])
                if (result == True):
                    is_client_authorized = True
        elif('authorization' not in resource):
            is_client_authorized = True
        if (is_client_authorized):
            if ('proxy' in  resource):
                code, output = self.http_proxy.forward(environ, resource['proxy']['proxy_pass'], resource['proxy'].get('header_rewrite'))
            else:
                code = 200
                output = "OK"
        else:
            code = 401
            output = str(error_code)
        response = Response(output.encode(), status=code, mimetype='application/json')
        if output_header:
            for key,value in output_header.items():
                response.headers.add(key, value)
        return response(environ, start_response)
        
    def __call__(self, environ, start_response):
        return self.wsgi_app(environ, start_response)

def create_app():
    app = IAAHandler()
    return app

def main(): 
    from werkzeug.serving import run_simple
    app = create_app()
    run_simple('', 9000, app)

if __name__ == '__main__':
    main()
