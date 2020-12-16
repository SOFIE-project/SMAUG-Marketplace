pragma solidity ^0.5.0;

contract survey {
    
    address private contractOwner;
    
    mapping(string => uint) public surveys;
    mapping(string => uint) public surveyToCounter;
    mapping(string => uint[]) public surveyToResponses;
    
    constructor() public {
        contractOwner = msg.sender;
    }
    
    function createSurvey(string memory name, uint numberOfQuestions) public {
        require (msg.sender == contractOwner);
        
        surveys[name] = numberOfQuestions;
        surveyToCounter[name] = 0;
        
        surveyToResponses[name].length = numberOfQuestions;
        for (uint i=0; i < surveyToResponses[name].length; i++) {
            surveyToResponses[name][i] = 0;
        }
        
    }
    
    function recordResponses(string memory name, uint[] memory responses) public {
        require(surveys[name] > 0);
        require(responses.length == surveys[name]);
        
        surveyToCounter[name] = surveyToCounter[name] + 1;
         
        for (uint i=0; i < surveyToResponses[name].length; i++) {
            surveyToResponses[name][i] = surveyToResponses[name][i] + responses[i];
        }

    }
    
    function resetSurvey(string memory name) public {
        require(msg.sender == contractOwner);
        
        surveyToCounter[name] = 0;
        
        for(uint i = 0; i < surveyToResponses[name].length; i++ ) {
            surveyToResponses[name][i] = 0;
        }
        
    }

    function getResponses(string memory name) public returns (uint[] memory) {
        return surveyToResponses[name];
    } 
    
    // tests //
    function getNumberOfQuestions (string memory name) public returns (uint) {
        return surveys[name];
    }
    
    function getCounter(string memory name) public returns (uint) {
        return surveyToCounter[name];
    }
    
    function getResponsesQ(string memory name, uint question) public returns (uint) {
        return surveyToResponses[name][question];
    }
    // tests //
    
}

