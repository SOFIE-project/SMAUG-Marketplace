from flask import Flask
from web3 import Web3
from web3.contract import Contract

web3_instance: Web3 = None
marketplace_sc: Contract = None
eth_chain_id: int = None

def init_app(app: Flask): 
    import json
    global web3_instance, eth_chain_id
    web3_instance = Web3(Web3.WebsocketProvider(app.config.get("ETHEREUM_MARKETPLACE_NODE_ADDRESS")))
    eth_chain_id = web3_instance.eth.chainId
    sc_address = app.config.get("ETHEREUM_MARKETPLACE_SC_ADDRESS")
    sc_abi = app.config.get("ETHEREUM_MARKETPLACE_SC_ABI_PATH")
    with open(sc_abi, "r") as f:
        sc_api_loaded = json.load(f)
    global marketplace_sc
    marketplace_sc = web3_instance.eth.contract(sc_address, abi=sc_api_loaded)