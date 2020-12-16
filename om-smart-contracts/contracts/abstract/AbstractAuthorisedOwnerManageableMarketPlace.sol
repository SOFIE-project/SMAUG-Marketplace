pragma solidity ^0.5.0;

import { AbstractOwnerManagerMarketPlace } from "sofie-offer-marketplace/contracts/abstract/AbstractOwnerManagerMarketPlace.sol";
import { MultiManagersBaseContract } from "sofie-offer-marketplace/contracts/base/MultiManagersBaseContract.sol";

import { AuthorisedManageableMarketPlace } from "../interfaces/AuthorisedManageableMarketPlace.sol";
import { SMAUGStatusCodes } from "../SMAUGStatusCodes.sol";
import { AccessTokenLibrary } from "../libraries/AccessTokenLibrary.sol";

/**
@notice An abstract contract implementing the `AuthorisedManageableMarketPlace` and `MultiManagersBaseContract` contract from the SOFIE Marketplace component. The contract extends the functionality of request creation by requiring the presentation of a valid access token by the calling entity.
@author Antonio Antonino <antonio.antonino@ericsson.com>
@dev The contract is abstract, so it can only be instantiated via one of its subclasses. As of today, the only known subclass is `SMAUGMarketPlace.sol`.
*/
contract AbstractAuthorisedOwnerManageableMarketPlace is
AbstractOwnerManagerMarketPlace, AuthorisedManageableMarketPlace, SMAUGStatusCodes {

    // Keeps track of what access tokens have been used already (to avoid token re-usage)
    mapping(bytes32 => bool) private usedTokens;
    bytes32[] private tokenReferences;
    mapping(uint => bool) private settledOffers;

    /**
    @notice Provides initialisation instructions for all subclassing contracts. It registers the authorised management interface conformance (submitAuthorisedRequest).
    @dev Interface compliance follows the ERC165 standard.
    */
    constructor() public {
        _registerInterface(this.submitAuthorisedRequest.selector);
    }

    /**
    @notice Reset the history of used access tokens.
    @dev DANGEROUS SINCE OWNERS OF OLD ACCESS TOKENS COULD RE-USE THEM WITHOUT SUPERVISION OF THE MARKETPLACE OWNER. Only the marketplace owner or a manager can call this function.
    @return The status code of the operation.
    */
    function resetAccessTokens() public returns (uint8 status) {
        if(!(msg.sender == owner() || isManager(msg.sender))) {
            emit FunctionStatus(AccessDenied);
            return AccessDenied;
        }

        for (uint tokenReferenceIndex = 0; tokenReferenceIndex < tokenReferences.length; tokenReferenceIndex++) {
            bytes32 tokenReference = tokenReferences[tokenReferenceIndex];
            delete usedTokens[tokenReference];
        }
        delete tokenReferences;

        emit FunctionStatus(Successful);
    }

    function submitRequest(uint deadline) public returns (uint8 status, uint requestID) {
        revert("submitRequest not callable on this type of smart contracts. Please use submitAuthorisedRequest function.");
    }    

    /**
    @notice Create a new a request.
    @param tokenDigest The digest of the access token used to invoke this function.
    @param signature The signature over the token digest.
    @param nonce A nonce used to generate the token digest
    @param deadline The deadline after which the request will not be accepting new offers anymore.
    @dev
    The following requirements are to be met for a successful operation:
        - the token used must be valid. Specifically, it must fulfill the following requirements:
            * The account calling this function must match the token subject.
            * The smart contract account must match the token audience.
            * The function selector of the token must match the ABI of this function.
            * The nonce of the token must not have been previously used.
            * The access token must have been signed by a marketplace manager.
    This operation will create a request which is pending (not open), meaning that to be considered by potential offer creators the request creator must also submit the extra information by calling `submitRequestArrayExtra`.
    @return The tuple (status, requestID) where status is the status code of the transaction, and requestID is the request ID created by the smart contract.
    */
    function submitAuthorisedRequest
        (bytes32 tokenDigest, bytes memory signature, bytes32 nonce, uint deadline)
        public returns (uint8 status, uint requestID) {

            bool isTokenValid = isValidAccessTokenForFunctionAndNonce(
                tokenDigest, signature, nonce, this.submitAuthorisedRequest.selector, msg.sender, address(this)
            );

            if (!isTokenValid) {
                emit FunctionStatus(AccessDenied);
                return (AccessDenied, 0);
            }

            if (isTokenUsed(tokenDigest)) {
                emit FunctionStatus(TokenAlreadyUsed);
                return (TokenAlreadyUsed, 0);
            }
            consumeToken(tokenDigest);

            Request storage request = requests[reqNum];

            request.deadline = deadline;
            request.ID = reqNum;
            reqNum += 1;
            request.isDefined = true;
            request.reqStage = Stage.Pending;
            request.isDecided = false;
            request.requestMaker = msg.sender;

            emit FunctionStatus(Successful);
            emit RequestAdded(request.ID, request.deadline);
            return (Successful, request.ID);
    }

    function isValidAccessTokenForFunctionAndNonce
        (bytes32 digest, bytes memory signature, bytes32 nonce, bytes4 functionSelector, address subjectAddress, address audienceAddress)
        private view returns (bool isValidToken) {
            (bool isValid, address signer) =
            AccessTokenLibrary.validateAndReturnTokenSigner(digest, signature, nonce, functionSelector, subjectAddress, audienceAddress);

            return isValid && isManager(signer);
    }

    function isTokenUsed(bytes32 tokenDigest) private view returns (bool) {
        return usedTokens[tokenDigest];
    }

    function consumeToken(bytes32 token) private {
        tokenReferences.push(token);
        usedTokens[token] = true;
    }

    /*
    When offer marketplace will be updated, the AbstractManageableMarketplace contract will check that a request exists before doing any operation.
    Functionality missing in the original SOFIE AbstractManageableMarketPlace smart contract. Issue reported on 01/04/2020 at 13:20.
    */
    function closeRequest(uint requestIdentifier) public returns (uint8 status) {
        (, bool isRequestDefined) = isRequestDefined(requestIdentifier);

        if (!isRequestDefined) {
            emit FunctionStatus(UndefinedID);
            return UndefinedID;
        }

        Request storage request = requests[requestIdentifier];

        bool isCallerRequestCreator = isRequestCreator(request, msg.sender);
        if (!isCallerRequestCreator) {
            emit FunctionStatus(AccessDenied);
            return (AccessDenied);
        }
        
        // This control is missing in the SOFIE smart contract
        if(request.reqStage != Stage.Open) {
            emit FunctionStatus(RequestNotOpen);
            return RequestNotOpen;
        }

        return closeRequestInsecure(requestIdentifier);
    }

    function isRequestCreator(Request storage request, address _address) internal view returns (bool) {
        return request.requestMaker == _address;
    }

    function deleteRequest(uint requestIdentifier) public returns (uint8 status) {
        (, bool isRequestDefined) = isRequestDefined(requestIdentifier);
        if (!isRequestDefined) {
            emit FunctionStatus(UndefinedID);
            return (UndefinedID);
        }

        Request storage request = requests[requestIdentifier];

        bool isCallerRequestCreator = isRequestCreator(request, msg.sender);
        if (!isCallerRequestCreator) {
            emit FunctionStatus(AccessDenied);
            return (AccessDenied);
        }

        if(request.reqStage != Stage.Closed) {
            emit FunctionStatus(ReqNotClosed);
            return ReqNotClosed;
        }

        if(request.closingBlock + waitBeforeDeleteBlocks > block.number) {
            emit FunctionStatus(NotTimeForDeletion);
            return NotTimeForDeletion;
        }

        return deleteRequestInsecure(requestIdentifier);
    }

    // Override from AbstractMarketplace, since it does not provide restriction over who can call this function.
    function settleTrade(uint requestID, uint offerID) public returns (uint8 status) {
        (, bool isRequestDefined) = isRequestDefined(requestID);
        if (!isRequestDefined) {
            emit FunctionStatus(UndefinedID);
            return UndefinedID;
        }

        (, bool isOfferDefined) = isOfferDefined(offerID);
        if (!isOfferDefined) {
            emit FunctionStatus(UndefinedID);
            return UndefinedID;
        }

        if (offers[offerID].offerMaker != msg.sender) {
            emit FunctionStatus(AccessDenied);
            return AccessDenied;
        }

        if (settledOffers[offerID]) {
            emit FunctionStatus(AlreadySettledOffer);
            return AlreadySettledOffer;
        }

        settleTradeInsecure(requestID, offerID);
    }

    function settleTradeInsecure(uint requestID, uint offerID) internal returns (uint8 /*status*/) {
        settledOffers[offerID] = true;
        super.settleTradeInsecure(requestID, offerID);
    }
}