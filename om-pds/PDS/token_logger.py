import json
from web3 import Web3

class Token_logger:
    def __init__(self):
        with open('conf/token_logger.conf') as f:
            self.conf = json.load(f)
        try:
            self.w3 = Web3(Web3.HTTPProvider(self.conf['web3provider']))
            with open('conf/contract/build/PDS.abi', 'r') as myfile:
                abi = myfile.read()
            self.PDSContract_instance = self.w3.eth.contract(abi=abi, address=Web3.toChecksumAddress(self.conf['pds_sc_address']))
        except:
            print("Couldn't connect to Ethereum blockchain:" + self.conf['web3provider'])
            pass

    def log_token(self, metadata, token):
        account = self.w3.eth.accounts[0]
        tx_hash = self.PDSContract_instance.functions.new_token(metadata, self.w3.toBytes(text=token)).transact({'from': account})