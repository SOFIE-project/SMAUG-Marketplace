from web3 import Web3
import pytest
import requests
import json
import base64
import datetime
import time
import jwt

@pytest.fixture(autouse=True, scope="module")
def ganache():
    import subprocess
    import time
    global w3, account, ERC721Contract_instance
    p3 = subprocess.Popen(['ganache-cli', '-m', 'myth like bonus scare over problem client lizard pioneer submit female collect']) #use this mnemonic to much the contract address in configuration
    time.sleep(10)
    w3 = Web3(Web3.HTTPProvider("HTTP://127.0.0.1:8545"))
    with open('conf/contract/build/ERC721Metadata.bin', 'r') as myfile:
        binfile = myfile.read()
    with open('conf/contract/build/ERC721Metadata.abi', 'r') as myfile:
        abi = myfile.read()
    account = w3.eth.accounts[0]
    ERC721Contract = w3.eth.contract(abi=abi, bytecode=binfile)
    tx_hash = ERC721Contract.constructor("Sofie Access Token", "SAT").transact({'from': account})
    tx_receipt = w3.eth.waitForTransactionReceipt(tx_hash)
    address = tx_receipt.contractAddress
    ERC721Contract_instance = w3.eth.contract(abi = abi, address = address)

    yield
    p3.kill()


def test_valid_auth_code_erc721():
    global w3, account, ERC721Contract_instance
    nbf = time.mktime(datetime.datetime(2020, 4, 1, 00, 00).timetuple())
    exp = time.mktime(datetime.datetime(2020, 4, 1, 23, 59).timetuple()) 
    payload = {'grant-type':'auth_code', 'grant':'shared_secret_key', 'metadata':json.dumps({'aud': 'sofie-iot.eu','nbf':nbf, 'exp': exp}), 'erc-721':'True'}
    response  = requests.post("http://localhost:9001/gettoken", data = payload)
    token = response.text
    claims = jwt.decode(token, verify=False)
    token_id = claims['jti']
    erc721_token = ERC721Contract_instance.functions.getTokenURI(token_id).call()
    assert(response.status_code == 200 and erc721_token == token) 

