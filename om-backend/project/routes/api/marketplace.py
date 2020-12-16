from project.routes.api import blueprint
from project import app_config
from werkzeug.http import HTTP_STATUS_CODES
from web3 import Web3
from web3.contract import Contract
from project.routes.api.errors import error_response
from typing import Tuple
import flask
from project.routes.api.authorization import verify_token


@blueprint.route("/marketplace/gettoken", methods=["GET"])
# @verify_token
# def get_marketplace_token(owner_id):
def get_marketplace_token():
    from project.web3 import marketplace_sc
    from flask import request, Response, jsonify
    eth_address = request.args.get("ethereum_address")
    if eth_address is None:
        return Response(status=422)
    if not Web3.isAddress(eth_address):
        return Response(status=400)
        
    token = _generate_function_signed_token_with_account(marketplace_sc, "submitAuthorisedRequest", eth_address, app_config.ETHEREUM_MARKETPLACE_OWNER_ADDRESS)
    response: Response = jsonify(token)
    response.status_code = 200
    return response


def _generate_function_signed_token_with_account(contract: Contract, function_name: str, requestor_account: str, manager_account: str) -> dict:
    from eth_utils import function_abi_to_4byte_selector
    from project.web3 import web3_instance
    import secrets
    function_abi = contract.get_function_by_name(function_name).abi
    function_abi_encoded = function_abi_to_4byte_selector(function_abi).hex()
    random_nonce = "0x" + secrets.token_hex(32)
    message = random_nonce + function_abi_encoded + requestor_account[2:] + contract.address[2:]
    digest = web3_instance.solidityKeccak(["string", "bytes", "bytes", "bytes", "bytes"], ["\x19Ethereum Signed Message:\n76", random_nonce, "0x" + function_abi_encoded, requestor_account, contract.address]).hex()
    signature = web3_instance.eth.sign(manager_account, hexstr=message).hex()
    signature = _update_signature_against_malleability(signature, web3_instance)

    return {"digest": digest, "encoded": message, "signature": signature, "nonce": random_nonce}

# From https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/contracts/cryptography/ECDSA.sol#L50 (translated from JS)
def _update_signature_against_malleability(signature: str, web3: Web3) -> str:
    v = "0x" + signature[-2:]
    v_decimal = int(v, 16)

    if v_decimal <= 1:
        v_decimal += 27
        v = web3.toHex(v_decimal)

    return signature[:-2] + v[2:]

@blueprint.route("/marketplace/requests/<request_id>/offers", methods=["GET"])
def get_offers_for_request(request_id):
    from project.models.marketplaceReq import MarketplaceRequest
    from project.models.marketplaceOff import MarketplaceOffer
    from distutils import util

    request = MarketplaceRequest.query.get(request_id)
    if request is None:
        return error_response(404)

    def filter_offer(off: Tuple[int, int]) -> bool:
        return off[1] == 0 if flask.request.args.get("auction_only") is not None and util.strtobool(flask.request.args.get("auction_only")) else True

    offer_ids_filtered = filter(filter_offer, [entry for entry in MarketplaceOffer.query.with_entities(MarketplaceOffer.id,MarketplaceOffer.offer_type).filter(MarketplaceOffer.request_id == request_id).all()])
    offer_ids = [offer[0] for offer in offer_ids_filtered]

    response: flask.Response = flask.jsonify(offer_ids)
    response.status_code = 200
    return response