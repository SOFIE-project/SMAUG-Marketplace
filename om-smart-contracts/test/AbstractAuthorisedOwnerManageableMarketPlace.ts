import { AbiItem } from "web3-utils"
import { generateFunctionSignedTokenWithAccount } from "./utils"
import * as path from "path"
import * as fs from "fs"

contract("AbstractAuthorisedOwnerManageableMarketPlace", async accounts => {

    const SMAUGMarketPlace = artifacts.require("SMAUGMarketPlace")
    const SMAUGMarketPlaceABIFile = JSON.parse(fs.readFileSync(path.resolve(__dirname, "..", "build", "contracts", "SMAUGMarketPlace.json")).toString())
    const SMAUGMarketplaceABI = SMAUGMarketPlaceABIFile.abi as AbiItem[]
    const submitAuthorisedRequestMethodName = "submitAuthorisedRequest"

    it("getMarketInformation", async () => {
        let owner = accounts[0]
        let contract = await SMAUGMarketPlace.new({from: owner})

        let ownerAddress = (await contract.getMarketInformation()).ownerAddress as string
        assert.equal(ownerAddress, ownerAddress, "Wrong marketplace info returned.")
    })
    
    it("resetAccessTokens", async () => {

        let owner = accounts[0]
        let requestCreator = accounts[1]
        let contract = await SMAUGMarketPlace.new({from: owner})

        // Trying to call the method from someone different than the managers

        let tx = await contract.resetAccessTokens({from: requestCreator})
        let txStatusCode = tx.logs[0].args.status.toNumber()
        assert.equal(txStatusCode, 1, "Operation should fail becase token is not signed by a smart contract manager.")

        // Valid token generation and usage

        let requestCreationAccessToken = await generateFunctionSignedTokenWithAccount(SMAUGMarketplaceABI, submitAuthorisedRequestMethodName, requestCreator, contract.address, web3, owner)
        tx = await contract.submitAuthorisedRequest(requestCreationAccessToken.tokenDigest, requestCreationAccessToken.signature, requestCreationAccessToken.nonce, 10, {from: requestCreator})
        txStatusCode = tx.logs[0].args.status.toNumber()
        assert.equal(txStatusCode, 0, "Request submission should succeed.")
        
        // Trying again with same token

        tx = await contract.submitAuthorisedRequest(requestCreationAccessToken.tokenDigest, requestCreationAccessToken.signature, requestCreationAccessToken.nonce, 10, {from: requestCreator})
        txStatusCode = tx.logs[0].args.status.toNumber()
        assert.equal(txStatusCode, 101, "Request submission should fail because access token is re-used.")

        // Cleaning tokens

        tx = await contract.resetAccessTokens()
        txStatusCode = tx.logs[0].args.status.toNumber()
        assert.equal(txStatusCode, 0, "Token storage cleaning should succeed.")

        // Re-trying with the previously used (and then cleaned) token

        tx = await contract.submitAuthorisedRequest(requestCreationAccessToken.tokenDigest, requestCreationAccessToken.signature, requestCreationAccessToken.nonce, 10, {from: requestCreator})
        txStatusCode = tx.logs[0].args.status.toNumber()
        assert.equal(txStatusCode, 0, "Request submission should succeed because token storage has been cleaned.")
    })

    it("submitAuthorisedRequest & isRequestDefined (AbstractMarketPlace) & getRequest (AbstractMarketPlace)", async () => {
        let owner = accounts[0]
        let requestCreator = accounts[1]
        let contract = await SMAUGMarketPlace.new({from: owner})
        let givenRequestDeadline = 10
    
        // Valid request creation (with valid access token)

        let requestCreationAccessToken = await generateFunctionSignedTokenWithAccount(SMAUGMarketplaceABI, submitAuthorisedRequestMethodName, requestCreator, contract.address, web3, owner)
        let tx = await contract.submitAuthorisedRequest(requestCreationAccessToken.tokenDigest, requestCreationAccessToken.signature, requestCreationAccessToken.nonce, givenRequestDeadline, {from: requestCreator})
        let txStatusCode = tx.logs[0].args.status.toNumber()
        let requestID = tx.logs[1].args.requestID.toNumber()
        assert.equal(txStatusCode, 0, "Request submission should succeed.")
        let isRequestDefined = (await contract.isRequestDefined(requestID))[1]
        assert.equal(isRequestDefined, true, "Request should be defined.")
        let requestDetails = await contract.getRequest(requestID)
        txStatusCode = requestDetails.status
        let requestDeadline = requestDetails.deadline
        let requestState = requestDetails.stage
        let requestMaker = requestDetails.requestMaker
        assert.equal(txStatusCode, 0, "getRequest() should succeed.")
        assert.equal(requestDeadline, givenRequestDeadline, "Wrong deadline returned.")
        assert.equal(requestState, 0, "Wrong state returned.")
        assert.equal(requestMaker, requestCreator, "Wrong creator returned.")
        
        // Trying again with same token

        tx = await contract.submitAuthorisedRequest(requestCreationAccessToken.tokenDigest, requestCreationAccessToken.signature, requestCreationAccessToken.nonce, 10, {from: requestCreator})
        txStatusCode = tx.logs[0].args.status.toNumber()
        assert.equal(txStatusCode, 101, "Request submission should fail because access token is re-used.")

        // Invalid token for a different method

        let alternativeFunctionName = "submitOffer"
        requestCreationAccessToken = await generateFunctionSignedTokenWithAccount(SMAUGMarketplaceABI, alternativeFunctionName, requestCreator, contract.address, web3, owner)
        tx = await contract.submitAuthorisedRequest(requestCreationAccessToken.tokenDigest, requestCreationAccessToken.signature, requestCreationAccessToken.nonce, 10, {from: requestCreator})
        txStatusCode = tx.logs[0].args.status.toNumber()
        assert.equal(txStatusCode, 1, "Request submission should fail because access token is issued for a different method.")

        // Invalid token for a different user

        let alternativeRequestCreatorAddress = accounts[2]
        requestCreationAccessToken = await generateFunctionSignedTokenWithAccount(SMAUGMarketplaceABI, submitAuthorisedRequestMethodName, requestCreator, contract.address, web3, owner)
        tx = await contract.submitAuthorisedRequest(requestCreationAccessToken.tokenDigest, requestCreationAccessToken.signature, requestCreationAccessToken.nonce, 10, {from: alternativeRequestCreatorAddress})
        txStatusCode = tx.logs[0].args.status.toNumber()
        assert.equal(txStatusCode, 1, "Request submission should fail because access token is issued to a different user.")

        // Invalid token for a different contract address

        let alternativeContractAddress = accounts[3]
        requestCreationAccessToken = await generateFunctionSignedTokenWithAccount(SMAUGMarketplaceABI, submitAuthorisedRequestMethodName, requestCreator, alternativeContractAddress, web3, owner)
        tx = await contract.submitAuthorisedRequest(requestCreationAccessToken.tokenDigest, requestCreationAccessToken.signature, requestCreationAccessToken.nonce, 10, {from: requestCreator})
        txStatusCode = tx.logs[0].args.status.toNumber()
        assert.equal(txStatusCode, 1, "Request submission should fail because access token is issued for a different contract address.")

        // Invalid token from a different signer than a contract manager

        let alternativeSigner = accounts[4]
        requestCreationAccessToken = await generateFunctionSignedTokenWithAccount(SMAUGMarketplaceABI, submitAuthorisedRequestMethodName, requestCreator, contract.address, web3, alternativeSigner)
        tx = await contract.submitAuthorisedRequest(requestCreationAccessToken.tokenDigest, requestCreationAccessToken.signature, requestCreationAccessToken.nonce, 10, {from: requestCreator})
        txStatusCode = tx.logs[0].args.status.toNumber()
        assert.equal(txStatusCode, 1, "Request submission should fail because access token has not been issued by a manager of the contract.")
    })

    it("settleTrade()", async () => {
        let owner = accounts[0]
        let requestCreator = accounts[1]
        let offerCreator = accounts[2]
        let contract = await SMAUGMarketPlace.new({from: owner})

        // Valid flow

        let requestCreationAccessToken = await generateFunctionSignedTokenWithAccount(SMAUGMarketplaceABI, submitAuthorisedRequestMethodName, requestCreator, contract.address, web3, owner)
        let tx = await contract.submitAuthorisedRequest(requestCreationAccessToken.tokenDigest, requestCreationAccessToken.signature, requestCreationAccessToken.nonce, 1000000000000, {from: requestCreator})
        let requestID = tx.logs[1].args.requestID.toNumber()
        await contract.submitRequestArrayExtra(requestID, [1, 1, 1, 1], {from: requestCreator})
        tx = await contract.submitOffer(requestID, {from: offerCreator})
        let offerID = tx.logs[1].args.offerID.toNumber()
        let offerDID = 1
        let offerValue = 1
        tx = await contract.submitOfferArrayExtra(offerID, [1, 1, 0, offerDID], {from: offerCreator, value: `${offerValue}`})
        await contract.decideRequest(requestID, [offerID], {from: requestCreator})

        // Assuming the Interledger event is triggered and that the JWT is properly logged and delivered to the user, the user will call the trade settlement interface

        tx = await contract.settleTrade(requestID, offerID, {from: offerCreator})
        let tradeSettledEvent = tx.logs[0]
        let eventRequestID = tradeSettledEvent.args.requestID.toNumber()
        assert.equal(eventRequestID, requestID, "requestID of trade settlment event not right.")
        let eventOfferID = tradeSettledEvent.args.offerID.toNumber()
        assert.equal(eventOfferID, offerID, "offerID of trade settlment event not right.")

        // Trade for request not existing

        tx = await contract.settleTrade(999, offerID, {from: offerCreator})
        tradeSettledEvent = tx.logs[0]
        let status = tradeSettledEvent.args.status.toNumber()
        assert.equal(status, 2, "settleTrade with not existing request should create FunctionStatus with value UndefinedID")

        // Trade for offer not existing

        tx = await contract.settleTrade(requestID, 999, {from: offerCreator})
        tradeSettledEvent = tx.logs[0]
        status = tradeSettledEvent.args.status.toNumber()
        assert.equal(status, 2, "settleTrade with not existing offer should create FunctionStatus with value UndefinedID")

        // Trade called by someone other than the offer creator

        let unauthorisedCaller = accounts[3]
        tx = await contract.settleTrade(requestID, offerID, {from: unauthorisedCaller})
        tradeSettledEvent = tx.logs[0]
        status = tradeSettledEvent.args.status.toNumber()
        assert.equal(status, 1, "settleTrade with unauthorised caller should create FunctionStatus with value AccessDenied")

        // Trade for an already settled offer

        tx = await contract.settleTrade(requestID, offerID, {from: offerCreator})
        tradeSettledEvent = tx.logs[0]
        status = tradeSettledEvent.args.status.toNumber()
        assert.equal(status, 108, "settleTrade with not existing offer should create FunctionStatus with value AlreadySettledOffer")
    })
})