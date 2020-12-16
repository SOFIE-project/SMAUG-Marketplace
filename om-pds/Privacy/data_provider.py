from web3 import Web3
from rappor import Rappor
import json

class Provider:
    def __init__(self):
        self.rappor = Rappor()
        with open('conf/privacy.conf') as f:
            self.conf = json.load(f)       
        try:
            w3 = Web3(Web3.HTTPProvider(self.conf['web3provider']))
            self.account = w3.eth.accounts[0]
            with open('conf/contract/build/survey.abi', 'r') as myfile:
                abi = myfile.read()    
            self.surveyContract_instance = w3.eth.contract(abi = abi, address = Web3.toChecksumAddress(self.conf['survey_sc_address']))
        except:
            print("Couldn't connect to Ethereum blockchain:" + self.conf['web3provider'])
            pass


    def _generate_response(self, number_of_choices, correct_choice):
        response = self.rappor.permanent_randomized_response(number_of_choices, correct_choice)
        return response

    def record_response(self, number_of_choices, correct_choice, survey_name):
        response = self._generate_response(number_of_choices, correct_choice)
        self.surveyContract_instance.functions.recordResponses(survey_name, response).transact({'from': self.account})





