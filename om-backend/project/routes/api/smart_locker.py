from typing import Dict, Tuple
import flask
from flask import jsonify
from werkzeug.http import HTTP_STATUS_CODES
from project import app_config
from project.routes.api import blueprint
from project.routes.api.errors import error_response
from project.routes.api.authorization import verify_token


@blueprint.route("/lockers", methods=["POST"])
@verify_token
def register_new_locker(owner_id):
    from project.models.smartLocker import SmartLocker, SmartLockerJSONDeserializer
    from project.models.smartLockerOwner import SmartLockerOwner
    locker_details = flask.request.json
    (are_details_valid, error_message) = _validate_locker_details(locker_details)
    if are_details_valid:
        smart_locker = SmartLockerJSONDeserializer().decode(locker_details)
    else:
        return error_response(400, error_message)
    smart_locker = SmartLocker(id=locker_details.get("id"), name=locker_details.get("name"), description=locker_details.get("description"), lat=locker_details.get("location").get("lat"), lon=locker_details.get("location").get("lon"), loc_description=locker_details.get("loc_description"), icon_image=locker_details.get("icon_image"), lock_mechanism=locker_details.get("lock_mechanism"), owner_id=owner_id, chain_id=locker_details.get("chain_id"), marketplace_smart_contract_address=locker_details.get("marketplace_smart_contract_address"))
    from project.models import db
    sm_owner = SmartLockerOwner.query.filter_by(name=owner_id).first()
    smart_locker.owner_id = sm_owner.id

    # Only one locker with the given name can be registered for each user.
    exists_locker_with_same_name_for_owner = db.session.query(db.exists().where(SmartLocker.name == locker_details.get("name") and SmartLocker.owner_id == owner_id)).scalar()
    if exists_locker_with_same_name_for_owner:
        return error_response(409)

    # Add marketplace-related info to locker, by using default marketplace smart contract address and chain id.
    from project.web3 import marketplace_sc, eth_chain_id
    smart_locker.marketplace_smart_contract_address = marketplace_sc.address
    smart_locker.chain_id = eth_chain_id

    db.session.add(smart_locker)
    db.session.commit()
    smart_locker_id = smart_locker.id
    
    response = flask.jsonify(id=smart_locker_id)
    response.status_code = 200
    return response


#Just for testing
@blueprint.route("/lockers/<string:id>", methods=["DELETE"])
def remove_locker(id: str):
    from project.models.smartLocker import SmartLocker
    from project.models import db
    smart_locker = SmartLocker.query.filter_by(id=id).first()
    if smart_locker is None:
        return error_response(404)
    db.session.delete(smart_locker)
    db.session.commit()
    message = id + ' removed'
    response = jsonify({'message': message})
    response.status_code = 201
    return response

def _validate_locker_details(locker_details: Dict) -> Tuple[bool, str]:
    import urllib.parse, requests, json
    sr_endpoint = app_config.SR_ENDPOINT_URL
    sr_path = urllib.parse.urljoin(sr_endpoint, "api/validate")
    response = requests.post(sr_path, json={"message": locker_details, "schema_name": app_config.SR_SCHEMA_NAME})
    if response.status_code == 204:
        return True, None
    else:
        return False, response.json()["message"]


@blueprint.route("/lockers/<locker_id>", methods=["GET"])
def get_locker_details(locker_id: str):
    from project.models.smartLocker import SmartLocker, SmartLockerJSONSerializer
    smart_locker = SmartLocker.query.get(locker_id)
    if smart_locker is None:
        return error_response(404)
    response: flask.Response = flask.jsonify(SmartLockerJSONSerializer().default(smart_locker))
    response.status_code = 200
    return response


@blueprint.route("/lockers/<locker_id>/requests", methods=["GET"])
def get_locker_open_requests(locker_id: str):
    from project.models.smartLocker import SmartLocker
    from project.models.marketplaceReq import MarketplaceRequest
    from distutils import util

    smart_locker = SmartLocker.query.get(locker_id)
    if smart_locker is None:
        return error_response(404)

    def filter_request(req: Tuple[int, str]) -> bool:
        return req[1] == "open" if flask.request.args.get("only_open") is not None and util.strtobool(flask.request.args.get("only_open")) else True

    requests = filter(filter_request, [entry for entry in MarketplaceRequest.query.with_entities(MarketplaceRequest.id,MarketplaceRequest.status).filter(MarketplaceRequest.locker_id == locker_id).all()])

    result = {"open": [], "closed": [], "decided": []}

    for req in requests:
        result[req[1]].append(req[0])           # Since request possible status matches dict keys, we can use that

    response: flask.Response = flask.jsonify(result)
    response.status_code = 200
    return response