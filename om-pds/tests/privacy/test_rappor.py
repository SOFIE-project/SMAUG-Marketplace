import pytest
from random import normalvariate

import sys, os
myPath = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, myPath + '/../Privacy/')
from responder import Responder
from reviewer import Reviewer

def test_rappor():
    responder = Responder()
    reviewer = Reviewer()
    num_responders = 1000
    num_choices = 20
    real_responses = [0] * num_choices
    random_responses = [0] * num_choices
    real_responses_per = [0] * num_choices
    estimated_responses_per = [0] * num_choices
    total_random = 0
    print("")
    for x in range(num_responders):
        real_value = int(round(normalvariate(10,1),0))
        real_value = min(num_choices-1, real_value)
        real_value = max(0, real_value)
        real_responses[real_value]+=1
        response = responder._generate_response(num_choices,real_value)
        for y in range(num_choices):
            random_responses[y]+= response[y]

    estimated_responses = reviewer._estimate_responses(random_responses,num_responders)
    for y in range(num_choices):
        real_responses_per[y]= round(real_responses[y]/num_responders,4)*100
        estimated_responses_per[y]= estimated_responses[y]*100
    print (["{0:0.2f}".format(i) for i in real_responses_per])
    print (["{0:0.2f}".format(i) for i in estimated_responses_per])

    assert(True)
