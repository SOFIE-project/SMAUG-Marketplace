import asyncio
import base64
import json
import os

import yaml
from indy import did, wallet, crypto
from indy.error import ErrorCode, IndyError


def create_wallet_did(client_wallet, seed=None):
    if 'config' not in client_wallet or 'name' not in client_wallet or 'credentials' not in client_wallet:
        raise ValueError('Missing parameters: config, name, credentials')
    loop = asyncio.get_event_loop()
    wallet_handle = loop.run_until_complete(create_wallet_handle(client_wallet))
    did_seed = '{}' if seed is None else seed
    client_did, client_verkey = loop.run_until_complete(did.create_and_store_my_did(wallet_handle, json.dumps({"seed": did_seed})))
    back_wallet = {'did': client_did, 'verkey': client_verkey}
    with open(client_wallet['name'], 'w') as outfile:
        json.dump(back_wallet, outfile)
    loop.run_until_complete(wallet.close_wallet(wallet_handle))
    #loop.close()
    return back_wallet


def solve_did_challenge(client_wallet, client_challenge):
    if 'config' not in client_wallet or 'name' not in client_wallet or 'credentials' not in client_wallet:
        raise ValueError('Missing parameters: config, name, credentials')
    try:
        with open(client_wallet['name']) as json_file:
            data = json.load(json_file)
    except FileNotFoundError:
        raise FileNotFoundError("wallet not found")
    loop = asyncio.get_event_loop()
    wallet_handle = loop.run_until_complete(create_wallet_handle(client_wallet))
    verkey = loop.run_until_complete(did.key_for_local_did(wallet_handle, data['did']))
    signature = loop.run_until_complete(crypto.crypto_sign(wallet_handle, verkey, client_challenge.encode()))
    loop.run_until_complete(wallet.close_wallet(wallet_handle))
    signature64 = base64.b64encode(signature)
    signature64 = signature64.decode('ascii')
    #loop.close()
    return signature64


def get_stored_did_verkey(client_wallet:str):
    try:
        with open(client_wallet) as json_file:
            data = json.load(json_file)
    except FileNotFoundError:
        raise FileNotFoundError("wallet not found")
    return data["did"], data["verkey"]


async def create_wallet_handle(client_wallet):
    try:
        await wallet.create_wallet(client_wallet['config'], client_wallet['credentials'])
    except IndyError as ex:
        if ex.error_code == ErrorCode.WalletAlreadyExistsError:
            pass
    wallet_handle = await wallet.open_wallet(client_wallet['config'], client_wallet['credentials'])
    return wallet_handle


def build_client_wallet(wallet_path):
    with open(wallet_path, "r") as mock_data_content:
        mock_wallet = yaml.load(mock_data_content, Loader=yaml.SafeLoader)
    client_wallet = {
        'config': json.dumps({'id': mock_wallet['id'], "storage_config": {"path": mock_wallet['path']}}),
        'credentials': json.dumps({'key': mock_wallet['key']}),
        'name': os.path.join(os.path.dirname(wallet_path), mock_wallet['name'])
    }
    return client_wallet


def create_mock_wallet(wallet_path):
    with open(wallet_path, "r") as mock_data_content:
        mock_wallet = yaml.load(mock_data_content, Loader=yaml.SafeLoader)
    create_wallet_did(build_client_wallet(wallet_path), seed=mock_wallet['seed'])
