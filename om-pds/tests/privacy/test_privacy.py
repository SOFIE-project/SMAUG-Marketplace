import pytest
from web3 import Web3

import sys, os
myPath = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, myPath + '/../../Privacy/')
from data_provider import Provider
from statistics_consumer import Consumer
from service_provider import Service_Provider


@pytest.fixture(autouse=True, scope="class")
def Ganache():
    import subprocess
    import time
    global w3, surveyContract_instance, account

    p1 = subprocess.Popen(['ganache-cli', '-m', 'myth like bonus scare over problem client lizard pioneer submit female collect']) #use this mnemonic to much the contract address in configuration
    time.sleep(10)

    w3 = Web3(Web3.HTTPProvider("HTTP://127.0.0.1:8545"))

    with open('conf/contract/build/survey.bin', 'r') as myfile:
        binfile = myfile.read()
    with open('conf/contract/build/survey.abi', 'r') as myfile:
        abi = myfile.read()
    
    account = w3.eth.accounts[0]
    surveyContract = w3.eth.contract(abi=abi, bytecode=binfile)
    tx_hash = surveyContract.constructor().transact({'from': account})
    tx_receipt = w3.eth.waitForTransactionReceipt(tx_hash)
    address = tx_receipt.contractAddress
    print("Address:", address)
    surveyContract_instance = w3.eth.contract(abi = abi, address = address)

    yield
    p1.kill()

class TestSurveyContract:

    def test_responses(self):
        global w3, surveyContract_instance, account
        survey_name = "test"
        number_of_questions = 10
        service = Service_Provider()
        service.create_survey(survey_name, number_of_questions)
        provider = Provider()
        provider.record_response(10, 5, survey_name)
        provider.record_response(10, 4, survey_name)
        provider.record_response(10, 4, survey_name)
        provider.record_response(10, 6, survey_name)
        counter = surveyContract_instance.functions.getCounter(survey_name).call()
        consumer = Consumer()
        estimated_responses = consumer.estimate_responses(10, survey_name)
        print(estimated_responses)
        assert(counter == 4 )
  
    def test_reset_survey(self):
        global w3, surveyContract_instance, account
        survey_name = "test"
        tx_hash1 = surveyContract_instance.functions.resetSurvey(survey_name).transact({'from': account})
        counter = surveyContract_instance.functions.getCounter(survey_name).call()
        assert(counter == 0)

