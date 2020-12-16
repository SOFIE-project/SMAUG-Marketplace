pragma solidity ^0.5.0;

import { InterledgerReceiverInterface } from "sofie-interledger-contracts/contracts/InterledgerReceiverInterface.sol";
import { InterledgerSenderInterface } from "sofie-interledger-contracts/contracts/InterledgerSenderInterface.sol";
import { ArrayRequestExtraData, ArrayOfferExtraData } from "sofie-offer-marketplace/contracts/interfaces/ArrayExtraData.sol";

import { AbstractAuthorisedOwnerManageableMarketPlace } from "./abstract/AbstractAuthorisedOwnerManageableMarketPlace.sol";
import { UtilsLibrary } from "./libraries/UtilsLibrary.sol";

/**
@title The official SMAUG marketplace smart contract.
@author Antonio Antonino <antonio.antonino@ericsson.com>
@notice The smart contract implements an offer-based marketplace that allows both auction-based and instant-rent transactions between smart locker owner and smart locker renter.
*/
contract SMAUGMarketPlace is AbstractAuthorisedOwnerManageableMarketPlace, ArrayRequestExtraData, ArrayOfferExtraData, InterledgerSenderInterface, InterledgerReceiverInterface {

    event OfferClaimable(uint indexed offerID);
    event OfferFulfilled(uint indexed offerID, bytes token);
    event RequestClaimable(uint indexed requestID, uint[] offerIDs);
    event PaymentCashedOut(uint indexed requestID, uint indexed offerID, uint amount);

    enum InterledgerEventType {
        RequestDecision
    }

    /*
    A request extra contains some easy-to-understand information plus an array fo pricing rules for instant rents.
    An array of pricing rule has, for example, the following format:
        [1, 50, 5, 40, 10, 30, 50, 20, 100, 10]
    The pricing rules array specified above indicates that, for any instant rent request during a number of minutes between
    1 (element n. 0) and 5 not included (element n. 2), the price to buy to automatically reserve the locker is 50 for each minute (element n. 1).
    Similarly, for a rent request for a number of minutes between 5 (element n. 2) and 10 not included (element n. 4), the price for each minute to
    buy has to be 40. For rents during from 10 to 50 (not included), the price is 30, while for the range [50-99] is 20,
    and for rents lasting at least 100 minutes, the price/minute to pay has to be at least 10.
    */
    struct RequestExtra {
        uint startOfRentTime;               // The starting time from which the locker specified in the request will be available.
        uint duration;                      // The n. of minutes from startOfRentTime for which the locker can be rented.
        uint auctionMinPricePerSlot;        // The starting price for auctions (not instant rent options).
        InstantRentPricingRule[] rules;     // If empty, the request does not accept instant rent offers.
        uint lockerKey;                     // The public key identifying the locker and that will be used to authenticate it, encoded as uint.
    }

    // Each instance of the struct will be one pricing rule in the rules array in the RequestExtra struct above.
    struct InstantRentPricingRule {
        uint minimumNumberOfMinutes;
        uint minimumPricePerMinute;
    }

    struct OfferExtra {
        uint startOfRentTime;                   // The proposed start time for the rent in this offer. Must be >= requestExtra.startOfRentTime.
        uint duration;                          // The n. of minutes from startOfRentTime the rent would last. startOfRentTime + duration <= requestExtra.startOfRentTime + requestExtra.duration.
        OfferType offerType;                    // Specifies whether the money offered is for an auction or an instant buy offer.
        uint priceOffered;                      // The amount of Wei that the offer contained.
        uint offerCreatorEncryptionKey;         // The key to decrypt the issued access token, in case the offer is selected.
        uint offerCreatorAuthenticationKey;     // OPTIONAL. The key used by the receiver of the access token to authenticate him/her self to the smart locker. If no key is provided in the offer, the generated token will be a bearer token.
    }

    struct PaymentDetails {
        bool created;                           // Indicates whether the struct is valid (exists in the mapping which is part of).
        bool resolved;                          // Indicates whether the payment is pending (resolved == false) or not. If not, the money can be claimed back.
        bool toReturn;                          // Indicates whether the money locked in the payment is to return to the offer creator (toReturn == true) or to move to the request creator, if the offer is a winning one.
        uint amount;                            // The amount of Wei associated with the payment.
    }

    // Representes a single element in the Interledger payload that the marketplace receive. It contains the information about what offer has been "fulfilled", and what is the associated (encrypted) access token.
    struct InterledgerPayloadElement {
        uint offerID;
        bytes encryptedToken;
    }

    enum OfferType { Auction, InstantRent }

    // Minimum length of extra elements for a request extra submission.
    uint constant private minimumNumberOfRequestExtraElements = 4;               // requestExtra.rules is optional (empty array)

    // Minimum and maximum length of extra elements for an offer extra submission.
    uint constant private minimumNumberOfOfferExtraElements = 4;                 // offerExtra.offerCreatorAuthenticationKey is optional
    uint constant private maximumNumberOfOfferExtraElements = 5;

    mapping (uint => RequestExtra) private requestsExtra;
    mapping (uint => OfferExtra) private offersExtra;

    // requestID -> [offerID]. Keeps track of the requests that have been decided but not fulfilled (no token issued)
    mapping(uint => uint[]) private openOffersPerRequest;

    // offerID -> details. Keeps track of the money that has been moved upon each offer submission.
    // This is the main variable keeping track of where and how much money should go where upon request decision.
    mapping (uint => PaymentDetails) private pendingPayments;

    /**
    @notice Creates a new SMAUGMarketPlace instance and registers the submitRequestArrayExtra and submitOfferArrayExtra interface compliance.
    @dev Interface compliance follows the ERC165 standard.
    */
    constructor() public {
        _registerInterface(this.submitRequestArrayExtra.selector);
        _registerInterface(this.submitOfferArrayExtra.selector);
    }
    
    /**
    @notice Submit extra information for a previously-created request.
    @param requestID The ID of the request.
    @param extra The extra information to submit for the request. Specifically:
        - extra[0] = startOfRentTime
        - extra[1] = duration
        - extra[2] = auctionMinPricePerSlot
        - extra[3...2n, n >= 2] = rules. Must be in even number. Each element at index 3 + 2m (m >= 0) must be smaller than element at index 3 + 2m + 2.
        - extra[2n + 1] = lockerKey.
    @dev The following requirements are to be met for a successful operation:
        - the length of the extra array must be the minimum required (4).
        - the request must exist and must be pending (i.e., missing the extra information being submitted with this function).
        - the submitter of the request extra must be the same that previously created the request.
        - the extra array must comply with the requirements expressed in @param extra and in the variable declaration.
    @return The tuple (status, reqID) where status is the status code of the transaction, and reqID is the request ID given in input.
    */
    function submitRequestArrayExtra(uint requestID, uint[] calldata extra) external returns (uint8 status, uint reqID) {

        if (extra.length < minimumNumberOfRequestExtraElements) {
            emit FunctionStatus(InvalidInput);
            return (InvalidInput, 0);
        }

        (, bool isRequestDefined) = isRequestDefined(requestID);

        if (!isRequestDefined) {
            emit FunctionStatus(UndefinedID);
            return (UndefinedID, 0);
        }

        Request storage request = requests[requestID];

        if(request.reqStage != Stage.Pending) {
            emit FunctionStatus(NotPending);
            return (NotPending, 0);
        }

        bool isCallerRequestCreator = isRequestCreator(request, msg.sender);

        if (!isCallerRequestCreator) {
            emit FunctionStatus(AccessDenied);
            return (AccessDenied, 0);
        }

        (uint8 requestExtraValidationStatusCode, InstantRentPricingRule[] memory requestPricingRules) =
            validateAndBuildRequestPricingRulesFromRawArray(extra, 3, extra.length-2);

        if (requestExtraValidationStatusCode != Successful) {
            emit FunctionStatus(requestExtraValidationStatusCode);
            return (requestExtraValidationStatusCode, 0);
        }

        RequestExtra storage requestExtra = requestsExtra[requestID];
        requestExtra.startOfRentTime = extra[0];
        requestExtra.duration = extra[1];
        requestExtra.auctionMinPricePerSlot = extra[2];
        requestExtra.lockerKey = extra[extra.length-1];

        for (uint i = 0; i < requestPricingRules.length; i++) {
            requestExtra.rules.push(requestPricingRules[i]);
        }

        return super.finishSubmitRequestExtra(requestID);
    }

    function validateAndBuildRequestPricingRulesFromRawArray(uint[] memory requestExtra, uint startIndex, uint endIndex)
        internal pure returns (uint8 statusCode, InstantRentPricingRule[] memory rules) {

        if (startIndex == endIndex+1) {   // Condition met if the array of pricing rules is empty (3 == extra.length-2+1).
            return (Successful, rules);
        }

        bool isEvenNumberOfRules = (endIndex-startIndex) % 2 == 1;

        if (!isEvenNumberOfRules) {       //Number of elements in requestExtra[startIndex...endIndex] must be even
            return (InvalidInput, rules);
        }

        uint numberOfRules = (endIndex - startIndex) / 2 + 1;
        InstantRentPricingRule[] memory _rules = new InstantRentPricingRule[](numberOfRules);
        uint requestDuration = requestExtra[1];

        for (uint i = startIndex; i < endIndex; i += 2) {
            uint newRangeMinimumMinutesAmount = requestExtra[i];
            uint newRangePricePerMinute = requestExtra[i+1];

            // Pricing rule cannot be specified for durations longer than the request itself
            if (newRangeMinimumMinutesAmount > requestDuration) {
                return (InvalidInput, rules);
            }

            if (i > startIndex) {           // If it is not the first iteration
                InstantRentPricingRule memory previousRangePricingRule = _rules[(i-1-startIndex)/2];
                if (previousRangePricingRule.minimumNumberOfMinutes >= newRangeMinimumMinutesAmount) {      // Ranges values for number of minutes must be strictly monotonically increasing.
                    return (InvalidInput, rules);
                }
            }
            InstantRentPricingRule memory currentRangePricingRule = InstantRentPricingRule(newRangeMinimumMinutesAmount, newRangePricePerMinute);
            _rules[(i-startIndex)/2] = currentRangePricingRule;
        }

        return (Successful, _rules);
    }

    /**
    @notice Returns the extra information associated with a request.
    @param requestIdentifier The ID of the request.
    @return The status code of the operation and the detais (startOfRentTime, duration, auctionMinPricePerSlot, instantBuyRules, lockerID) associated with the given request identifier.
    */
    function getRequestExtra(uint requestIdentifier) public view
        returns (uint8 status, uint startOfRentTime, uint duration, uint auctionMinPricePerSlot, uint[] memory instantBuyRules, uint lockerID) {
            (, bool isRequestDefined) = isRequestDefined(requestIdentifier);

            if (!isRequestDefined) {
                return (UndefinedID, 0, 0, 0, new uint[](0), 0);
            }

            RequestExtra storage requestExtra = requestsExtra[requestIdentifier];

            return (
                Successful,
                requestExtra.startOfRentTime,
                requestExtra.duration,
                requestExtra.auctionMinPricePerSlot,
                buildRawArrayFromRequestPricingRules(requestExtra.rules),
                requestExtra.lockerKey
            );
    }

    function buildRawArrayFromRequestPricingRules(InstantRentPricingRule[] storage requestRules) internal view returns (uint[] memory rules) {
        uint[] memory _rules = new uint[](requestRules.length*2);

        for (uint i = 0; i < requestRules.length; i += 1) {
            _rules[i*2] = requestRules[i].minimumNumberOfMinutes;
            _rules[(i*2)+1] = requestRules[i].minimumPricePerMinute;
        }

        return _rules;
    }

    /**
    @notice Decide a request, by selecting a subset of the offers for that request as winning.
    @param requestIdentifier The ID of the request.
    @param acceptedOfferIDs The IDs of the selected offers for the given request.
    @dev
    The following requirements are to be met for a successful operation:
        - the request must exist and must be in the correct state (e.g., not already decided in a previous operation).
        - the caller of the decision operation must be the same that previously created the request.
        - each offer in the list of offer IDs must refer to the same request being decided and must be complete (i.e., it includes the extra information).
    The decision of a request triggers an Interledger event where the payload is a list, and each element in the list has the following format:
        x + offerID + offerCreatorEncryptionKey [+ offerCreatorAuthenticationKey]
            - byte x = 1 if offerCreatorAuthenticationKey is not null, 0 otherwise
            - bytes offerID = the value of the offer ID, ABI-encoded as bytes
            - bytes offerCreatorEncryptionKey = the value of the offer creator encryption key (max 32 bytes), ABI-encoded as bytes
            - bytes offerCreatorAuthenticationKey = the value of the offer creator authentication key (OPTIONAL, max 32 bytes), ABI-encoded as bytes
    offerCreatorEncryptionKey and offerCreatorAuthenticationKey are max 32 bytes because given as array extra parameters in `submitRequestArrayExtra` which allows for uint256 values. Might be worth creating another way of passing data via bytes. So, each entry in the list is long either 33 or 65 bytes, depending on the value of the first byte (33 (1 + 32) if first byte is 0, 65 (1 + 32 + 32) if 1).
    @return The status code of the transaction.
    */
    function decideRequest(uint requestIdentifier, uint[] memory acceptedOfferIDs) public returns (uint8 status) {
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

        bool integrity = checkIntegrityOfAcceptedOffersList(requestIdentifier, acceptedOfferIDs);

        if(!integrity) {
            emit FunctionStatus(ImproperList);
            return ImproperList;
        }

        return decideRequestInsecure(requestIdentifier, acceptedOfferIDs);
    }

    function decideRequestInsecure(uint requestIdentifier, uint[] memory acceptedOfferIDs) internal returns (uint8) {
        uint8 status = super.decideRequestInsecure(requestIdentifier, acceptedOfferIDs);
        // Generate interledger event
        emitRequestDecisionInterledgerEvent(acceptedOfferIDs);
        return status;
    }

    function checkIntegrityOfAcceptedOffersList(uint requestIdentifier, uint[] memory acceptedOfferIDs) private view returns (bool isOffersListValid) {
        for (uint j = 0; j < acceptedOfferIDs.length; j++) {
            if (offers[acceptedOfferIDs[j]].requestID != requestIdentifier) {
                return false;
            }

            if (offers[acceptedOfferIDs[j]].offStage != Stage.Open) {
                return false;
            }

            for (uint i = 0; i < j; i++) {
                if (acceptedOfferIDs[j] == acceptedOfferIDs[i]) {
                    return false;
                }
            }
        }

        return true;
    }

    /**
    @notice Submit an offer for an open request.
    @param requestID The ID of the request.
    @dev
    The following requirements are to be met for a successful operation:
        - the request must exist and must be in the open state.
        - the deadline for offer submissions has not passed for the request.
        - the submitter of the request extra must be the same that previously created the request.
    This operation will create an offer which is pending (not open), meaning that to be considered the offer creator must also submit the extra information by calling `submitOfferArrayExtra`.
    @return The tuple (status, offerID) where status is the status code of the transaction, and offerID is the offer ID created by the smart contract.
    */
    function submitOffer(uint requestID) public returns (uint8 status, uint offerID) {
        (, bool isRequestDefined) = isRequestDefined(requestID);

        if (!isRequestDefined) {
            emit FunctionStatus(UndefinedID);
            return (UndefinedID, 0);
        }

        Request storage request = requests[requestID];

        if(now > request.deadline) {
            emit FunctionStatus(DeadlinePassed);
            return (DeadlinePassed, 0);
        }

        if(request.reqStage != Stage.Open) {
            emit FunctionStatus(RequestNotOpen);
            return (RequestNotOpen, 0);
        }

        return super.submitOffer(requestID);
    }

    /**
    @notice Submit extra information for a previously-submitted offer.
    @param offerID The ID of the offer.
    @param extra The extra information to submit for the offer. Specifically:
        - extra[0] = startOfRentTime
        - extra[1] = duration
        - extra[2] = offerType
        - extra[3] = offerCreatorEncryptionKey
        - extra[4] = offerCreatorAuthenticationKey (OPTIONAL)
    @dev
    The following requirements are to be met for a successful operation:
        - the length of the extra array must be in the expected range ([4, 5]).
        - the offer must exist and must be pending (i.e., missing the extra information being submitted with this function).
        - the submitter of the offer extra must be the same that previously created the offer.
        - the request for which the offer is submitted must be open, i.e., accepting offers.
        - the offer must respect the type of request, i.e., if a request only accepts auction offers, the offer cannot be an instant rent offer.
        - the total amount paid in the offer must respect the minimum value requirements specified in the request extra (either auctionMinPricePerSlot * duration for auctions, or the correct rule for the total duration indicated in the offer).
        - the extra array must comply with the requirements expressed in @param extra and in the variable declaration.
    If the transaction fails, it reverts (no state is changed, Weis, minus the gas fees, returned to the offer creator).
    @return The tuple (status, offID) where status is the status code of the transaction, and offID is the offer ID given in input.
    */
    function submitOfferArrayExtra(uint offerID, uint[] calldata extra) external payable returns (uint8 status, uint offID) {
        require(
            extra.length >= minimumNumberOfOfferExtraElements && extra.length <= maximumNumberOfOfferExtraElements,
            UtilsLibrary.stringifyStatusCode(InvalidInput)
        );

        Offer storage offer = offers[offerID];

        require(
            offer.isDefined,
            UtilsLibrary.stringifyStatusCode(UndefinedID)
        );

        require(
            offer.offStage == Stage.Pending,
            UtilsLibrary.stringifyStatusCode(NotPending)
        );

        require(
            offer.offerMaker == msg.sender,
            UtilsLibrary.stringifyStatusCode(AccessDenied)
        );

        Request storage request = requests[offer.requestID];

        require(
            request.reqStage == Stage.Open,
            UtilsLibrary.stringifyStatusCode(RequestNotOpen)
        );

        RequestExtra storage requestExtra = requestsExtra[request.ID];
        OfferExtra memory offerExtra = buildOfferExtraFromRawArray(extra);

        validateOfferExtraAndPaymentAgainstRequestExtra(requestExtra, offerExtra, msg.value);
        updateOfferAndRegisterPendingPayment(offerExtra, offerID, msg.value);

        offersExtra[offerID] = offerExtra;
        offer.offStage = Stage.Open;

        (uint8 _offerSubmissionStatus,) = super.finishSubmitOfferExtra(offerID);

        require(
            _offerSubmissionStatus == Successful,
            UtilsLibrary.stringifyStatusCode(_offerSubmissionStatus)
        );

        // If the instant rent offer is valid, decide the request with that offer as winning one.
        if (offerExtra.offerType == OfferType.InstantRent) {
            uint[] memory decidedOffers = new uint[](1);
            decidedOffers[0] = offerID;
            uint8 _requestDecisionStatus = decideRequestInsecure(request.ID, decidedOffers);

            require(
                _requestDecisionStatus == Successful,
                UtilsLibrary.stringifyStatusCode(_requestDecisionStatus)
            );
        }
        openOffersPerRequest[request.ID].push(offerID);
        return (Successful, offerID);
    }

    function buildOfferExtraFromRawArray(uint[] memory extra) private pure returns (OfferExtra memory offerExtra) {
        OfferExtra memory _offerExtra;
        _offerExtra.startOfRentTime = extra[0];
        _offerExtra.duration = extra[1];
        _offerExtra.offerType = OfferType(extra[2]);
        _offerExtra.offerCreatorEncryptionKey = extra[3];
        if (extra.length == 5) {
            _offerExtra.offerCreatorAuthenticationKey = extra[4];
        }

        return _offerExtra;
    }

    function validateOfferExtraAndPaymentAgainstRequestExtra(RequestExtra storage requestExtra, OfferExtra memory offerExtra, uint paymentAmount)
    private view {

            // The offer must start later than the request
            require(
                offerExtra.startOfRentTime >= requestExtra.startOfRentTime,
                UtilsLibrary.stringifyStatusCode(OfferExtraInvalid)
            );

            // The offer must finish earlier than the request
            require(
                offerExtra.startOfRentTime + offerExtra.duration*60 <= requestExtra.startOfRentTime + requestExtra.duration*60,
                UtilsLibrary.stringifyStatusCode(OfferExtraInvalid)
            );

            if (offerExtra.offerType == OfferType.Auction) {    // If it is an auction bid, the minimum price condition must be satisfied
                require(
                    requestExtra.auctionMinPricePerSlot * offerExtra.duration <= paymentAmount,
                    UtilsLibrary.stringifyStatusCode(InsufficientEscrowPayment)
                );
            } else {    // If instant rent, it must match the pricing rules
                InstantRentPricingRule[] storage requestRules = requestExtra.rules;
                require(
                    requestRules.length > 0,                        // Instant rent not supported
                    UtilsLibrary.stringifyStatusCode(InstantRentNotSupported)
                );

                uint minimumPriceToPay = getExpectedInstantRentPriceForOfferDuration(requestRules, offerExtra.duration);
                require(
                    minimumPriceToPay <= paymentAmount,
                    UtilsLibrary.stringifyStatusCode(InsufficientEscrowPayment)
                );
            }
    }

    function updateOfferAndRegisterPendingPayment
    (OfferExtra memory offerExtra, uint offerID, uint paymentAmount) internal {
        offerExtra.priceOffered = paymentAmount;

        // By default toReturn = true. Set to false if an access token is issued.
        pendingPayments[offerID] = PaymentDetails(true, false, true, paymentAmount);
    }

    function emitRequestDecisionInterledgerEvent(uint[] memory acceptedOfferIDs) internal {
        bytes memory payload = new bytes(0);

        for (uint i = 0; i < acceptedOfferIDs.length; i++) {
            uint acceptedOfferID = acceptedOfferIDs[i];
            OfferExtra storage offerExtra = offersExtra[acceptedOfferID];
            bytes memory interledgerEventPayload = getInterledgerPayloadFromOfferExtra(acceptedOfferID, offerExtra);
            payload = abi.encodePacked(payload, interledgerEventPayload);
        }
        emit InterledgerEventSending(uint256(InterledgerEventType.RequestDecision), payload);
    }

    /*
    Returns the concatenation of all the offer IDs winner offerCreatorEncryptionKey, and winner authKey, if present.
    Each element in the list has the following format:
        x + offerID + offerCreatorEncryptionKey [+ offerCreatorAuthenticationKey]
            - byte x = 1 if offerCreatorAuthenticationKey is not null, 0 otherwise
            - bytes offerID = the value of the offer ID, ABI-encoded as bytes
            - bytes offerCreatorEncryptionKey = the value of the offer creator encryption key (max 32 bytes), ABI-encoded as bytes
            - bytes offerCreatorAuthenticationKey = the value of the offer creator authentication key (OPTIONAL, max 32 bytes), ABI-encoded as bytes
    offerCreatorEncryptionKey and offerCreatorAuthenticationKey are max 32 bytes because given as array extra parameters in `submitRequestArrayExtra` which allows for uint256 values. Might be worth creating another way of passing data via bytes. So, each entry in the list is long either 33 or 65 bytes, depending on the value of the first byte (33 (1 + 32) if first byte is 0, 65 (1 + 32 + 32) if 1).
    */
    function getInterledgerPayloadFromOfferExtra(uint offerID, OfferExtra storage offerExtra) private view returns (bytes memory) {
        uint offerDID = offerExtra.offerCreatorEncryptionKey;
        uint offerCreatorAuthenticationKey = offerExtra.offerCreatorAuthenticationKey;
        byte authKeyPresenceByte = byte(offerCreatorAuthenticationKey == 0 ? 0 : 1);
        bytes memory offerIDBytes = UtilsLibrary.toBytes(offerID);
        bytes memory offerDIDBytes = UtilsLibrary.toBytes(offerDID);
        bytes memory result = abi.encodePacked(authKeyPresenceByte, offerIDBytes, offerDIDBytes);
        if (offerCreatorAuthenticationKey != 0) {
            bytes memory offerCreatorAuthenticationKeyBytes = UtilsLibrary.toBytes(offerCreatorAuthenticationKey);
            result = abi.encodePacked(result, offerCreatorAuthenticationKeyBytes);
        }
        return result;
    }

    function getExpectedInstantRentPriceForOfferDuration(InstantRentPricingRule[] storage rules, uint offerDuration)
        private view returns (uint minimumPriceToPay) {
            for (uint i = 0; i < rules.length; i++) {
                if (rules[i].minimumNumberOfMinutes >= offerDuration) {
                    return rules[i].minimumPricePerMinute * offerDuration;
                }
            }

            //If offer duration is greater than anything specified in request rules, return the last value
            return rules[rules.length-1].minimumPricePerMinute * offerDuration;
    }

    /**
    @notice Returns the extra information for an offer.
    @param offerIdentifier The ID of the offer.
    @return The status code of the operation and the details (startOfRentTime, duration, offerType, priceOffered, offerCreatorEncryptionKey, offerCreatorAuthenticationKey) associated with the given request identifier.
    */
    function getOfferExtra(uint offerIdentifier)
    public view returns (uint8 status, uint startOfRentTime, uint duration, OfferType offerType, uint priceOffered, uint offerCreatorEncryptionKey, uint offerCreatorAuthenticationKey) {
        Offer storage offer = offers[offerIdentifier];

        if(!offer.isDefined) {
            return (UndefinedID, 0, 0, offerType, 0, 0, 0);
        }

        OfferExtra storage offerExtra = offersExtra[offerIdentifier];

        return (
            Successful,
            offerExtra.startOfRentTime,
            offerExtra.duration,
            offerExtra.offerType,
            offerExtra.priceOffered,
            offerExtra.offerCreatorEncryptionKey,
            offerExtra.offerCreatorAuthenticationKey
        );
    }

    /**
    @notice Returns the type (the unique identifier) of the marketplace.
    @return The type (the unique identifier) of the marketplace.
    */
    function getType() external view returns (uint8 status, string memory) {
        return (Successful, "eu.sofie-iot.smaug-marketplace");
    }

    // Interledger sender interface support

    function interledgerCommit(uint256 id) public {}

    function interledgerAbort(uint256 id, uint256 reason) public {}

    function interledgerCommit(uint256 id, bytes memory data) public {}    

    // Interledger receiver interface support

    /*
    Called by IL when an access token has been issued on the authorisation blockchain. Data will contain the offer IDs for which a token has been released and the relative encrypted token.
    Payload will be a list of elements, where each element has the following structure:
        - ML: length of the metadata field in bytes (32 bytes)
        - M: metadata (ML bytes)
        - TL: length of the encrypted token in bytes (32 bytes)
        - T: encrypted token (TL bytes)
    TODO: 32 bytes for lengths is wasted space, probably 2 bytes would be enough.
    TODO: Do something with the received access token as well (not used for now).
    */
    function interledgerReceive(uint256 nonce, bytes memory data) public {

        // Only IL under a manager's account can call this function
        if(!(msg.sender == owner() || isManager(msg.sender))) {
            emit FunctionStatus(AccessDenied);
            emit InterledgerEventRejected(nonce);
            return;
        }

        // Empty payloads are not accepted
        if (data.length == 0) {
            emit FunctionStatus(EmptyInterledgerPayload);
            emit InterledgerEventRejected(nonce);
            return;
        }

        /*
        TODO: Validate the payload for each single request being built (i.e., data not in the expected form). 1/3
        In case the payload has an incorrect structure, decodeInterledgerPayload will probably revert. 2/3
        We want to avoid that and instead just discard the interledger event. 3/3
        */
        InterledgerPayloadElement[] memory offersFulfilled = decodeInterledgerPayload(data);
        bool isOffersArrayValid = validateOffersInInterledgerPayload(offersFulfilled);

        if (!isOffersArrayValid) {
            emit FunctionStatus(ImproperList);
            emit InterledgerEventRejected(nonce);
            return;
        }

        Offer storage referenceOffer = offers[offersFulfilled[0].offerID];
        Request storage referenceRequest = requests[referenceOffer.requestID];  // All offers will refer to the same request

        uint requestID = referenceRequest.ID;
        (, bool isRequestDecided) = isRequestDecided(requestID);

        // Request must be decided
        if (!isRequestDecided) {
            emit FunctionStatus(ReqNotDecided);
            emit InterledgerEventRejected(nonce);
            return;
        }

        emit InterledgerEventAccepted(nonce);
        // Set that money can be claimed by the request creator or offer creator
        resolveRequest(referenceRequest, offersFulfilled);
    }

    function decodeInterledgerPayload(bytes memory payload) private pure returns (InterledgerPayloadElement[] memory) {
        uint index = 0;
        uint resultLength = 0;

        // Calculates how long the resulting array will be (no dynamic arrays allowed in-memory)
        while (index < payload.length) {
            uint metadataLength = abi.decode(UtilsLibrary.slice(payload, index, 32), (uint256));
            index += 32 + metadataLength;
            uint tokenLength = abi.decode(UtilsLibrary.slice(payload, index, 32), (uint256));
            index += 32 + tokenLength;
            resultLength += 1;
        }

        InterledgerPayloadElement[] memory result = new InterledgerPayloadElement[](resultLength);

        // Re-execute the same looping operation, and populate the result array
        index = 0;
        uint resultIndex = 0;
        while (index < payload.length) {
            uint metadataLength = abi.decode(UtilsLibrary.slice(payload, index, 32), (uint256));
            index += 32;
            uint offerID = abi.decode(UtilsLibrary.slice(payload, index, metadataLength), (uint256));
            index += metadataLength;
            uint tokenLength = abi.decode(UtilsLibrary.slice(payload, index, 32), (uint256));
            index += 32;
            bytes memory token = UtilsLibrary.slice(payload, index, tokenLength);
            index += tokenLength;
            result[resultIndex] = InterledgerPayloadElement(offerID, token);
            resultIndex += 1;
        }

        return result;
    }

    function validateOffersInInterledgerPayload(InterledgerPayloadElement[] memory offersFulfilled) private view returns (bool) {
        // All offers must be defined and refer to the same request
        for (uint i = 0; i < offersFulfilled.length; i++) {
            (, bool isOfferDefined) = isOfferDefined(offersFulfilled[i].offerID);
            if (!isOfferDefined) {
                return false;
            }
            if (i > 0) {
                if (offers[offersFulfilled[i-1].offerID].requestID != offers[offersFulfilled[i].offerID].requestID) {
                    return false;
                }
            }
        }
        return true;
    }

    /*
    Notifies the losing offer creators and the request creator that the money can be claimed.
    Generates the following events:
        - one OfferFulfilled(offerID, token) event for each offer that has been fulfilled.
        - one OfferClaimable(offerID) event for each offer that has not been selected as winning.
        - one RequestClaimable(requestID, offerIDs) at the end.
    */
    function resolveRequest(Request storage request, InterledgerPayloadElement[] memory offersFulfilled) private {
        uint[] storage openOffers = openOffersPerRequest[request.ID];
        uint[] memory fulfilledOfferIDs = new uint[](offersFulfilled.length);
        for (uint openOfferIndex = 0; openOfferIndex < openOffers.length; openOfferIndex++) {
            uint openOfferID = openOffers[openOfferIndex];
            pendingPayments[openOfferID].resolved = true;
            for (uint offerFulfilledIndex = 0; offerFulfilledIndex < offersFulfilled.length; offerFulfilledIndex++) {
                uint offerFulfilledID = offersFulfilled[offerFulfilledIndex].offerID;
                if (openOfferID == offerFulfilledID) {     // The offer is a winning one
                    pendingPayments[openOfferID].toReturn = false;
                    fulfilledOfferIDs[offerFulfilledIndex] = offerFulfilledID;
                    // Notify that the offer money can be claimed back
                    emit OfferFulfilled(openOfferID, offersFulfilled[offerFulfilledIndex].encryptedToken);
                    break;
                }
            }
            // If the open offer is not among the winning ones, notify the offer creator
            if (pendingPayments[openOfferID].toReturn) {
                emit OfferClaimable(openOfferID);
            }
        }
        delete openOffersPerRequest[request.ID];
        emit RequestClaimable(request.ID, fulfilledOfferIDs);
    }

    // Money operations

    /**
    @notice Allows an authorised account to withdraw Ethers from the marketplace.
    @param offerID The ID of the offer for which the money is being claimed.
    @dev
    The following requirements are to be met for a successful operation:
        - The offer being referred must exist, and must belong to a decided request.
        - The request being referenced by the offer must have been fulfilled, i.e., a set of access tokens must have been issued for the set of winning offers.
        - The account withdrawing must be authorised:
            * If the offer is a winning one, only the request creator can withdraw.
            * If the offer is not a winning one, only the offer creator can withdraw.
    If the transaction fails, it reverts (no state is changed, Weis, minus the gas fees, returned to the offer creator).
    @return The tuple (status, amount) where status is the status code of the transaction, and amount is the amount of money that was escrowed with the offer.
    */
    function withdraw(uint offerID) public returns (uint8 status, uint amount) {
        PaymentDetails storage paymentDetails = pendingPayments[offerID];

        if (!paymentDetails.created) {
            emit FunctionStatus(PaymentNotExisting);
            return (PaymentNotExisting, 0);
        }

        if (!paymentDetails.resolved) {
            emit FunctionStatus(PaymentNotResolved);
            return (PaymentNotResolved, 0);
        }

        Offer storage offer = offers[offerID];

        // Only offer creator can claim money
        if (paymentDetails.toReturn) {
            if (msg.sender != offer.offerMaker) {
                emit FunctionStatus(AccessDenied);
                return (AccessDenied, 0);
            }
        } else {    // Only request creator can claim money
            Request storage request = requests[offer.requestID];
            if (msg.sender != request.requestMaker) {
                emit FunctionStatus(AccessDenied);
                return (AccessDenied, 0);
            }
        }

        uint paymentAmount = paymentDetails.amount;

        delete pendingPayments[offerID];
        msg.sender.transfer(paymentAmount);
        emit PaymentCashedOut(offer.requestID, offerID, paymentAmount);
        emit FunctionStatus(Successful);
        return (Successful, paymentAmount);
    }
}