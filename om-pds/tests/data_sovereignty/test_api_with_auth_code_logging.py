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
    global w3, abi, account, address
    p3 = subprocess.Popen(['ganache-cli', '-m', 'myth like bonus scare over problem client lizard pioneer submit female collect']) #use this mnemonic to much the contract address in configuration
    time.sleep(10) #Otherwise the server is not ready when tests start
    w3 = Web3(Web3.HTTPProvider("HTTP://127.0.0.1:8545"))
    with open('conf/contract/build/PDS.abi', 'r') as myfile:
        abi = myfile.read()
    with open('conf/contract/build/PDS.bin', 'r') as myfile:
        binfile = myfile.read()
    account = w3.eth.accounts[0]
    PDSContract = w3.eth.contract(abi=abi, bytecode=binfile)
    tx_hash = PDSContract.constructor().transact({'from': account})
    tx_receipt = w3.eth.waitForTransactionReceipt(tx_hash)
    address = tx_receipt.contractAddress
    yield
    p3.kill()


def test_valid_auth_code_with_logging():
    global w3, abi, account, address
    nbf = time.mktime(datetime.datetime(2020, 4, 1, 00, 00).timetuple())
    exp = time.mktime(datetime.datetime(2020, 4, 1, 23, 59).timetuple()) 
    payload = {'grant-type':'auth_code', 'grant':'shared_secret_key', 'metadata':json.dumps({'aud': 'sofie-iot.eu','nbf':nbf, 'exp': exp}), 'log-token':'0x68656c6c6f20776f726c640d0a'}
    response  = requests.post("http://localhost:9001/gettoken", data = payload)
    token = response.text
    PDSContract_instance = w3.eth.contract(abi=abi, address=address)
    DID, enc_token = PDSContract_instance.functions.get_token(0).call()
    assert (DID != None)
    assert (enc_token != None)

