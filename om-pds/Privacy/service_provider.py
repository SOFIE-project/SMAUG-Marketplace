from web3 import Web3
from rappor import Rappor
import json

class Service_Provider:
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


    def create_survey(self, survey_name, number_of_choices):
        self.surveyContract_instance.functions.createSurvey(survey_name, number_of_choices).transact({'from': self.account})