from werkzeug.wrappers import Request, Response
from erc721_token import ERC721_token
from jwt_token import JWT_token
from indy_pdp import Indy_pdp
from token_logger import Token_logger
from auth_code_pdp import Auth_code_pdp
import json
    
class PDS():
    def __init__(self):
        with open('conf/pds.conf') as f:
            self.conf = json.load(f)
        self.erc721    = ERC721_token()
        self.indy_pdp  = Indy_pdp()
        self.jwt_token = JWT_token()
        self.logger    = Token_logger()
        self.auth_code = Auth_code_pdp()

    def wsgi_app(self, environ, start_response):
        req  = Request(environ)
        form = req.form
        code = 403
        output = 'Invalide or missing input parameters'.encode()
        grant_type        = form.get("grant-type", None)
        grant             = form.get("grant", None)
        challenge         = form.get("challenge", None)
        proof             = form.get("proof", None)
        log_token         = form.get("log-token", None)
        enc_key           = form.get("enc-key", None)
        record_erc721     = form.get("erc-721", None)
        action            = form.get("action", None)
        if (action == "add"): # Administrative interface
            metadata  = form.get("metadata", None)
            client_did = form.get("did", None)
            client_verkey = form.get("verkey", None)
            password  = form.get("password", None)
            code = self.indy_pdp.add_did(client_did, client_verkey, metadata, password)
            output = "OK"
            response = Response(output, status=code, mimetype='application/json')
            return response(environ, start_response) 
        if (grant_type == "DID"):
            code, output = self.indy_pdp.authorize(grant, challenge, proof, True)
            if code == 200:
                metadata = output
        if (grant_type == "auth_code"):
            code = self.auth_code.authorize(grant)
            metadata  = form.get("metadata", None)
        if (code == 200):
            with open(self.conf['as_private_key'], mode='rb') as file: 
                as_private_key = file.read()
            token,claims = self.jwt_token.generate_token(as_private_key, metadata, enc_key)
            output = token.decode('utf-8')
            if (log_token):
                self.logger.log_token(log_token, output)
                print("token logged")
            if (record_erc721):
                self.erc721.record_erc721(claims['jti'], output)
                print("Creating ERC-721 token")
        response = Response(output, status=code, mimetype='application/json')
        return response(environ, start_response)
    
    def __call__(self, environ, start_response):
        return self.wsgi_app(environ, start_response)

def main(): 
    from werkzeug.serving import run_simple
    app = PDS()
    run_simple('0.0.0.0', 9001, app)

if __name__ == '__main__':
    main()