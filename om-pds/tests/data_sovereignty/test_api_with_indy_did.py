from indy import did,wallet,crypto
import pytest
import requests
import json
import asyncio
import base64



@pytest.mark.asyncio
async def test_valid_did():
    user = {
        'wallet_config': json.dumps({'id': 'user_wallet',"storage_config":{"path":"tests/indy_wallets"}}),
        'wallet_credentials': json.dumps({'key': 'user_wallet_key'}),
        'did' : '4qk3Ab43ufPQVif4GAzLUW'
    }
    payload = {'grant-type':'DID', 'grant':user['did'], 'target':'smartlocker1'}
    response  = requests.post("http://localhost:9001/gettoken", data = payload)
    assert(response.status_code == 401)
    challenge = response.text
    wallet_handle = await wallet.open_wallet(user['wallet_config'], user['wallet_credentials'])
    verkey = await did.key_for_local_did(wallet_handle, user['did'])
    signature = await crypto.crypto_sign(wallet_handle, verkey, challenge.encode())
    signature64 = base64.b64encode(signature)
    payload = {'grant-type':'DID', 'grant':user['did'], 'challenge': challenge, 'proof':signature64}
    response  = requests.post("http://localhost:9001/gettoken", data = payload)
    token = response.text
    assert(response.status_code == 200)
    await wallet.close_wallet(wallet_handle)

@pytest.mark.asyncio
async def test_add_did():
    client_did    = '7FJs8MXbdTTmWx3HNyfMRN'
    client_verkey = '4QUGgBZDpnHXHa1gJ3rTNhQcCwC94DjFt5iSwgQ3dbVm'
    payload = {'action':'add','did':client_did, 'verkey': client_verkey ,'password':'thepassword', 'metadata':json.dumps({'aud':'sofie-iot.eu'})}
    response = requests.post("http://localhost:9001/", data = payload)
    assert(response.status_code == 200)

