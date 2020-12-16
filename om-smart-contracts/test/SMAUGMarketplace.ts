import { AbiItem } from "web3-utils"
import { generateFunctionSignedTokenWithAccount } from "./utils"
import * as path from "path"
import * as fs from "fs"

contract("SMAUGMarketPlace", async accounts => {

    const SMAUGMarketPlace = artifacts.require("SMAUGMarketPlace")
    const SMAUGMarketPlaceABIFile = JSON.parse(fs.readFileSync(path.resolve(__dirname, "..", "build", "contracts", "SMAUGMarketPlace.json")).toString())
    const SMAUGMarketplaceABI = SMAUGMarketPlaceABIFile.abi as AbiItem[]
    const submitAuthorisedRequestMethodName = "submitAuthorisedRequest"
    const BN = web3.utils.BN

    it("getType", async () => {
        let contract = await SMAUGMarketPlace.deployed()
        let expectedType = "eu.sofie-iot.smaug-marketplace"

        let marketType = (await contract.getType())[1]
        assert.equal(marketType, expectedType, "Wrong marketplace type returned.")
    })

    it("closeRequest & getClosedRequestIdentifiers (AbstractMarketPlace)", async () => {
        let owner = accounts[0]
        let requestCreator = accounts[1]
        let contract = await SMAUGMarketPlace.new({from: owner})

        // Valid request closure

        let requestCreationAccessToken = await generateFunctionSignedTokenWithAccount(SMAUGMarketplaceABI, submitAuthorisedRequestMethodName, requestCreator, contract.address, web3, owner)
        let tx = await contract.submitAuthorisedRequest(requestCreationAccessToken.tokenDigest, requestCreationAccessToken.signature, requestCreationAccessToken.nonce, 10, {from: requestCreator})
        let requestID = tx.logs[1].args.requestID.toNumber()
        await contract.submitRequestArrayExtra(requestID, [1, 1, 1, 1], {from: requestCreator})
        tx = await contract.closeRequest(requestID, {from: requestCreator})
        let txStatusCode = tx.logs[0].args.status.toNumber()
        assert.equal(txStatusCode, 0, "Request closing should succeed.")
        let closedRequestsResult = await contract.getClosedRequestIdentifiers()
        let closedRequestIDs = closedRequestsResult[1].map(requestID => requestID.toNumber())
        assert.equal(closedRequestIDs.length, 1, "Contract should only have one closed request.")
        assert.equal(closedRequestIDs[0], requestID, "ID of closed request different than expected.")
        let requestDetails = await contract.getRequest(requestID)
        let requestStage = requestDetails.stage
        assert.equal(requestStage, 2, "Request stage should be closed.")

        // Request not defined

        tx = await contract.closeRequest(99999, {from: requestCreator})
        txStatusCode = tx.logs[0].args.status.toNumber()
        assert.equal(txStatusCode, 2, "closeRequest() should fail because there is not open request with given ID.")

        // closeRequest() called by someone who is not the request creator

        let otherRequestCreator = accounts[9]
        requestCreationAccessToken = await generateFunctionSignedTokenWithAccount(SMAUGMarketplaceABI, submitAuthorisedRequestMethodName, requestCreator, contract.address, web3, owner)
        tx = await contract.submitAuthorisedRequest(requestCreationAccessToken.tokenDigest, requestCreationAccessToken.signature, requestCreationAccessToken.nonce, 10, {from: requestCreator})
        requestID = tx.logs[1].args.requestID.toNumber()
        tx = await contract.closeRequest(requestID, {from: otherRequestCreator})
        txStatusCode = tx.logs[0].args.status.toNumber()
        assert.equal(txStatusCode, 1, "closeRequest() should fail because the caller is not the creator of the request.")        
    })
    
    it("decideRequest & isRequestDecided (AbstractMarketPlace) & getRequestDecision (AbstractMarketPlace)", async () => {
        let owner = accounts[0]
        let requestCreator = accounts[1]
        let offerCreator = accounts[2]
        let contract = await SMAUGMarketPlace.new({from: owner})

        // Valid request decision

        let requestCreationAccessToken = await generateFunctionSignedTokenWithAccount(SMAUGMarketplaceABI, submitAuthorisedRequestMethodName, requestCreator, contract.address, web3, owner)
        let tx = await contract.submitAuthorisedRequest(requestCreationAccessToken.tokenDigest, requestCreationAccessToken.signature, requestCreationAccessToken.nonce, 100000000000, {from: requestCreator})
        let requestID = tx.logs[1].args.requestID.toNumber()
        await contract.submitRequestArrayExtra(requestID, [1, 500, 1, 1], {from: requestCreator})
        tx = await contract.submitOffer(requestID, {from: offerCreator})
        let offerID1 = tx.logs[1].args.offerID.toNumber()
        let offer1DID = 1
        let offer1AuthenticationKey = 2
        await contract.submitOfferArrayExtra(offerID1, [2, 5, 0, web3.eth.abi.encodeParameter("uint256", offer1DID), web3.eth.abi.encodeParameter("uint256", offer1AuthenticationKey)], {from: offerCreator, value: "5"})        // This one also includes the optional authentiction key
        tx = await contract.submitOffer(requestID, {from: offerCreator})
        let offerID2 = tx.logs[1].args.offerID.toNumber()
        let offer2DID = 3
        await contract.submitOfferArrayExtra(offerID2, [2, 5, 0, offer2DID], {from: offerCreator, value: "5"})
        tx = await contract.decideRequest(requestID, [offerID1, offerID2], {from: requestCreator})

        let offerDecisionInterledgerEventType = tx.logs[4].event
        assert.equal(offerDecisionInterledgerEventType, "InterledgerEventSending", "decideRequest() did not produce the expected interledger event.")
        let offerDecisionInterledgerEventID = tx.logs[4].args.id
        assert.equal(0, offerDecisionInterledgerEventID, "Interledger event ID should have been of value 0.")
        let offerDecisionInterledgerEventHexData = tx.logs[4].args.data.substr(2)
        let offer1AuthKeyByte = offerDecisionInterledgerEventHexData.substr(0, 2)
        let offer1IDInfo = offerDecisionInterledgerEventHexData.substr(2, 64)
        let offer1DIDInfo = offerDecisionInterledgerEventHexData.substr(66, 64)
        let offer1AuthKeyInfo = offerDecisionInterledgerEventHexData.substr(130, 64)
        assert.equal(1, web3.utils.hexToNumber("0x" + offer1AuthKeyByte), "Byte indicator of auth key for offer1 should be 1.")
        assert.equal(offerID1, web3.eth.abi.decodeParameter("uint256", "0x" + offer1IDInfo), "Wrong offer ID returned by Interledger event.")
        assert.equal(offer1DID, web3.eth.abi.decodeParameter("uint256", "0x" + offer1DIDInfo), "Wrong offer DID returned by Interledger event.")
        assert.equal(offer1AuthenticationKey, web3.eth.abi.decodeParameter("uint256", "0x" + offer1AuthKeyInfo), "Wrong offer authkey returned by Interledger event.")

        let offer2AuthKeyByte = offerDecisionInterledgerEventHexData.substr(194, 2)
        let offer2IDInfo = offerDecisionInterledgerEventHexData.substr(196, 64)
        let offer2DIDInfo = offerDecisionInterledgerEventHexData.substr(260, 64)
        assert.equal(0, web3.utils.hexToNumber("0x" + offer2AuthKeyByte), "Byte indicator of auth key for offer2 should be 0.")
        assert.equal(offerID2, web3.eth.abi.decodeParameter("uint256", "0x" + offer2IDInfo), "Wrong offer ID returned by Interledger event.")
        assert.equal(offer2DID, web3.eth.abi.decodeParameter("uint256", "0x" + offer2DIDInfo), "Wrong offer DID returned by Interledger event.")        

        // // Undefined request

        tx = await contract.decideRequest(99999, [], {from: requestCreator})
        let txStatusCode = tx.logs[0].args.status.toNumber()
        assert.equal(txStatusCode, 2, "decideRequest() should fail becase request with given ID is not present.")

        // Unauthorised user to decide the request

        let anauthorisedUser = accounts[9]
        requestCreationAccessToken = await generateFunctionSignedTokenWithAccount(SMAUGMarketplaceABI, submitAuthorisedRequestMethodName, requestCreator, contract.address, web3, owner)
        tx = await contract.submitAuthorisedRequest(requestCreationAccessToken.tokenDigest, requestCreationAccessToken.signature, requestCreationAccessToken.nonce, 100000000000, {from: requestCreator})
        requestID = tx.logs[1].args.requestID.toNumber()
        await contract.submitRequestArrayExtra(requestID, [1, 1, 1, 1], {from: requestCreator})
        tx = await contract.decideRequest(requestID, [], {from: anauthorisedUser})
        txStatusCode = tx.logs[0].args.status.toNumber()
        assert.equal(txStatusCode, 1, "decideRequest() should fail becase caller is different than request creator.")
    })

    it("deleteRequest", async () => {
        let owner = accounts[0]
        let requestCreator = accounts[1]
        let offerCreator = accounts[2]
        let contract = await SMAUGMarketPlace.new({from: owner})

        // Valid request deletion

        let requestCreationAccessToken = await generateFunctionSignedTokenWithAccount(SMAUGMarketplaceABI, submitAuthorisedRequestMethodName, requestCreator, contract.address, web3, owner)
        let tx = await contract.submitAuthorisedRequest(requestCreationAccessToken.tokenDigest, requestCreationAccessToken.signature, requestCreationAccessToken.nonce, 100000000000, {from: requestCreator})
        let requestID = tx.logs[1].args.requestID.toNumber()
        await contract.submitRequestArrayExtra(requestID, [1, 1, 1, 1], {from: requestCreator})
        await contract.closeRequest(requestID, {from: requestCreator})
        tx = await contract.deleteRequest(requestID, {from: requestCreator})
        let txStatusCode = tx.logs[0].args.status.toNumber()
        assert.equal(txStatusCode, 0, "deleteRequest() should succeed.")
        let requestInfo = await contract.getRequest(requestID)
        let requestInfoStatus = requestInfo.status.toNumber()
        assert.equal(requestInfoStatus, 2, "getRequest() should return status code 2 since the request has been deleted.")

        // Undefined request

        tx = await contract.deleteRequest(99999, {from: requestCreator})
        txStatusCode = tx.logs[0].args.status.toNumber()
        assert.equal(txStatusCode, 2, "decideRequest() should fail becase request with given ID is not present.")

        // Unauthorised user to decide the request

        let anauthorisedUser = accounts[9]
        requestCreationAccessToken = await generateFunctionSignedTokenWithAccount(SMAUGMarketplaceABI, submitAuthorisedRequestMethodName, requestCreator, contract.address, web3, owner)
        tx = await contract.submitAuthorisedRequest(requestCreationAccessToken.tokenDigest, requestCreationAccessToken.signature, requestCreationAccessToken.nonce, 100000000000, {from: requestCreator})
        requestID = tx.logs[1].args.requestID.toNumber()
        await contract.submitRequestArrayExtra(requestID, [1, 1, 1, 1], {from: requestCreator})
        tx = await contract.deleteRequest(requestID, {from: anauthorisedUser})
        txStatusCode = tx.logs[0].args.status.toNumber()
        assert.equal(txStatusCode, 1, "decideRequest() should fail becase caller is different than request creator.")        

        // Request not closed

        requestCreationAccessToken = await generateFunctionSignedTokenWithAccount(SMAUGMarketplaceABI, submitAuthorisedRequestMethodName, requestCreator, contract.address, web3, owner)
        tx = await contract.submitAuthorisedRequest(requestCreationAccessToken.tokenDigest, requestCreationAccessToken.signature, requestCreationAccessToken.nonce, 100000000000, {from: requestCreator})
        requestID = tx.logs[1].args.requestID.toNumber()
        await contract.submitRequestArrayExtra(requestID, [1, 1, 1, 1], {from: requestCreator})
        tx = await contract.deleteRequest(requestID, {from: requestCreator})
        txStatusCode = tx.logs[0].args.status.toNumber()
        assert.equal(txStatusCode, 7, "decideRequest() should fail becase request is not closed yet.")
    })

    it("submitRequestArrayExtra & getRequestExtra & getOpenRequestIdentifiers (AbstractMarketPlace)", async () => {
        let owner = accounts[0]
        let requestCreator = accounts[1]
        let contract = await SMAUGMarketPlace.new({from: owner})
        let expectedlockerID = "0xa5b9d60f32436310afebcfda832817a68921beb782fabf7915cc0460b443116a"

        // Valid request extra submission

        let validPricingRules = [
            [],
            [1, 1],
            [1, 50, 5, 40, 10, 30, 30, 20, 60, 10]
        ]
        for (let validPricingRule of validPricingRules) {
            let requestCreationAccessToken = await generateFunctionSignedTokenWithAccount(SMAUGMarketplaceABI, submitAuthorisedRequestMethodName, requestCreator, contract.address, web3, owner)
            let tx = await contract.submitAuthorisedRequest(requestCreationAccessToken.tokenDigest, requestCreationAccessToken.signature, requestCreationAccessToken.nonce, 1000000000, {from: requestCreator})
            let requestID = tx.logs[1].args.requestID.toNumber()
            tx = await contract.submitRequestArrayExtra(requestID, [1, 100, 1].concat(validPricingRule).concat([web3.utils.toBN(expectedlockerID)]), {from: requestCreator})
            let txStatusCode = tx.logs[0].args.status.toNumber()
            assert.equal(txStatusCode, 0, "Request extra submission should succeed.")
            let requestDetails = await contract.getRequest(requestID)
            let requestStage = requestDetails.stage
            assert.equal(requestStage, 1, "getRequest() should succeed.")
            let requestExtraDetails = await contract.getRequestExtra(requestID)
            txStatusCode = requestExtraDetails.status
            let startOfRentTime = requestExtraDetails.startOfRentTime
            let duration = requestExtraDetails.duration
            let auctionMinPricePerSlot = requestExtraDetails.auctionMinPricePerSlot
            let instantBuyRules = requestExtraDetails.instantBuyRules.map(rule => rule.toNumber())
            let lockerID = web3.utils.toHex(requestExtraDetails.lockerID)
            assert.equal(txStatusCode, 0, "Wrong status code returned.")
            assert.equal(startOfRentTime, 1, "Wrong startOfRentTime returned.")
            assert.equal(duration, 100, "Wrong duration returned.")
            assert.equal(auctionMinPricePerSlot, 1, "Wrong auctionMinPricePerSlot returned.")
            assert.equal(JSON.stringify(instantBuyRules), JSON.stringify(validPricingRule), "Wrong instantBuyRules returned.")
            assert.equal(lockerID, expectedlockerID, "Wrong lockerID returned.")
        }

        // Invalid request extra submission (array needs to be at least 4-element long)

        let invalidExtras = [
            [],
            [1],
            [1, 2],
            [1, 2, 3]
        ]

        for (let invalidExtra of invalidExtras) {
            let requestCreationAccessToken = await generateFunctionSignedTokenWithAccount(SMAUGMarketplaceABI, submitAuthorisedRequestMethodName, requestCreator, contract.address, web3, owner)
            let tx = await contract.submitAuthorisedRequest(requestCreationAccessToken.tokenDigest, requestCreationAccessToken.signature, requestCreationAccessToken.nonce, 1000000000, {from: requestCreator})
            let requestID = tx.logs[1].args.requestID.toNumber()
            tx = await contract.submitRequestArrayExtra(requestID, invalidExtra, {from: requestCreator})
            let txStatusCode = tx.logs[0].args.status.toNumber()
            assert.equal(txStatusCode, 12, "Request extra submission should fail because number of extra elements is wrong.")
        }

        // Invalid request ID

        let requestCreationAccessToken = await generateFunctionSignedTokenWithAccount(SMAUGMarketplaceABI, submitAuthorisedRequestMethodName, requestCreator, contract.address, web3, owner)
        await contract.submitAuthorisedRequest(requestCreationAccessToken.tokenDigest, requestCreationAccessToken.signature, requestCreationAccessToken.nonce, 1000000000, {from: requestCreator})
        let tx = await contract.submitRequestArrayExtra(99999, [1, 1, 1, 1], {from: requestCreator})
        let txStatusCode = tx.logs[0].args.status.toNumber()
        assert.equal(txStatusCode, 2, "Request extra submission should fail because request does not exist.")

        // Request not pending

        requestCreationAccessToken = await generateFunctionSignedTokenWithAccount(SMAUGMarketplaceABI, submitAuthorisedRequestMethodName, requestCreator, contract.address, web3, owner)
        tx = await contract.submitAuthorisedRequest(requestCreationAccessToken.tokenDigest, requestCreationAccessToken.signature, requestCreationAccessToken.nonce, 1000000000, {from: requestCreator})
        let requestID = tx.logs[1].args.requestID.toNumber()
        await contract.submitRequestArrayExtra(requestID, [1, 1, 1, 1], {from: requestCreator})
        tx = await contract.submitRequestArrayExtra(requestID, [1, 1, 1, 1], {from: requestCreator})
        txStatusCode = tx.logs[0].args.status.toNumber()
        assert.equal(txStatusCode, 5, "Request extra submission should fail because request is not pending.")

        // Request extra submitter != request creator

        let unauthorisedUser = accounts[2]
        requestCreationAccessToken = await generateFunctionSignedTokenWithAccount(SMAUGMarketplaceABI, submitAuthorisedRequestMethodName, requestCreator, contract.address, web3, owner)
        tx = await contract.submitAuthorisedRequest(requestCreationAccessToken.tokenDigest, requestCreationAccessToken.signature, requestCreationAccessToken.nonce, 1000000000, {from: requestCreator})
        requestID = tx.logs[1].args.requestID.toNumber()
        tx = await contract.submitRequestArrayExtra(requestID, [1, 1, 1, 1], {from: unauthorisedUser})
        txStatusCode = tx.logs[0].args.status.toNumber()
        assert.equal(txStatusCode, 1, "Request extra submission should fail because request creator != request extra submitter.")

        // Pricing rule extending beyong the request duration

        requestCreationAccessToken = await generateFunctionSignedTokenWithAccount(SMAUGMarketplaceABI, submitAuthorisedRequestMethodName, requestCreator, contract.address, web3, owner)
        tx = await contract.submitAuthorisedRequest(requestCreationAccessToken.tokenDigest, requestCreationAccessToken.signature, requestCreationAccessToken.nonce, 1000000000, {from: requestCreator})
        requestID = tx.logs[1].args.requestID.toNumber()
        let requestDuration = 1
        let pricingStartRange = 5
        tx = await contract.submitRequestArrayExtra(requestID, [1, requestDuration, 1, pricingStartRange, 2, 1], {from: requestCreator})
        txStatusCode = tx.logs[0].args.status.toNumber()
        assert.equal(txStatusCode, 12, "Request extra submission should fail because pricing rules contain duration start range beyong the request duration.")

        // Invalid instant buy pricing rules

        let invalidPricingRules = [
            [1],                                                    // # of values must be even
            [1, 2, 3],                                              // # of values must be even
            [1, 50, 5, 40, 10, 30, 7, 20, 60, 10]                   // # 1st, 3rd, 5th.... values must be monotonically increasing
        ]

        for (let invalidPricingRule of invalidPricingRules) {
            let requestCreationAccessToken = await generateFunctionSignedTokenWithAccount(SMAUGMarketplaceABI, submitAuthorisedRequestMethodName, requestCreator, contract.address, web3, owner)
            let tx = await contract.submitAuthorisedRequest(requestCreationAccessToken.tokenDigest, requestCreationAccessToken.signature, requestCreationAccessToken.nonce, 1000000000, {from: requestCreator})
            let requestID = tx.logs[1].args.requestID.toNumber()
            tx = await contract.submitRequestArrayExtra(requestID, [1, 1, 1].concat(invalidPricingRule).concat([1]), {from: requestCreator})
            let txStatusCode = tx.logs[0].args.status.toNumber()
            assert.equal(txStatusCode, 12, "Request extra submission should fail because pricing rules for instant rent are not valid.")
        }
    })

    it("submitOffer & isOfferDefined (AbstractMarketPlace) & getOffer (AbstractMarketPlace) & getRequestOfferIDs (AbstractMarketPlace)", async () => {

        let owner = accounts[0]
        let requestCreator = accounts[1]
        let offerCreator = accounts[2]
        let contract = await SMAUGMarketPlace.new({from: owner})

        // Valid offer creation

        let requestCreationAccessToken = await generateFunctionSignedTokenWithAccount(SMAUGMarketplaceABI, submitAuthorisedRequestMethodName, requestCreator, contract.address, web3, owner)
        let tx = await contract.submitAuthorisedRequest(requestCreationAccessToken.tokenDigest, requestCreationAccessToken.signature, requestCreationAccessToken.nonce, 1000000000000, {from: requestCreator})
        let requestID = tx.logs[1].args.requestID.toNumber()
        await contract.submitRequestArrayExtra(requestID, [1, 1, 1, 1], {from: requestCreator})
        tx = await contract.submitOffer(requestID, {from: offerCreator})
        let txStatusCode = tx.logs[0].args.status.toNumber()
        assert.equal(txStatusCode, 0, "Offer submission should succeed.")
        let offerID = tx.logs[1].args.offerID.toNumber()
        let offerDetails = await contract.getOffer(offerID)
        let offerRequestID = offerDetails.requestID.toNumber()
        let offerMaker = offerDetails.offerMaker
        let stage = offerDetails.stage
        assert.equal(offerRequestID, requestID, "Wrong offerRequestID returned.")
        assert.equal(offerMaker, offerCreator, "Wrong offerMaker returned.")
        assert.equal(stage, 0, "Wrong stage returned.")

        // Offer for request not defined

        tx = await contract.submitOffer(99999, {from: offerCreator})
        txStatusCode = tx.logs[0].args.status.toNumber()
        assert.equal(txStatusCode, 2, "Offer submission should fail because the request is not defined.")

        // Offer for past deadline

        requestCreationAccessToken = await generateFunctionSignedTokenWithAccount(SMAUGMarketplaceABI, submitAuthorisedRequestMethodName, requestCreator, contract.address, web3, owner)
        tx = await contract.submitAuthorisedRequest(requestCreationAccessToken.tokenDigest, requestCreationAccessToken.signature, requestCreationAccessToken.nonce, 1, {from: requestCreator})
        requestID = tx.logs[1].args.requestID.toNumber()
        await contract.submitRequestArrayExtra(requestID, [1, 1, 1, 1], {from: requestCreator})
        tx = await contract.submitOffer(requestID, {from: offerCreator})
        txStatusCode = tx.logs[0].args.status.toNumber()
        assert.equal(txStatusCode, 3, "Offer submission should fail because the deadline for submitting offer has passed.")

        // Offer for not open request

        requestCreationAccessToken = await generateFunctionSignedTokenWithAccount(SMAUGMarketplaceABI, submitAuthorisedRequestMethodName, requestCreator, contract.address, web3, owner)
        tx = await contract.submitAuthorisedRequest(requestCreationAccessToken.tokenDigest, requestCreationAccessToken.signature, requestCreationAccessToken.nonce, 1000000000000, {from: requestCreator})
        requestID = tx.logs[1].args.requestID.toNumber()
        tx = await contract.submitOffer(requestID, {from: offerCreator})
        txStatusCode = tx.logs[0].args.status.toNumber()
        assert.equal(txStatusCode, 4, "Offer submission should fail because the request is not open.")
    })

    it("submitOfferArrayExtra & getOfferExtra", async () => {
        let owner = accounts[0]
        let requestCreator = accounts[1]
        let offerCreator = accounts[2]
        let contract = await SMAUGMarketPlace.new({from: owner})

        // Valid auction offer extra submission with no authentication key

        let requestCreationAccessToken = await generateFunctionSignedTokenWithAccount(SMAUGMarketplaceABI, submitAuthorisedRequestMethodName, requestCreator, contract.address, web3, owner)
        let tx = await contract.submitAuthorisedRequest(requestCreationAccessToken.tokenDigest, requestCreationAccessToken.signature, requestCreationAccessToken.nonce, 1000000000000, {from: requestCreator})
        let requestID = tx.logs[1].args.requestID.toNumber()
        let requestStartingTime = 1
        let requestDuration = 5
        let requestMinAuctionPrice = 10
        await contract.submitRequestArrayExtra(requestID, [requestStartingTime, requestDuration, requestMinAuctionPrice, 1], {from: requestCreator})
        tx = await contract.submitOffer(requestID, {from: offerCreator})
        let offerID = tx.logs[1].args.offerID.toNumber()
        let offerWei = requestDuration * requestMinAuctionPrice
        let inputOfferCreatorEncryptionKey = web3.utils.stringToHex("2wJPyULfLLnYTEFYzByfUR")
        let contractBalanceBeforeOffer = parseInt(await web3.eth.getBalance(contract.address))
        tx = await contract.submitOfferArrayExtra(offerID, [requestStartingTime, requestDuration, 0, web3.utils.toBN(inputOfferCreatorEncryptionKey)], {from: offerCreator, value: `${offerWei}`})
        let txStatusCode = tx.logs[0].args.status.toNumber()
        assert.equal(txStatusCode, 0, "Offer extra submission should succeed.")
        let contractBalanceAfterOffer = parseInt(await web3.eth.getBalance(contract.address))
        let offerExtraDetails = await contract.getOfferExtra(offerID)
        let txStatus = offerExtraDetails.status
        let offerStartingTime = offerExtraDetails.startOfRentTime
        let offerType = offerExtraDetails.offerType
        let offerWeiRegistered = parseInt(offerExtraDetails.priceOffered)
        let offerCreatorEncryptionKey = offerExtraDetails.offerCreatorEncryptionKey
        let offerCreatorAuthenticationKey = offerExtraDetails.offerCreatorAuthenticationKey
        assert.equal(txStatus, 0, "getOfferExtra() should succeed.")
        assert.equal(offerStartingTime, requestStartingTime, "Wrong offerStartingTime returned.")
        assert.equal(offerType, 0, "Wrong offerType returned.")
        assert.equal(offerWei, offerWeiRegistered, "Wrong value saved in the offer extra for the price paid.")
        assert.equal(web3.utils.toHex(offerCreatorEncryptionKey), inputOfferCreatorEncryptionKey, "Wrong offerCreatorEncryptionKey returned")
        assert.equal(web3.utils.toHex(offerCreatorAuthenticationKey), "0x0", "Wrong offerCreatorAuthenticationKey returned")
        assert.equal(contractBalanceBeforeOffer+offerWei, contractBalanceAfterOffer, "Wrong account balance for marketplace after succesful offer")

        // Valid auction offer extra submission with authentication key

        requestCreationAccessToken = await generateFunctionSignedTokenWithAccount(SMAUGMarketplaceABI, submitAuthorisedRequestMethodName, requestCreator, contract.address, web3, owner)
        tx = await contract.submitAuthorisedRequest(requestCreationAccessToken.tokenDigest, requestCreationAccessToken.signature, requestCreationAccessToken.nonce, 1000000000000, {from: requestCreator})
        requestID = tx.logs[1].args.requestID.toNumber()
        requestStartingTime = 1
        requestDuration = 5
        requestMinAuctionPrice = 10
        await contract.submitRequestArrayExtra(requestID, [requestStartingTime, requestDuration, requestMinAuctionPrice, 1], {from: requestCreator})
        tx = await contract.submitOffer(requestID, {from: offerCreator})
        offerID = tx.logs[1].args.offerID.toNumber()
        offerWei = requestDuration * requestMinAuctionPrice
        let inputAuthenticationKey = "0xa5b9d60f32436310afebcfda832817a68921beb782fabf7915cc0460b443116a"
        contractBalanceBeforeOffer = parseInt(await web3.eth.getBalance(contract.address))
        tx = await contract.submitOfferArrayExtra(offerID, [requestStartingTime, requestDuration, 0, web3.utils.toBN(inputOfferCreatorEncryptionKey), web3.utils.toBN(inputAuthenticationKey)], {from: offerCreator, value: `${offerWei}`})
        txStatusCode = tx.logs[0].args.status.toNumber()
        assert.equal(txStatusCode, 0, "Offer extra submission should succeed.")
        contractBalanceAfterOffer = parseInt(await web3.eth.getBalance(contract.address))
        offerExtraDetails = await contract.getOfferExtra(offerID)
        txStatus = offerExtraDetails.status
        offerStartingTime = offerExtraDetails.startOfRentTime
        offerType = offerExtraDetails.offerType
        offerWeiRegistered = offerExtraDetails.priceOffered
        offerCreatorEncryptionKey = offerExtraDetails.offerCreatorEncryptionKey
        offerCreatorAuthenticationKey = offerExtraDetails.offerCreatorAuthenticationKey
        assert.equal(txStatus, 0, "getOfferExtra() should succeed.")
        assert.equal(offerStartingTime, requestStartingTime, "Wrong offerStartingTime returned.")
        assert.equal(offerType, 0, "Wrong offerType returned.")
        assert.equal(offerWei, offerWeiRegistered, "Wrong value saved in the offer extra for the price paid.")
        assert.equal(web3.utils.toHex(offerCreatorEncryptionKey), inputOfferCreatorEncryptionKey, "Wrong offerCreatorEncryptionKey returned")
        assert.equal(web3.utils.toHex(offerCreatorAuthenticationKey), inputAuthenticationKey, "Wrong offerCreatorAuthenticationKey returned")
        assert.equal(contractBalanceBeforeOffer+offerWei, contractBalanceAfterOffer, "Wrong account balance for marketplace after succesful offer")

        // Valid instant rent offer extra submission with no authentication key

        requestCreationAccessToken = await generateFunctionSignedTokenWithAccount(SMAUGMarketplaceABI, submitAuthorisedRequestMethodName, requestCreator, contract.address, web3, owner)
        tx = await contract.submitAuthorisedRequest(requestCreationAccessToken.tokenDigest, requestCreationAccessToken.signature, requestCreationAccessToken.nonce, 1000000000000, {from: requestCreator})
        requestID = tx.logs[1].args.requestID.toNumber()
        await contract.submitRequestArrayExtra(requestID, [1, 5, 0, 1, 1, 1], {from: requestCreator})           // Instant rent costs 1 token/minute
        tx = await contract.submitOffer(requestID, {from: offerCreator})
        offerID = tx.logs[1].args.offerID.toNumber()
        offerWei = requestDuration * 1
        contractBalanceBeforeOffer = parseInt(await web3.eth.getBalance(contract.address))
        tx = await contract.submitOfferArrayExtra(offerID, [1, 5, 1, web3.utils.toBN(inputOfferCreatorEncryptionKey)], {from: offerCreator, value: `${offerWei}`})
        txStatusCode = tx.logs[0].args.status.toNumber()
        assert.equal(txStatusCode, 0, "Offer extra submission should succeed.")
        contractBalanceAfterOffer = parseInt(await web3.eth.getBalance(contract.address))
        let winningOfferIDs = tx.logs[5].args.winningOffersIDs.map(offerID => offerID.toNumber())
        assert.equal(winningOfferIDs.length, 1, "Number of winning offer IDs should be 1.")
        assert.equal(winningOfferIDs[0], offerID, "The ID of the winning should match the ID of the instant rent offer made.")
        let isRequestDecided = (await contract.isRequestDecided(requestID))[1]
        assert.isTrue(isRequestDecided, "Request should be decided after a valid instant rent offer has been submitted.")
        let requestDecision = await contract.getRequestDecision(requestID)
        winningOfferIDs = requestDecision.acceptedOfferIDs.map(offerID => offerID.toNumber())
        assert.equal(winningOfferIDs.length, 1, "Number of winning offer IDs should be 1.")
        assert.equal(winningOfferIDs[0], offerID, "The ID of the winning should match the ID of the instant rent offer made.")
        offerExtraDetails = await contract.getOfferExtra(offerID)
        txStatus = offerExtraDetails.status
        offerStartingTime = offerExtraDetails.startOfRentTime
        offerType = offerExtraDetails.offerType
        offerWeiRegistered = offerExtraDetails.priceOffered.toNumber()
        offerCreatorEncryptionKey = offerExtraDetails.offerCreatorEncryptionKey
        offerCreatorAuthenticationKey = offerExtraDetails.offerCreatorAuthenticationKey
        assert.equal(txStatus, 0, "getOfferExtra() should succeed.")
        assert.equal(offerStartingTime, requestStartingTime, "Wrong offerStartingTime returned.")
        assert.equal(offerType, 1, "Wrong offerType returned.")
        assert.equal(offerWei, offerWeiRegistered, "Wrong value saved in the offer extra for the price paid.")
        assert.equal(web3.utils.toHex(offerCreatorEncryptionKey), inputOfferCreatorEncryptionKey, "Wrong offerCreatorEncryptionKey returned")
        assert.equal(web3.utils.toHex(offerCreatorAuthenticationKey), "0x0", "Wrong offerCreatorAuthenticationKey returned")
        assert.equal(contractBalanceBeforeOffer+offerWei, contractBalanceAfterOffer, "Wrong account balance for marketplace after succesful offer")

        // Valid instant rent offer extra submission with authentication key

        requestCreationAccessToken = await generateFunctionSignedTokenWithAccount(SMAUGMarketplaceABI, submitAuthorisedRequestMethodName, requestCreator, contract.address, web3, owner)
        tx = await contract.submitAuthorisedRequest(requestCreationAccessToken.tokenDigest, requestCreationAccessToken.signature, requestCreationAccessToken.nonce, 1000000000000, {from: requestCreator})
        requestID = tx.logs[1].args.requestID.toNumber()
        await contract.submitRequestArrayExtra(requestID, [1, 5, 0, 1, 1, 1], {from: requestCreator})           // Instant rent costs 1 token/minute
        tx = await contract.submitOffer(requestID, {from: offerCreator})
        offerID = tx.logs[1].args.offerID.toNumber()
        offerWei = requestDuration * 1
        contractBalanceBeforeOffer = parseInt(await web3.eth.getBalance(contract.address))
        tx = await contract.submitOfferArrayExtra(offerID, [1, 5, 1, web3.utils.toBN(inputOfferCreatorEncryptionKey), web3.utils.toBN(inputAuthenticationKey)], {from: offerCreator, value: `${offerWei}`})
        txStatusCode = tx.logs[0].args.status.toNumber()
        assert.equal(txStatusCode, 0, "Offer extra submission should succeed.")
        contractBalanceAfterOffer = parseInt(await web3.eth.getBalance(contract.address))
        winningOfferIDs = tx.logs[5].args.winningOffersIDs.map(offerID => offerID.toNumber())
        assert.equal(winningOfferIDs.length, 1, "Number of winning offer IDs should be 1.")
        assert.equal(winningOfferIDs[0], offerID, "The ID of the winning should match the ID of the instant rent offer made.")
        isRequestDecided = (await contract.isRequestDecided(requestID))[1]
        assert.isTrue(isRequestDecided, "Request should be decided after a valid instant rent offer has been submitted.")
        requestDecision = await contract.getRequestDecision(requestID)
        winningOfferIDs = requestDecision.acceptedOfferIDs.map(offerID => offerID.toNumber())
        assert.equal(winningOfferIDs.length, 1, "Number of winning offer IDs should be 1.")
        assert.equal(winningOfferIDs[0], offerID, "The ID of the winning should match the ID of the instant rent offer made.")
        offerExtraDetails = await contract.getOfferExtra(offerID)
        txStatus = offerExtraDetails.status
        offerStartingTime = offerExtraDetails.startOfRentTime
        offerType = offerExtraDetails.offerType
        offerWeiRegistered = offerExtraDetails.priceOffered.toNumber()
        offerCreatorEncryptionKey = offerExtraDetails.offerCreatorEncryptionKey
        offerCreatorAuthenticationKey = offerExtraDetails.offerCreatorAuthenticationKey
        assert.equal(txStatus, 0, "getOfferExtra() should succeed.")
        assert.equal(offerStartingTime, requestStartingTime, "Wrong offerStartingTime returned.")
        assert.equal(offerType, 1, "Wrong offerType returned.")
        assert.equal(offerWei, offerWeiRegistered, "Wrong value saved in the offer extra for the price paid.")
        assert.equal(web3.utils.toHex(offerCreatorEncryptionKey), inputOfferCreatorEncryptionKey, "Wrong offerCreatorEncryptionKey returned")
        assert.equal(web3.utils.toHex(offerCreatorAuthenticationKey), inputAuthenticationKey, "Wrong offerCreatorAuthenticationKey returned")
        assert.equal(contractBalanceBeforeOffer+offerWei, contractBalanceAfterOffer, "Wrong account balance for marketplace after succesful offer")

        // Invalid offer extra submission (array needs to be long either 4 or 5)

        let invalidExtras = [
            [],
            [1],
            [1, 2],
            [1, 2, 3],
            [1, 2, 3, 4, 5, 6]
        ]
        requestCreationAccessToken = await generateFunctionSignedTokenWithAccount(SMAUGMarketplaceABI, submitAuthorisedRequestMethodName, requestCreator, contract.address, web3, owner)
        tx = await contract.submitAuthorisedRequest(requestCreationAccessToken.tokenDigest, requestCreationAccessToken.signature, requestCreationAccessToken.nonce, 2000000000, {from: requestCreator})
        requestID = tx.logs[1].args.requestID.toNumber()
        await contract.submitRequestArrayExtra(requestID, [1, 1, 1, 1], {from: requestCreator})
        for (let invalidExtra of invalidExtras) {
            tx = await contract.submitOffer(requestID, {from: offerCreator})
            offerID = tx.logs[1].args.offerID.toNumber()
            contractBalanceBeforeOffer = parseInt(await web3.eth.getBalance(contract.address))
            try {
                tx = await contract.submitOfferArrayExtra(offerID, invalidExtra, {from: offerCreator, value: "1"})
            } catch (e) {
                assert.equal(e.reason, "12", "Offer extra addition should failed because extra array is invalid.")
                contractBalanceAfterOffer = parseInt(await web3.eth.getBalance(contract.address))
                assert.equal(contractBalanceBeforeOffer, contractBalanceAfterOffer, "Account balance for marketplace should be the same as before the failed offer.")                
            }
        }

        // Undefined offer ID

        requestCreationAccessToken = await generateFunctionSignedTokenWithAccount(SMAUGMarketplaceABI, submitAuthorisedRequestMethodName, requestCreator, contract.address, web3, owner)
        tx = await contract.submitAuthorisedRequest(requestCreationAccessToken.tokenDigest, requestCreationAccessToken.signature, requestCreationAccessToken.nonce, 2000000000, {from: requestCreator})
        requestID = tx.logs[1].args.requestID.toNumber()
        await contract.submitRequestArrayExtra(requestID, [1, 1, 1, 1], {from: requestCreator})
        contractBalanceBeforeOffer = parseInt(await web3.eth.getBalance(contract.address))
        try {
            tx = await contract.submitOfferArrayExtra(99999, [1, 1, 0, 1], {from: offerCreator, value: "1"})
        } catch (e) {
            assert.equal(e.reason, "2", "Offer extra submission should fail because offer specified does not exist.")
            contractBalanceAfterOffer = parseInt(await web3.eth.getBalance(contract.address))
            assert.equal(contractBalanceBeforeOffer, contractBalanceAfterOffer, "Account balance for marketplace should be the same as before the failed offer.")
        }

        // Not-pending offer

        requestCreationAccessToken = await generateFunctionSignedTokenWithAccount(SMAUGMarketplaceABI, submitAuthorisedRequestMethodName, requestCreator, contract.address, web3, owner)
        tx = await contract.submitAuthorisedRequest(requestCreationAccessToken.tokenDigest, requestCreationAccessToken.signature, requestCreationAccessToken.nonce, 2000000000, {from: requestCreator})
        requestID = tx.logs[1].args.requestID.toNumber()
        await contract.submitRequestArrayExtra(requestID, [1, 1, 1, 1], {from: requestCreator})
        tx = await contract.submitOffer(requestID, {from: offerCreator})
        offerID = tx.logs[1].args.offerID.toNumber()
        contractBalanceBeforeOffer = parseInt(await web3.eth.getBalance(contract.address))
        try {
            tx = await contract.submitOfferArrayExtra(offerID, [1, 1, 0, 1], {from: offerCreator, value: "1"})          // Closing the request
        } catch (e) {
            assert.equal(e.reason, "5", "Offer extra submission should fail because offer specified does not exist.")
            contractBalanceAfterOffer = parseInt(await web3.eth.getBalance(contract.address))
            assert.equal(contractBalanceBeforeOffer, contractBalanceAfterOffer, "Account balance for marketplace should be the same as before the failed offer.")
        }

        // Offer extra creator != offer creator

        requestCreationAccessToken = await generateFunctionSignedTokenWithAccount(SMAUGMarketplaceABI, submitAuthorisedRequestMethodName, requestCreator, contract.address, web3, owner)
        tx = await contract.submitAuthorisedRequest(requestCreationAccessToken.tokenDigest, requestCreationAccessToken.signature, requestCreationAccessToken.nonce, 2000000000, {from: requestCreator})
        requestID = tx.logs[1].args.requestID.toNumber()
        await contract.submitRequestArrayExtra(requestID, [1, 1, 1, 1], {from: requestCreator})
        let offerExtraCreator = accounts[9]
        tx = await contract.submitOffer(requestID, {from: offerCreator})
        offerID = tx.logs[1].args.offerID.toNumber()
        contractBalanceBeforeOffer = parseInt(await web3.eth.getBalance(contract.address))
        try {
            tx = await contract.submitOfferArrayExtra(offerID, [1, 1, 0, 1], {from: offerExtraCreator, value: "1"})
        } catch (e) {
            assert.equal(e.reason, "1", "Offer extra submission should fail because the creator of the offer extra != offer creator.")
            contractBalanceAfterOffer = parseInt(await web3.eth.getBalance(contract.address))
            assert.equal(contractBalanceBeforeOffer, contractBalanceAfterOffer, "Account balance for marketplace should be the same as before the failed offer.")
        }

        // Not-open request

        requestCreationAccessToken = await generateFunctionSignedTokenWithAccount(SMAUGMarketplaceABI, submitAuthorisedRequestMethodName, requestCreator, contract.address, web3, owner)
        tx = await contract.submitAuthorisedRequest(requestCreationAccessToken.tokenDigest, requestCreationAccessToken.signature, requestCreationAccessToken.nonce, 2000000000, {from: requestCreator})
        requestID = tx.logs[1].args.requestID.toNumber()
        tx = await contract.submitOffer(requestID, {from: offerCreator})
        txStatusCode = tx.logs[0].args.status.toNumber()
        assert.equal(txStatusCode, 4, "Offer extra submission should fail because the request is still pending (not open yet).")

        // Offer start time < request start time

        requestCreationAccessToken = await generateFunctionSignedTokenWithAccount(SMAUGMarketplaceABI, submitAuthorisedRequestMethodName, requestCreator, contract.address, web3, owner)
        tx = await contract.submitAuthorisedRequest(requestCreationAccessToken.tokenDigest, requestCreationAccessToken.signature, requestCreationAccessToken.nonce, 2000000000, {from: requestCreator})
        requestID = tx.logs[1].args.requestID.toNumber()
        requestStartingTime = 1
        await contract.submitRequestArrayExtra(requestID, [requestStartingTime, 1, 1, 1], {from: requestCreator})
        tx = await contract.submitOffer(requestID, {from: offerCreator})
        offerID = tx.logs[1].args.offerID.toNumber()
        contractBalanceBeforeOffer = parseInt(await web3.eth.getBalance(contract.address))
        try {
            tx = await contract.submitOfferArrayExtra(offerID, [requestStartingTime-1, 1, 0, 1], {from: offerCreator, value: "1"})
        } catch (e) {
            assert.equal(e.reason, "102", "Offer extra submission should fail because the offer starts earlier than the request starting time.")
            contractBalanceAfterOffer = parseInt(await web3.eth.getBalance(contract.address))
            assert.equal(contractBalanceBeforeOffer, contractBalanceAfterOffer, "Account balance for marketplace should be the same as before the failed offer.")
        }

        // Offer end time > request end time

        requestCreationAccessToken = await generateFunctionSignedTokenWithAccount(SMAUGMarketplaceABI, submitAuthorisedRequestMethodName, requestCreator, contract.address, web3, owner)
        tx = await contract.submitAuthorisedRequest(requestCreationAccessToken.tokenDigest, requestCreationAccessToken.signature, requestCreationAccessToken.nonce, 2000000000, {from: requestCreator})
        requestID = tx.logs[1].args.requestID.toNumber()
        requestStartingTime = 1
        requestDuration = 5
        await contract.submitRequestArrayExtra(requestID, [requestStartingTime, requestDuration, 1, 1], {from: requestCreator})
        tx = await contract.submitOffer(requestID, {from: offerCreator})
        offerID = tx.logs[1].args.offerID.toNumber()
        contractBalanceBeforeOffer = parseInt(await web3.eth.getBalance(contract.address))
        try {
            tx = await contract.submitOfferArrayExtra(offerID, [requestStartingTime, requestDuration+1, 0, 1], {from: offerCreator, value: "1"})
        } catch (e) {
            assert.equal(e.reason, "102", "Offer extra submission should fail because the offer ends later than the request end time.")
            contractBalanceAfterOffer = parseInt(await web3.eth.getBalance(contract.address))
            assert.equal(contractBalanceBeforeOffer, contractBalanceAfterOffer, "Account balance for marketplace should be the same as before the failed offer.")
        }

        // Auction offer price < min price asked in the request

        requestCreationAccessToken = await generateFunctionSignedTokenWithAccount(SMAUGMarketplaceABI, submitAuthorisedRequestMethodName, requestCreator, contract.address, web3, owner)
        tx = await contract.submitAuthorisedRequest(requestCreationAccessToken.tokenDigest, requestCreationAccessToken.signature, requestCreationAccessToken.nonce, 2000000000, {from: requestCreator})
        requestID = tx.logs[1].args.requestID.toNumber()
        let minAuctionPrice = 5
        await contract.submitRequestArrayExtra(requestID, [1, 1, minAuctionPrice, 1], {from: requestCreator})
        tx = await contract.submitOffer(requestID, {from: offerCreator})
        offerID = tx.logs[1].args.offerID.toNumber()
        let offerDuration = 1
        contractBalanceBeforeOffer = parseInt(await web3.eth.getBalance(contract.address))
        try {
            tx = await contract.submitOfferArrayExtra(offerID, [1, offerDuration, 0, 1], {from: offerCreator, value: `${offerDuration*minAuctionPrice - 1}`})
        } catch (e) {
            assert.equal(e.reason, "104", "Offer extra submission should fail because the money offerred does not meet the request minimum requirements.")
            contractBalanceAfterOffer = parseInt(await web3.eth.getBalance(contract.address))
            assert.equal(contractBalanceBeforeOffer, contractBalanceAfterOffer, "Account balance for marketplace should be the same as before the failed offer.")
        }

        // Instant rent offer for auction-only request

        requestCreationAccessToken = await generateFunctionSignedTokenWithAccount(SMAUGMarketplaceABI, submitAuthorisedRequestMethodName, requestCreator, contract.address, web3, owner)
        tx = await contract.submitAuthorisedRequest(requestCreationAccessToken.tokenDigest, requestCreationAccessToken.signature, requestCreationAccessToken.nonce, 2000000000, {from: requestCreator})
        requestID = tx.logs[1].args.requestID.toNumber()
        await contract.submitRequestArrayExtra(requestID, [1, 1, 1, 1], {from: requestCreator})             // Extra array length == 4 -> No pricing rule is specified -> Instant rent not supported
        tx = await contract.submitOffer(requestID, {from: offerCreator})
        offerID = tx.logs[1].args.offerID.toNumber()
        contractBalanceBeforeOffer = parseInt(await web3.eth.getBalance(contract.address))
        try {
            tx = await contract.submitOfferArrayExtra(offerID, [1, 1, 1, 1], {from: offerCreator, value: "1"})           // Offer type == 1 -> instant rent offer
        } catch (e) {
            assert.equal(e.reason, "103", "Offer extra submission for instant rent should fail becase request only accepts auction requests.")
            contractBalanceAfterOffer = parseInt(await web3.eth.getBalance(contract.address))
            assert.equal(contractBalanceBeforeOffer, contractBalanceAfterOffer, "Account balance for marketplace should be the same as before the failed offer.")
        }

        // Instant rent prices tests

        let requestInstantRentRules = [
            [1, 50],
            [5, 50],
            [1, 50, 5, 40],
            [1, 50, 5, 40, 10, 40],
            [1, 50, 5, 40, 10, 30]
        ]

        let offerOfferedPrices = [
            [
                [[1, 49], [1, 50], [2, 50], [2, 49]],
                [102, 0, 0, 102]
            ],
            [
                [[4, 49], [4, 50], [5, 50], [5, 49]],
                [102, 0, 0, 102]
            ],
            [
                [[1, 49], [1, 50], [4, 50], [4, 49], [5, 40], [5, 39], [6, 40], [6, 39]],
                [102, 0, 0, 102, 0, 102, 0, 102]
            ],
            [
                [[9, 40], [9, 39], [10, 40], [10, 39], [11, 40], [11, 39]],
                [0, 102, 0, 102, 0, 102]
            ],
            [
                [[9, 40], [9, 39], [10, 30], [10, 29], [11, 30], [11, 29]],
                [0, 102, 0, 102, 0, 102]
            ]
        ]

        for (let i = 0; i < offerOfferedPrices.length; i++) {
            let requestInstantRules = requestInstantRentRules[i]
            let offerDetails = offerOfferedPrices[i][0]
            let expectedStatusCodes = offerOfferedPrices[i][1]

            for (let j = 0; j < offerDetails.length; j++) {
                let offerDuration = offerDetails[i][0]
                let offerPrice = offerDetails[i][1]
                let expectedStatusCode = expectedStatusCodes[i]

                requestCreationAccessToken = await generateFunctionSignedTokenWithAccount(SMAUGMarketplaceABI, submitAuthorisedRequestMethodName, requestCreator, contract.address, web3, owner)
                tx = await contract.submitAuthorisedRequest(requestCreationAccessToken.tokenDigest, requestCreationAccessToken.signature, requestCreationAccessToken.nonce, 2000000000, {from: requestCreator})
                requestID = tx.logs[1].args.requestID.toNumber()
                await contract.submitRequestArrayExtra(requestID, [1, 100, 1].concat(requestInstantRules).concat(1), {from: requestCreator})
                tx = await contract.submitOffer(requestID, {from: offerCreator})
                offerID = tx.logs[1].args.offerID.toNumber()
                contractBalanceBeforeOffer = parseInt(await web3.eth.getBalance(contract.address))
                try {
                    tx = await contract.submitOfferArrayExtra(offerID, [1, offerDuration, 1, 1], {from: offerCreator, value: `${offerPrice}`})      // OfferType = 1 -> Instant rent offer
                    txStatusCode = tx.logs[0].args.status.toNumber()
                    assert.equal(txStatusCode, expectedStatusCode, "Offer extra submission returned a wrong status code.")
                } catch (e) {
                    assert.equal(e.reason, "104", "Offer extra submission should fail because the money offerred does not meet the request minimum requirements.")
                    contractBalanceAfterOffer = parseInt(await web3.eth.getBalance(contract.address))
                    assert.equal(contractBalanceBeforeOffer, contractBalanceAfterOffer, "Account balance for marketplace should be the same as before the failed offer.")
                }
            }
        }
    })

    it("interledgerReceive()", async () => {
        let owner = accounts[0]
        let requestCreator = accounts[1]
        let offerCreator = accounts[2]
        let offerCreator2 = accounts[3]
        let offerCreator3 = accounts[4]
        let contract = await SMAUGMarketPlace.new({from: owner})

        // Valid flow

        let requestCreationAccessToken = await generateFunctionSignedTokenWithAccount(SMAUGMarketplaceABI, submitAuthorisedRequestMethodName, requestCreator, contract.address, web3, owner)
        let tx = await contract.submitAuthorisedRequest(requestCreationAccessToken.tokenDigest, requestCreationAccessToken.signature, requestCreationAccessToken.nonce, 1000000000000, {from: requestCreator})
        let requestID = tx.logs[1].args.requestID.toNumber()
        await contract.submitRequestArrayExtra(requestID, [1, 1, 1, 1], {from: requestCreator})
        tx = await contract.submitOffer(requestID, {from: offerCreator})
        let offerID1 = tx.logs[1].args.offerID.toNumber()
        let offerDID1 = 1
        let offer1Value = 1
        tx = await contract.submitOfferArrayExtra(offerID1, [1, 1, 0, offerDID1], {from: offerCreator, value: `${offer1Value}`})
        tx = await contract.submitOffer(requestID, {from: offerCreator2})
        let offerID2 = tx.logs[1].args.offerID.toNumber()
        let offerDID2 = 2
        let offer2Value = 10
        tx = await contract.submitOfferArrayExtra(offerID2, [1, 1, 0, offerDID2], {from: offerCreator2, value: `${offer2Value}`})
        tx = await contract.submitOffer(requestID, {from: offerCreator3})
        let offerID3 = tx.logs[1].args.offerID.toNumber()
        let offerDID3 = 3
        let offer3Value = 5
        tx = await contract.submitOfferArrayExtra(offerID3, [1, 1, 0, offerDID3], {from: offerCreator3, value: `${offer3Value}`})
        await contract.decideRequest(requestID, [offerID1, offerID2], {from: requestCreator})
        let givenNonce = 1
        let offer1Token = "offer1"
        let offer2Token = "offer2"
        let encodedOfferID1 = web3.eth.abi.encodeParameter("uint256", offerID1).substr(2)
        let encodedOfferID1Length = web3.eth.abi.encodeParameter("uint256", encodedOfferID1.length/2).substr(2)
        let encodedOfferID2 = web3.eth.abi.encodeParameter("uint256", offerID2).substr(2)
        let encodedOfferID2Length = web3.eth.abi.encodeParameter("uint256", encodedOfferID2.length/2).substr(2)
        let encodedOfferToken1 = web3.eth.abi.encodeParameter("string", offer1Token).substr(2)
        let encodedOfferToken1Length = web3.eth.abi.encodeParameter("uint256", encodedOfferToken1.length/2).substr(2)
        let encodedOfferToken2 = web3.eth.abi.encodeParameter("string", offer2Token).substr(2)
        let encodedOfferToken2Length = web3.eth.abi.encodeParameter("uint256", encodedOfferToken2.length/2).substr(2)
        let interledgerPayloadMetadataOffer1 = `${encodedOfferID1Length}${encodedOfferID1}${encodedOfferToken1Length}${encodedOfferToken1}`
        let interledgerPayloadMetadataOffer2 = `${encodedOfferID2Length}${encodedOfferID2}${encodedOfferToken2Length}${encodedOfferToken2}`
        let interledgerPayloadMetadata = "0x" + interledgerPayloadMetadataOffer1 + interledgerPayloadMetadataOffer2
        tx = await contract.interledgerReceive(givenNonce, interledgerPayloadMetadata, {from: owner})
        let eventGeneratedNonce = tx.logs[0].args.nonce
        assert.equal(givenNonce, eventGeneratedNonce, "Nonce given in interledgerReceive() should be = to the one in the event generated.")
        let eventOffer1FulfilledDetails = tx.logs[1]
        assert.equal(parseInt(eventOffer1FulfilledDetails.args.offerID), offerID1, "Offer ID specified in the event does not match the expected one.")
        assert.equal(web3.eth.abi.decodeParameter("string", eventOffer1FulfilledDetails.args.token), offer1Token, "Offer access token specified in the event does not match the expected one.")
        let eventOffer2FulfilledDetails = tx.logs[2]
        assert.equal(parseInt(eventOffer2FulfilledDetails.args.offerID), offerID2, "Offer ID specified in the event does not match the expected one.")
        assert.equal(web3.eth.abi.decodeParameter("string", eventOffer2FulfilledDetails.args.token), offer2Token, "Offer access token specified in the event does not match the expected one.")
        let eventOffer3ClaimableDetails = tx.logs[3]
        assert.equal(parseInt(eventOffer3ClaimableDetails.args.offerID), offerID3, "Offer ID specified in the event does not match the expected one.")
        let eventRequestClaimableDetails = tx.logs[4]
        assert.equal(parseInt(eventRequestClaimableDetails.args.requestID), requestID, "Request ID specified in the event does not match the expected one.")
        let winningOfferIDs = eventRequestClaimableDetails.args.offerIDs.map(offerID => parseInt(offerID))
        assert.isTrue(winningOfferIDs.length == 2 && winningOfferIDs[0] == offerID1 && winningOfferIDs[1] == offerID2, "Winning offer IDs specified in the event does not match the expected one.")

        // IL function called by someone that is not a manager

        const unauthorisedAddress = accounts[5]

        requestCreationAccessToken = await generateFunctionSignedTokenWithAccount(SMAUGMarketplaceABI, submitAuthorisedRequestMethodName, requestCreator, contract.address, web3, owner)
        tx = await contract.submitAuthorisedRequest(requestCreationAccessToken.tokenDigest, requestCreationAccessToken.signature, requestCreationAccessToken.nonce, 1000000000000, {from: requestCreator})
        requestID = tx.logs[1].args.requestID.toNumber()
        await contract.submitRequestArrayExtra(requestID, [1, 1, 1, 1], {from: requestCreator})
        tx = await contract.submitOffer(requestID, {from: offerCreator})
        let offerID = tx.logs[1].args.offerID.toNumber()
        tx = await contract.submitOfferArrayExtra(offerID, [1, 1, 0, 1], {from: offerCreator, value: "1"})
        await contract.decideRequest(requestID, [offerID], {from: requestCreator})
        givenNonce = 1
        let offerToken = "offer"
        let encodedOfferID = web3.eth.abi.encodeParameter("uint256", offerID).substr(2)
        let encodedOfferIDLength = web3.eth.abi.encodeParameter("uint256", encodedOfferID.length/2).substr(2)
        let encodedOfferToken = web3.eth.abi.encodeParameter("string", offerToken).substr(2)
        let encodedOfferTokenLength = web3.eth.abi.encodeParameter("uint256", encodedOfferToken.length/2).substr(2)        
        interledgerPayloadMetadata = "0x" + `${encodedOfferIDLength}${encodedOfferID}${encodedOfferTokenLength}${encodedOfferToken}`
        tx = await contract.interledgerReceive(givenNonce, interledgerPayloadMetadata, {from: unauthorisedAddress})
        let generatedEventType = tx.logs[1].event
        eventGeneratedNonce = tx.logs[1].args.nonce
        assert.equal(generatedEventType, "InterledgerEventRejected", "interledgerReceive() should fail because caller unauthorised.")
        assert.equal(givenNonce, eventGeneratedNonce, "Nonce given in interledgerReceive() should be = to the one in the event generated.")        

        // Empty payload

        requestCreationAccessToken = await generateFunctionSignedTokenWithAccount(SMAUGMarketplaceABI, submitAuthorisedRequestMethodName, requestCreator, contract.address, web3, owner)
        tx = await contract.submitAuthorisedRequest(requestCreationAccessToken.tokenDigest, requestCreationAccessToken.signature, requestCreationAccessToken.nonce, 1000000000000, {from: requestCreator})
        requestID = tx.logs[1].args.requestID.toNumber()
        await contract.submitRequestArrayExtra(requestID, [1, 1, 1, 1], {from: requestCreator})
        tx = await contract.submitOffer(requestID, {from: offerCreator})
        offerID = tx.logs[1].args.offerID.toNumber()
        tx = await contract.submitOfferArrayExtra(offerID, [1, 1, 0, 1], {from: offerCreator, value: "1"})
        await contract.decideRequest(requestID, [offerID], {from: requestCreator})
        givenNonce = 1
        tx = await contract.interledgerReceive(givenNonce, web3.utils.bytesToHex([]), {from: owner})
        generatedEventType = tx.logs[1].event
        eventGeneratedNonce = tx.logs[1].args.nonce
        assert.equal(generatedEventType, "InterledgerEventRejected", "interledgerReceive() should fail because interledger payload is empty.")
        assert.equal(givenNonce, eventGeneratedNonce, "Nonce given in interledgerReceive() should be = to the one in the event generated.")        

        // Offer not defined

        requestCreationAccessToken = await generateFunctionSignedTokenWithAccount(SMAUGMarketplaceABI, submitAuthorisedRequestMethodName, requestCreator, contract.address, web3, owner)
        tx = await contract.submitAuthorisedRequest(requestCreationAccessToken.tokenDigest, requestCreationAccessToken.signature, requestCreationAccessToken.nonce, 1000000000000, {from: requestCreator})
        requestID = tx.logs[1].args.requestID.toNumber()
        await contract.submitRequestArrayExtra(requestID, [1, 1, 1, 1], {from: requestCreator})
        tx = await contract.submitOffer(requestID, {from: offerCreator})
        offerID = tx.logs[1].args.offerID.toNumber()
        tx = await contract.submitOfferArrayExtra(offerID, [1, 1, 0, 1], {from: offerCreator, value: "1"})
        await contract.decideRequest(requestID, [offerID], {from: requestCreator})
        givenNonce = 1
        offerToken = "offer"
        encodedOfferID = web3.eth.abi.encodeParameter("uint256", 9999).substr(2)
        encodedOfferIDLength = web3.eth.abi.encodeParameter("uint256", encodedOfferID.length/2).substr(2)
        encodedOfferToken = web3.eth.abi.encodeParameter("string", offerToken).substr(2)
        encodedOfferTokenLength = web3.eth.abi.encodeParameter("uint256", encodedOfferToken.length/2).substr(2)        
        interledgerPayloadMetadata = "0x" + `${encodedOfferIDLength}${encodedOfferID}${encodedOfferTokenLength}${encodedOfferToken}`
        tx = await contract.interledgerReceive(givenNonce, interledgerPayloadMetadata, {from: owner})
        generatedEventType = tx.logs[1].event
        eventGeneratedNonce = tx.logs[1].args.nonce
        assert.equal(generatedEventType, "InterledgerEventRejected", "interledgerReceive() should fail because offer specified is not defined.")
        assert.equal(givenNonce, eventGeneratedNonce, "Nonce given in interledgerReceive() should be = to the one in the event generated.")

        // Two offers for two different requests
        
        requestCreationAccessToken = await generateFunctionSignedTokenWithAccount(SMAUGMarketplaceABI, submitAuthorisedRequestMethodName, requestCreator, contract.address, web3, owner)
        tx = await contract.submitAuthorisedRequest(requestCreationAccessToken.tokenDigest, requestCreationAccessToken.signature, requestCreationAccessToken.nonce, 1000000000000, {from: requestCreator})
        requestID = tx.logs[1].args.requestID.toNumber()
        await contract.submitRequestArrayExtra(requestID, [1, 1, 1, 1], {from: requestCreator})
        tx = await contract.submitOffer(requestID, {from: offerCreator})
        offerID1 = tx.logs[1].args.offerID.toNumber()
        tx = await contract.submitOfferArrayExtra(offerID1, [1, 1, 0, 1], {from: offerCreator, value: "1"})
        await contract.decideRequest(requestID, [offerID1], {from: requestCreator})
        requestCreationAccessToken = await generateFunctionSignedTokenWithAccount(SMAUGMarketplaceABI, submitAuthorisedRequestMethodName, requestCreator, contract.address, web3, owner)
        tx = await contract.submitAuthorisedRequest(requestCreationAccessToken.tokenDigest, requestCreationAccessToken.signature, requestCreationAccessToken.nonce, 1000000000000, {from: requestCreator})
        requestID = tx.logs[1].args.requestID.toNumber()
        await contract.submitRequestArrayExtra(requestID, [1, 1, 1, 1], {from: requestCreator})
        tx = await contract.submitOffer(requestID, {from: offerCreator})
        offerID2 = tx.logs[1].args.offerID.toNumber()
        tx = await contract.submitOfferArrayExtra(offerID2, [1, 1, 0, 1], {from: offerCreator, value: "1"})
        await contract.decideRequest(requestID, [offerID2], {from: requestCreator})
        givenNonce = 1
        offer1Token = "offer1"
        offer2Token = "offer2"
        encodedOfferID1 = web3.eth.abi.encodeParameter("uint256", offerID1).substr(2)
        encodedOfferID1Length = web3.eth.abi.encodeParameter("uint256", encodedOfferID1.length/2).substr(2)
        encodedOfferID2 = web3.eth.abi.encodeParameter("uint256", offerID2).substr(2)
        encodedOfferID2Length = web3.eth.abi.encodeParameter("uint256", encodedOfferID2.length/2).substr(2)
        encodedOfferToken1 = web3.eth.abi.encodeParameter("string", offer1Token).substr(2)
        encodedOfferToken1Length = web3.eth.abi.encodeParameter("uint256", encodedOfferToken1.length/2).substr(2)
        encodedOfferToken2 = web3.eth.abi.encodeParameter("string", offer2Token).substr(2)
        encodedOfferToken2Length = web3.eth.abi.encodeParameter("uint256", encodedOfferToken2.length/2).substr(2)
        interledgerPayloadMetadataOffer1 = `${encodedOfferID1Length}${encodedOfferID1}${encodedOfferToken1Length}${encodedOfferToken1}`
        interledgerPayloadMetadataOffer2 = `${encodedOfferID2Length}${encodedOfferID2}${encodedOfferToken2Length}${encodedOfferToken2}`
        interledgerPayloadMetadata = "0x" + interledgerPayloadMetadataOffer1 + interledgerPayloadMetadataOffer2
        tx = await contract.interledgerReceive(givenNonce, interledgerPayloadMetadata, {from: owner})
        generatedEventType = tx.logs[1].event
        eventGeneratedNonce = tx.logs[1].args.nonce
        assert.equal(generatedEventType, "InterledgerEventRejected", "interledgerReceive() should fail because offers belong to two different requests.")
        assert.equal(givenNonce, eventGeneratedNonce, "Nonce given in interledgerReceive() should be = to the one in the event generated.")        

        // Request not decided

        requestCreationAccessToken = await generateFunctionSignedTokenWithAccount(SMAUGMarketplaceABI, submitAuthorisedRequestMethodName, requestCreator, contract.address, web3, owner)
        tx = await contract.submitAuthorisedRequest(requestCreationAccessToken.tokenDigest, requestCreationAccessToken.signature, requestCreationAccessToken.nonce, 1000000000000, {from: requestCreator})
        requestID = tx.logs[1].args.requestID.toNumber()
        await contract.submitRequestArrayExtra(requestID, [1, 1, 1, 1], {from: requestCreator})
        tx = await contract.submitOffer(requestID, {from: offerCreator})
        offerID = tx.logs[1].args.offerID.toNumber()
        tx = await contract.submitOfferArrayExtra(offerID, [1, 1, 0, 1], {from: offerCreator, value: "1"})
        givenNonce = 1
        encodedOfferID = web3.eth.abi.encodeParameter("uint256", offerID).substr(2)
        encodedOfferIDLength = web3.eth.abi.encodeParameter("uint256", encodedOfferID.length/2).substr(2)
        encodedOfferToken = web3.eth.abi.encodeParameter("string", offerToken).substr(2)
        encodedOfferTokenLength = web3.eth.abi.encodeParameter("uint256", encodedOfferToken.length/2).substr(2)        
        interledgerPayloadMetadata = "0x" + `${encodedOfferIDLength}${encodedOfferID}${encodedOfferTokenLength}${encodedOfferToken}`
        tx = await contract.interledgerReceive(givenNonce, interledgerPayloadMetadata, {from: owner})        
        generatedEventType = tx.logs[1].event
        eventGeneratedNonce = tx.logs[1].args.nonce
        assert.equal(generatedEventType, "InterledgerEventRejected", "interledgerReceive() should fail because offer specified is not defined.")
        assert.equal(givenNonce, eventGeneratedNonce, "Nonce given in interledgerReceive() should be = to the one in the event generated.")
    })

    it("withdraw()", async  () => {
        let owner = accounts[0]
        let requestCreator = accounts[1]
        let offerCreator1 = accounts[2]
        let offerCreator2 = accounts[3]
        let offerCreator3 = accounts[4]
        let contract = await SMAUGMarketPlace.new({from: owner})

        // Valid flow

        let requestCreationAccessToken = await generateFunctionSignedTokenWithAccount(SMAUGMarketplaceABI, submitAuthorisedRequestMethodName, requestCreator, contract.address, web3, owner)
        let tx = await contract.submitAuthorisedRequest(requestCreationAccessToken.tokenDigest, requestCreationAccessToken.signature, requestCreationAccessToken.nonce, 1000000000000, {from: requestCreator})
        let requestID = tx.logs[1].args.requestID.toNumber()
        await contract.submitRequestArrayExtra(requestID, [1, 1, 1, 1], {from: requestCreator})
        tx = await contract.submitOffer(requestID, {from: offerCreator1})
        let offerID1 = tx.logs[1].args.offerID.toNumber()
        let offerAmount1 = 10
        let contractAccountBeforeOffer1 = parseInt(await web3.eth.getBalance(contract.address))
        await contract.submitOfferArrayExtra(offerID1, [1, 1, 0, 1], {from: offerCreator1, value: `${offerAmount1}`})
        tx = await contract.submitOffer(requestID, {from: offerCreator2})
        let offerID2 = tx.logs[1].args.offerID.toNumber()
        let offerAmount2 = 15
        await contract.submitOfferArrayExtra(offerID2, [1, 1, 0, 1], {from: offerCreator2, value: `${offerAmount2}`})
        tx = await contract.submitOffer(requestID, {from: offerCreator3})
        let offerID3 = tx.logs[1].args.offerID.toNumber()
        let offerAmount3 = 3
        await contract.submitOfferArrayExtra(offerID3, [1, 1, 0, 1], {from: offerCreator3, value: `${offerAmount3}`})
        let contractAccountAfterOffer3 = parseInt(await web3.eth.getBalance(contract.address))
        assert.equal(contractAccountBeforeOffer1+offerAmount1+offerAmount2+offerAmount3, contractAccountAfterOffer3, "Balance of the contract should be the sum of the three offers presented.")

        let winningOffers = [offerID1, offerID2]
        let winningAmounts = [offerAmount1, offerAmount2]
        await contract.decideRequest(requestID, winningOffers, {from: requestCreator})

        let givenNonce = 1
        let completeInterledgerPayload = "0x"
        for (let i = 0; i < winningOffers.length; i++) {
            let winningOffer = winningOffers[i]
            let winningAmount = winningAmounts[i]

            let encodedOfferID = web3.eth.abi.encodeParameter("uint256", winningOffer).substr(2)
            let encodedOfferIDLength = web3.eth.abi.encodeParameter("uint256", encodedOfferID.length/2).substr(2)
            let encodedOfferToken = web3.eth.abi.encodeParameter("string", `token-${winningOffer}`).substr(2)
            let encodedOfferTokenLength = web3.eth.abi.encodeParameter("uint256", encodedOfferToken.length/2).substr(2)        
            completeInterledgerPayload += `${encodedOfferIDLength}${encodedOfferID}${encodedOfferTokenLength}${encodedOfferToken}`
        }

        await contract.interledgerReceive(givenNonce, completeInterledgerPayload, {from: owner})
        for (let i = 0; i < winningOffers.length; i++) {
            let contractBalanceBeforeWithdrawal = parseInt(await web3.eth.getBalance(contract.address))
            await contract.withdraw(winningOffers[i], {from: requestCreator})
            let contractBalanceAfterWithdrawal = parseInt(await web3.eth.getBalance(contract.address))
            assert.equal(contractBalanceBeforeWithdrawal, winningAmounts[i]+contractBalanceAfterWithdrawal, "Balance of the contract is not consistent with the cash paid out to the request creator.")
        }

        let contractBalanceBeforeWithdrawal = parseInt(await web3.eth.getBalance(contract.address))
        await contract.withdraw(offerID3, {from: offerCreator3})
        let contractBalanceAfterWithdrawal = parseInt(await web3.eth.getBalance(contract.address))
        assert.equal(contractBalanceBeforeWithdrawal, offerAmount3+contractBalanceAfterWithdrawal, "Balance of the contract is not consistent with the cash paid out to the loser offer creator.")

        // Claiming the same payment twice must fail, obviously

        contractBalanceBeforeWithdrawal = parseInt(await web3.eth.getBalance(contract.address))
        tx = await contract.withdraw(offerID3, {from: offerCreator3})
        contractBalanceAfterWithdrawal = parseInt(await web3.eth.getBalance(contract.address))
        let txStatusCode = parseInt(tx.logs[0].args.status)
        assert.equal(txStatusCode, 105, "Payment cash out should fail since same money cannot be claimed twice (aka payment does not exist anymore).")
        assert.equal(contractBalanceBeforeWithdrawal, contractBalanceAfterWithdrawal, "Payment cash out should fail since same money cannot be claimed twice.")

        // Payment not existing (no offerID found)

        contractBalanceBeforeWithdrawal = parseInt(await web3.eth.getBalance(contract.address))
        tx = await contract.withdraw(999, {from: requestCreator})
        txStatusCode = tx.logs[0].args.status.toNumber()
        assert.equal(txStatusCode, 105, "Withdrawal should fail because it refers to an offer that does not exist.")
        contractBalanceAfterWithdrawal = parseInt(await web3.eth.getBalance(contract.address))
        assert.equal(contractBalanceBeforeWithdrawal, contractBalanceAfterWithdrawal, "Account balance for marketplace should be the same as before the failed withdrawal.")

        // Payment pending (no officially closed)

        let offerCreator = accounts[9]
        requestCreationAccessToken = await generateFunctionSignedTokenWithAccount(SMAUGMarketplaceABI, submitAuthorisedRequestMethodName, requestCreator, contract.address, web3, owner)
        tx = await contract.submitAuthorisedRequest(requestCreationAccessToken.tokenDigest, requestCreationAccessToken.signature, requestCreationAccessToken.nonce, 1000000000000, {from: requestCreator})
        requestID = tx.logs[1].args.requestID.toNumber()
        await contract.submitRequestArrayExtra(requestID, [1, 1, 1, 1], {from: requestCreator})
        tx = await contract.submitOffer(requestID, {from: offerCreator})
        let offerID = tx.logs[1].args.offerID.toNumber()
        let offerAmount = 10
        await contract.submitOfferArrayExtra(offerID, [1, 1, 0, 1], {from: offerCreator, value: `${offerAmount}`})
        await contract.decideRequest(requestID, [offerID], {from: requestCreator})

        contractBalanceBeforeWithdrawal = parseInt(await web3.eth.getBalance(contract.address))
        tx = await contract.withdraw(offerID, {from: requestCreator})
        txStatusCode = tx.logs[0].args.status.toNumber()
        assert.equal(txStatusCode, 106, "Withdrawal should fail because it refers to an offer that has not been resolved yet.")
        contractBalanceAfterWithdrawal = parseInt(await web3.eth.getBalance(contract.address))
        assert.equal(contractBalanceBeforeWithdrawal, contractBalanceAfterWithdrawal, "Account balance for marketplace should be the same as before the failed withdrawal.")

        // Payment for a winning offer claimed by a person different than the request creator

        let unauthorisedUser = accounts[5]
        offerCreator = accounts[9]
        requestCreationAccessToken = await generateFunctionSignedTokenWithAccount(SMAUGMarketplaceABI, submitAuthorisedRequestMethodName, requestCreator, contract.address, web3, owner)
        tx = await contract.submitAuthorisedRequest(requestCreationAccessToken.tokenDigest, requestCreationAccessToken.signature, requestCreationAccessToken.nonce, 1000000000000, {from: requestCreator})
        requestID = tx.logs[1].args.requestID.toNumber()
        await contract.submitRequestArrayExtra(requestID, [1, 1, 1, 1], {from: requestCreator})
        tx = await contract.submitOffer(requestID, {from: offerCreator})
        offerID = tx.logs[1].args.offerID.toNumber()
        offerAmount = 10
        await contract.submitOfferArrayExtra(offerID, [1, 1, 0, 1], {from: offerCreator, value: `${offerAmount}`})
        await contract.decideRequest(requestID, [offerID], {from: requestCreator})
        let encodedOfferID = web3.eth.abi.encodeParameter("uint256", offerID).substr(2)
        let encodedOfferIDLength = web3.eth.abi.encodeParameter("uint256", encodedOfferID.length/2).substr(2)
        let encodedOfferToken = web3.eth.abi.encodeParameter("string", `token-${offerID}`).substr(2)
        let encodedOfferTokenLength = web3.eth.abi.encodeParameter("uint256", encodedOfferToken.length/2).substr(2)        
        completeInterledgerPayload = `0x${encodedOfferIDLength}${encodedOfferID}${encodedOfferTokenLength}${encodedOfferToken}`
        await contract.interledgerReceive("123", completeInterledgerPayload, {from: owner})

        contractBalanceBeforeWithdrawal = parseInt(await web3.eth.getBalance(contract.address))
        tx = await contract.withdraw(offerID, {from: unauthorisedUser})
        txStatusCode = tx.logs[0].args.status.toNumber()
        assert.equal(txStatusCode, 1, "Withdrawal should fail because the requester is not the request creator.")
        contractBalanceAfterWithdrawal = parseInt(await web3.eth.getBalance(contract.address))
        assert.equal(contractBalanceBeforeWithdrawal, contractBalanceAfterWithdrawal, "Account balance for marketplace should be the same as before the failed withdrawal.")

        // Payment for a losing offer claimed by a person different than the offer creator

        unauthorisedUser = accounts[5]
        offerCreator = accounts[9]
        offerCreator2 = accounts[7]
        requestCreationAccessToken = await generateFunctionSignedTokenWithAccount(SMAUGMarketplaceABI, submitAuthorisedRequestMethodName, requestCreator, contract.address, web3, owner)
        tx = await contract.submitAuthorisedRequest(requestCreationAccessToken.tokenDigest, requestCreationAccessToken.signature, requestCreationAccessToken.nonce, 1000000000000, {from: requestCreator})
        requestID = tx.logs[1].args.requestID.toNumber()
        await contract.submitRequestArrayExtra(requestID, [1, 1, 1, 1], {from: requestCreator})
        tx = await contract.submitOffer(requestID, {from: offerCreator})
        offerID = tx.logs[1].args.offerID.toNumber()
        offerAmount = 10
        await contract.submitOfferArrayExtra(offerID, [1, 1, 0, 1], {from: offerCreator, value: `${offerAmount}`})
        tx = await contract.submitOffer(requestID, {from: offerCreator2})
        offerID2 = tx.logs[1].args.offerID.toNumber()
        offerAmount2 = 10
        await contract.submitOfferArrayExtra(offerID2, [1, 1, 0, 1], {from: offerCreator2, value: `${offerAmount2}`})        
        await contract.decideRequest(requestID, [offerID], {from: requestCreator})
        encodedOfferID = web3.eth.abi.encodeParameter("uint256", offerID).substr(2)
        encodedOfferIDLength = web3.eth.abi.encodeParameter("uint256", encodedOfferID.length/2).substr(2)
        encodedOfferToken = web3.eth.abi.encodeParameter("string", `token-${offerID}`).substr(2)
        encodedOfferTokenLength = web3.eth.abi.encodeParameter("uint256", encodedOfferToken.length/2).substr(2)        
        completeInterledgerPayload = `0x${encodedOfferIDLength}${encodedOfferID}${encodedOfferTokenLength}${encodedOfferToken}`
        await contract.interledgerReceive("123", completeInterledgerPayload, {from: owner})

        contractBalanceBeforeWithdrawal = parseInt(await web3.eth.getBalance(contract.address))
        tx = await contract.withdraw(offerID2, {from: offerCreator})
        txStatusCode = tx.logs[0].args.status.toNumber()
        assert.equal(txStatusCode, 1, "Withdrawal should fail because the requester is not the offer creator.")
        contractBalanceAfterWithdrawal = parseInt(await web3.eth.getBalance(contract.address))
        assert.equal(contractBalanceBeforeWithdrawal, contractBalanceAfterWithdrawal, "Account balance for marketplace should be the same as before the failed withdrawal.")    
    })
})