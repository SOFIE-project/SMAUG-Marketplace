from flask import redirect, render_template, session, url_for, json

from project.routes.user import blueprint
import requests
from project import app_config as config


@blueprint.route('/show_token', methods=['GET'])
def show_token():
    token = session.get('token')

    decoded_body = {}
    if token and 'encoded' in token:
        decoded_body = _token_body_decoder(token.get('encoded'))

    return render_template('token/token_details.html', token=session.get('token'), token_body=decoded_body, ethereum_address=config.USER_ETHEREUM_ADDRESS)


@blueprint.route('/get_token', methods=['GET'])
def get_token():
    _fetch_token(config.USER_ETHEREUM_ADDRESS)
    return redirect(url_for('.show_token'))


def _fetch_token(ethereum_address):
    server_name = config.SERVER_NAME
    r_token = requests.get('http://{}{}?ethereum_address={}'.format(server_name, url_for('api.get_marketplace_token'), ethereum_address))
    if r_token:
        session['token'] = json.loads(r_token.text)

    return r_token.text


def _token_body_decoder(encoded):
    nonce_length = 64
    selector_length = 8
    address_length = 40
    start_index = 2

    body = {}
    body['method_selector'] = encoded[start_index + nonce_length:start_index + nonce_length + selector_length]
    body['request_creator_address'] = encoded[start_index + nonce_length + selector_length : start_index + nonce_length + selector_length + address_length]
    body['contract_address'] = encoded[start_index + nonce_length + selector_length + address_length:]

    return body
