import json
from flask import request, jsonify
from functools import wraps
from werkzeug.http import HTTP_STATUS_CODES
from project.routes.api import blueprint
from project.routes.api.errors import bad_request, error_response
from project.authorization_server import AuthorizationServer


auth = AuthorizationServer()


# ToDo Move this decorator somewhere else if needed
def verify_token(f):
    @wraps(f)
    def wrap(*args, **kwargs):
        if not request.headers.get('authorization'):
            return bad_request('must include the token')
        response = auth.validate_token(request.headers['authorization'])
        if response.status_code == 503:
            return error_response(503, 'The server cannot handle the request')
        if response.status_code == 403:
            return error_response(403, 'Token validation failed')
        owner_id = auth.decode_token(request.headers['authorization'])
        if not owner_id or owner_id[1]['aud'] is None:
            return error_response(403, 'Token decode failed')
        return f(owner_id[1]['aud'], *args, **kwargs)
    return wrap


@blueprint.route('/registration', methods=['POST'])
def user_registration(data=None):
    from project.models.smartLockerOwner import SmartLockerOwner, smartlocker_owner_fields
    from project.models import db
    smartlocker_owner_fields.append('verkey')
    data = request.get_json() or data or {}
    if type(data) is not dict:
        data = json.loads(data)
    for field in smartlocker_owner_fields:
        if field not in data:
            return bad_request('must include correct data entry, missing: ' + str(field))
    user = SmartLockerOwner.query.filter_by(name=data['name']).first()
    if user is None:
        response = auth.add_did(data['did'], data['verkey'], data['name'])
        if response.status_code == 200:
            user = SmartLockerOwner()
            user.from_dict(data)
            db.session.add(user)
            db.session.commit()
            return good_response(200, 'Registration successful')
        if response.status_code == 403:
            return error_response(403, 'Invalid or missing input parameters')
        if response.status_code == 503:
            return error_response(503, 'The server cannot handle the request')
        if response.status_code == 500:
            return error_response(500, 'Unknown error')
        else:
            return bad_request('Unknown error')
    else:
        return error_response(409, 'User already existing')


@blueprint.route('/getchallenge', methods=['POST'])
def challenge_token(data=None):
    data = request.json or data or {}
    if 'did' not in data:
        return bad_request('must include json with did field')
    response = auth.create_challenge_response(data['did'])
    if response.status_code == 503:
        return error_response(503, 'The server cannot handle the request')
    if response.status_code == 401:
        return good_response(200, response.text)
    if response.status_code == 500:
        return error_response(500)
    else:
        return bad_request('Unknown error')


# /api/gettoken
# POST data format
# {'did': 'client did', 'challenge': 'client challenge', 'proof': 'client proof'}
#
# Returned JSON
# status codes and {'message': 'the messages about the results of the operation'}
# if the proof is valid the message contains the token
# else the message contains the error
@blueprint.route('/gettoken', methods=['POST'])
def issue_token(data=None):
    data = request.json or data or {}
    if 'did' not in data or 'challenge' not in data or 'proof' not in data:
        return bad_request('must include did, challenge and proof')
    response = auth.create_did_token_response(data['did'], data['challenge'], data['proof'])
    if response.status_code == 503:
        return error_response(503, 'The server cannot handle the request')
    if response.status_code == 200:
        token = response.text
        return good_response(200, token)
    if response.status_code == 403:
        return error_response(403, "Invalid or missing input parameters")
    if response.status_code == 500:
        return error_response(401, "proof not recognized")
    else:
        print(response.text)
        return bad_request('Unknown error')


# ToDo probably not useful anymore, analyze and remove
"""@blueprint.route('/verify_token', methods=['POST'])
def verify_token():
    data = request.json or {}
    if 'message' not in data:
        return bad_request('must include the token')
    response = auth.validate_token(data['message'])
    if response.status_code == 200:
        return good_response(200, 'Valid token')
    if response.status_code == 503:
        return error_response(503, 'The server cannot handle the request')
    if response.status_code == 403:
        return error_response(403, 'Token validation failed')
    else:
        print(response.text)
        return bad_request('Unknown error')
"""

# USED FOR TESTING
@blueprint.route('/remove_user/<string:name>', methods=['DELETE'])
def remove_user(name:str):
    from project.models.smartLockerOwner import SmartLockerOwner
    from project.models import db
    user = SmartLockerOwner.query.filter_by(name=name).first()
    if user is None:
        return error_response(404)
    db.session.delete(user)
    db.session.commit()
    message = name + ' removed'
    response = jsonify({'message': message})
    response.status_code = 201
    return response


@blueprint.route('/revoke_token', methods=['POST'])
def revoke_token():
    return auth.revoke_did_token(request)


# ToDo Remove once the decorator is used in another route
@blueprint.route('/test_route', methods=['POST'])
@verify_token
def test_route(owner_id):
    return good_response(200, 'Im verified')


def good_response(status_code, message=None):
    payload = {'message': HTTP_STATUS_CODES.get(status_code, 'Unknown error')}
    if message:
        payload['message'] = message
    response = jsonify(payload)
    response.status_code = status_code
    return response



