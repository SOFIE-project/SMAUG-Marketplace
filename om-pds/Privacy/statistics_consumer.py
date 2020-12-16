from web3 import Web3
import json

class Consumer:
    def __init__(self):
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

    def _estimate_responses(self, responses, total_responders):
        estimations = [0] * len(responses)
        for x in range(len(responses)):
            propability = max(0, 2*(responses[x]/total_responders - 0.25))
            estimations[x]   = propability
        return estimations

    def estimate_responses(self, number_of_choices, survey_name):
        total_responders = self.surveyContract_instance.functions.getCounter(survey_name).call()
        responses = self.surveyContract_instance.functions.getResponses(survey_name).call()
        return self._estimate_responses(responses, total_responders)








