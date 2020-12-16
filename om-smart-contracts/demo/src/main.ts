import Web3 from "web3"
import fs from "fs"
import BN from "bn.js"

import { SmaugMarketPlace as SMAUGMarketplace, OfferFulfilled, OfferClaimable, RequestDecided } from "../types/web3-v1-contracts/SMAUGMarketPlace"

import * as utils from "./utils"
import inquirer from "inquirer"
import { URL } from "url"
import fetch from "node-fetch"
import { EventLog } from "web3-core/types"
import jwtDecode from "jwt-decode"

import { sys } from "typescript"

const nacl = require("js-nacl")                         // Mismatch between types and actual library, so using module import fails for the functions we use in this app.

main().catch((error: Error) => {
    console.error(error.message)
    console.error(error.name)
    process.exit(1)
}).then(() => {
    console.log("Bye!")
    process.exit(0)
})

process.on('SIGINT', () => {
    console.log("Bye!");
    process.exit(0);
});

var web3MarketplaceInstance: Web3
var SMAUGMarketplaceInstance: SMAUGMarketplace
var backendURL: URL
var backendHost: string | undefined

var unseenEvents: EventLog[] = []
var unseenOfferFulfilledEvents: OfferFulfilled[] = []
var unseenOfferUnFulfilledEvents: OfferClaimable[] = []

var keys: Map<string, [Uint8Array, Uint8Array]> = new Map()     // offerID -> (secret key, public key)

let crypto: any                                     // Mismatch between types and actual library, so using module import fails for the functions we use in this app.

var debug: Boolean
var currentAccount: string

async function main(): Promise<void> {

    const variables = utils.parseAndReturnEnvVariables(process.env)

    try {
        backendURL = new URL(variables.MPBackendAddress)
    } catch(err){
        throw new Error("Marketplace URL is not a valid URL.")
    }

    web3MarketplaceInstance = new Web3(variables.ethereumMPAddress)
    SMAUGMarketplaceInstance = (new web3MarketplaceInstance.eth.Contract(JSON.parse(fs.readFileSync(variables.MPABIPath).toString()), variables.MPAddress) as any) as SMAUGMarketplace
    backendHost = variables.MPBackendHost
    currentAccount = (await web3MarketplaceInstance.eth.getAccounts())[0]       // Defaults to first account

    utils.printArgumentsDetails(variables)

    await nacl.instantiate(nacl => crypto = nacl)

    configureEventListener(false, new Set(["RequestDecided", "InterledgerEventSending", "InterledgerEventAccepted", "OfferFulfilled", "OfferClaimable", "RequestClaimable", "TradeSettled"]))
    await handleUserInput()
}

function configureEventListener(debug: boolean = false, eventNames: Set<String> = new Set()) {
    debug && console.log("Configuring event listener...")
    SMAUGMarketplaceInstance.events

    SMAUGMarketplaceInstance.events.allEvents({}, (error, event) => {
        if (debug) {
            if (error != null) {
                console.error(`${error.name}\n${error.message}`)
            } else {
                console.log(`\nEvent ${event.event} received!`)
                console.log(event)
            }
        }
        if (event.event == "OfferFulfilled") {
            const castedEvent = event as OfferFulfilled
            unseenOfferFulfilledEvents.push(castedEvent)
        } else if (event.event == "OfferClaimable") {
            const castedEvent = event as OfferClaimable
            unseenOfferUnFulfilledEvents.push(castedEvent)
        }
        if (eventNames.has(event.event)) { 
            unseenEvents.push(event)
        }
    })

    debug && console.log("Event listener configured.")
}

async function handleUserInput(): Promise<void> {
    while (true) {
        var choiceIndex = 1
        const answers = await inquirer.prompt([
            {
                type: "list",
                name: "choice", message: "What would you like to do?",
                choices: [
                    {
                        name: `${choiceIndex++}) List available Ethereum accounts and balances`,
                        value: "listAccountBalances"
                    },
                    {
                        name: `${choiceIndex++}) Change Ethereum account - Change Ethereum active account to perform marketplace operations`,
                        value: "changeAccount"
                    },
                    {
                        name: `${choiceIndex++}) Create test request and offers and trigger Interledger`,
                        value: "triggerInterledger"
                    },
                    {
                        name: `${choiceIndex++}) Create a new auction request`,
                        value: "createAuctionRequest"
                    },
                    {
                        name: `${choiceIndex++}) Create a new offer`,
                        value: "createOffer"
                    },
                    {
                        name: `${choiceIndex++}) Close an existing request`,
                        value: "closeRequest"
                    },
                    {
                        name: `${choiceIndex++}) Decide an existing request`,
                        value: "decideRequest"
                    },
                    {
                        name: `${choiceIndex++} Mark token as delivered for a winning offer`,
                        value: "settleOffer"
                    },
                    {
                        name: `${choiceIndex++} Claim money for offer fulfilled - The creator of a completed request can claim money for an offer that has been succesfully served`,
                        value: "offerFulfilledClaim"
                    },
                    {
                        name: `${choiceIndex++} Claim money for offer not fulfilled - The creator of an offer that was not selected can claim back the money escrowed for that offer`,
                        value: "offerUnfulfilledClaim"
                    },
                    {
                        name: `${choiceIndex++}) Check for new acess tokens issued since last time`,
                        value: "checkForOffersEvents"
                    },
                    {
                        name: `${choiceIndex++}) Check events emitted since last time`,
                        value: "checkForPendingEvents"
                    },
                    {
                        name: `${choiceIndex++}) Turn debug flag ON/OFF`,
                        value: "flipDebug"
                    },
                    {
                        name: `${choiceIndex++}) Exit`,
                        value: "exit"
                    }
                ]
            }
        ])

        try {
            await performAction(answers.choice)
        } catch (err) {
            console.error(err.message)
        }
    }
}

async function performAction(actionName: string): Promise<void> {
    switch (actionName) {
        case "listAccountBalances":
            await getAccountsAndBalances(web3MarketplaceInstance); break;
        case "changeAccount":
            await changeAccount(); break
        case "triggerInterledger":
            await triggerInterledger(); break;
        case "createAuctionRequest":
            await handleAuctionRequestCreation(); break;
        case "createOffer":
            await handleOfferCreation(); break;
        case "closeRequest":
            await handleRequestClosing(); break;
        case "decideRequest":
            await handleRequestDecision(); break;
        case "settleOffer":
            await handleOfferSettlment(); break;
        case "offerFulfilledClaim":
            await handleRequestCreatorClaim(); break;
        case "offerUnfulfilledClaim":
            await handleOfferCreatorClaim(); break;
        case "checkForOffersEvents":
            printNewOffersFulfilled(true); printNewOffersUnfulfilled(true); break;
        case "checkForPendingEvents":
            checkForEventsGenerated(true); break;
        case "flipDebug":
            flipDebug(); break;
        case "exit":
            sys.exit(0)
    }
}

// Returns a list of tuples where each tuple is [acount: string, balance: BN]
async function getAccountsAndBalances(web3Instance: Web3, shouldPrint: boolean=true): Promise<[string, BN][]> {
    const accounts = await web3MarketplaceInstance.eth.getAccounts()
    const balances = await Promise.all(accounts.map(async (account) => {
        const balance = await web3MarketplaceInstance.eth.getBalance(account)
        return web3Instance.utils.toBN(balance)
    }))

    if (shouldPrint) {
        const output = accounts.map((account, index) => {
            return `${account} - ${balances[index].toString()} wei`
        })
        console.log(output)
    }

    return accounts.map((acc, index) => [acc, balances[index]] as [string, BN])
}

async function changeAccount(): Promise<void> {
    const accounts = await getAccountsAndBalances(web3MarketplaceInstance, false)
    const answer = await inquirer.prompt(getChangeAccountQuestions(accounts))
    currentAccount = answer.account[0]
    debug && console.log(`Account changed to ${currentAccount}`)
}

function getChangeAccountQuestions(accounts: [string, BN][]): inquirer.QuestionCollection {
    return [
        {
            type: "list",
            name: "account",
            message: "Select Ethereum account",
            choices: accounts.map((acc, index) => {
                return { name: `${index}) ${acc[0]} - ${acc[1]} weis`, value: acc }     // i) 0x...
            })
        }
    ]
}

async function triggerInterledger(): Promise<void> {

    const availableAccounts = await web3MarketplaceInstance.eth.getAccounts()
    const testRequestCreatorAccount = availableAccounts[0]
    const testRequestDetails = await createTestRequest(SMAUGMarketplaceInstance, testRequestCreatorAccount)
    const testOffer1CreatorAccount = availableAccounts[6]
    const testOffer1Details = await createTestOffer1(SMAUGMarketplaceInstance, testRequestDetails, testOffer1CreatorAccount)
    const testOffer2CreatorAccount = availableAccounts[7]
    const testOffer2Details = await createTestOffer2(SMAUGMarketplaceInstance, testRequestDetails, testOffer2CreatorAccount)
    const testOffer3CreatorAccount = availableAccounts[8]
    const testOffer3Details = await createTestOffer3(SMAUGMarketplaceInstance, testRequestDetails, testOffer3CreatorAccount)
    
    console.log(`----- TEST REQUEST -----`)
    console.log(utils.requestToString(testRequestDetails))
    console.log(`---------------`)
    console.log(`----- TEST OFFER 1 -----`)
    console.log(utils.offerToString(testOffer1Details, (encryptionKey) => "0x" + crypto.to_hex(encryptionKey)))
    console.log(`-----`)
    console.log(utils.offerToString(testOffer2Details, (encryptionKey) => "0x" + crypto.to_hex(encryptionKey)))
    console.log(`-----`)
    console.log(utils.offerToString(testOffer3Details, (encryptionKey) => "0x" + crypto.to_hex(encryptionKey)))
    console.log(`---------------`)

    await utils.waitForEnter(`Selecting offers [${testOffer1Details.id}, ${testOffer3Details.id}]:`)

    await decideRequest(SMAUGMarketplaceInstance, testRequestDetails.id, [testOffer1Details.id, testOffer3Details.id], testRequestCreatorAccount)
    console.log("Request decided. Interledger event triggered.")
}

async function createTestRequest(marketplace: SMAUGMarketplace, creatorAccount: string): Promise<utils.RequestDetails> {
    const deadline = new Date("2021-12-31:23:59:59Z")

    const accessToken = await getNewAccessToken(creatorAccount)
    const requestID = await submitRequest(marketplace, accessToken, deadline, creatorAccount)

    const startTime = new Date("2022-01-01:00:00:00Z")
    const durationInMinutes = new BN(44640)          // 31 days * 24 hours * 60 minutes
    const minAuctionPricePerMinute = new BN(50)
    const lockerID = new BN(1)

    const requestDetails: utils.RequestDetails = { id: requestID, deadline: deadline, startTime: startTime, durationInMinutes: durationInMinutes, minAuctionPricePerMinute: minAuctionPricePerMinute, lockerID: lockerID, creatorAccount: creatorAccount }

    await submitRequestExtra(marketplace, requestDetails)

    return requestDetails
}

async function createTestOffer1(marketplace: SMAUGMarketplace, requestDetails: utils.RequestDetails, creatorAccount: string): Promise<utils.OfferDetails> {
    const offerID = await submitOffer(marketplace, requestDetails.id, creatorAccount)

    const startTime = new Date("2022-01-05:00:00:00Z")
    const durationInMinutes = new BN(21600)                    // 15 days * 24 hours * 60 minutes
    const amount = requestDetails.minAuctionPricePerMinute.mul(new BN(durationInMinutes))
    const newKeyPair = crypto.crypto_box_seed_keypair([1])
    const encryptionKey = newKeyPair.boxPk
    const decryptionKey = newKeyPair.boxSk

    const offerDetails: utils.OfferDetails = { id: offerID, startTime: startTime, durationInMinutes: durationInMinutes, type: "auction", amount: amount, encryptionKey: encryptionKey, creatorAccount: creatorAccount }

    await submitOfferExtra(marketplace, offerDetails)

    keys.set(offerID.toString(), [decryptionKey, encryptionKey])

    return offerDetails
}

async function createTestOffer2(marketplace: SMAUGMarketplace, requestDetails: utils.RequestDetails, creatorAccount: string): Promise<utils.OfferDetails> {
    const offerID = await submitOffer(marketplace, requestDetails.id, creatorAccount)

    const startTime = new Date("2022-01-10:00:00:00Z")
    const durationInMinutes = new BN(4320)                    // 3 days * 24 hours * 60 minutes
    const amount = requestDetails.minAuctionPricePerMinute.mul(new BN(durationInMinutes))
    const newKeyPair = crypto.crypto_box_seed_keypair([2])
    const encryptionKey = newKeyPair.boxPk
    const decryptionKey = newKeyPair.boxSk

    const offerDetails: utils.OfferDetails = { id: offerID, startTime: startTime, durationInMinutes: durationInMinutes, type: "auction", amount: amount, encryptionKey: encryptionKey, creatorAccount: creatorAccount }

    await submitOfferExtra(marketplace, offerDetails)

    keys.set(offerID.toString(), [decryptionKey, encryptionKey])

    return offerDetails
}

async function createTestOffer3(marketplace: SMAUGMarketplace, requestDetails: utils.RequestDetails, creatorAccount: string): Promise<utils.OfferDetails> {
    const offerID = await submitOffer(marketplace, requestDetails.id, creatorAccount)

    const startTime = new Date("2022-01-20:00:00:00Z")
    const durationInMinutes = new BN(14400)                    // 3 days * 24 hours * 60 minutes
    const amount = requestDetails.minAuctionPricePerMinute.mul(new BN(durationInMinutes))
    const newKeyPair = crypto.crypto_box_seed_keypair([2])
    const encryptionKey = newKeyPair.boxPk
    const decryptionKey = newKeyPair.boxSk

    const offerDetails: utils.OfferDetails = { id: offerID, startTime: startTime, durationInMinutes: durationInMinutes, type: "auction", amount: amount, encryptionKey: encryptionKey, creatorAccount: creatorAccount }

    await submitOfferExtra(marketplace, offerDetails)

    keys.set(offerID.toString(), [decryptionKey, encryptionKey])

    return offerDetails
}

async function handleAuctionRequestCreation(): Promise<void> {
    const input = await inquirer.prompt(getRequestCreationQuestions())
    // const input = {requestDeadline: "2020-12-31T23:59:59Z", requestStartingTime: "2021-01-01T00:00:00Z", requestEndTime: "2021-12-31T23:59:59Z", minAuctionPrice: "1", lockerID: "123"}

    console.log(`Requesting new access token from marketplace backend...`)
    const accessToken = await getNewAccessToken(currentAccount)
    console.log(accessToken)

    await utils.waitForEnter()
    
    // Create request
    const deadline = new Date(input.requestDeadline)
    const deadlineInSeconds = deadline.getTime() / 1000
    console.log(`Creating request with deadline: ${deadline.toUTCString()} (${deadlineInSeconds} s in UNIX epoch)...`)
    const requestID = await submitRequest(SMAUGMarketplaceInstance, accessToken, deadline, currentAccount)

    await utils.waitForEnter(`Request created with ID ${requestID}. Press Enter to submit the request extra: `)

    // Create request extra
    const startDate = new Date(input.requestStartingTime)
    const endDate = new Date(input.requestEndTime)
    const durationInMinutes = new BN(utils.distanceInMinutes(startDate, endDate))
    const requestDetails: utils.RequestDetails = { id: requestID, deadline: deadline, startTime: startDate, durationInMinutes: durationInMinutes, minAuctionPricePerMinute: new BN(input.minAuctionPrice), lockerID: new BN(input.lockerID), creatorAccount: currentAccount }
    await submitRequestExtra(SMAUGMarketplaceInstance, requestDetails)
    console.log("Request extra added!")
    console.log(utils.requestToString(requestDetails))

    await utils.waitForEnter("Request creation process completed! Press Enter to continue: ")
}

function getRequestCreationQuestions(): inquirer.QuestionCollection {
    return [
        {
            type: "string",
            name: "requestDeadline",
            message: "Request deadline (in UTC format)",
            validate: (input) => {
                const datetime = new Date(input).getTime()
                if (isNaN(datetime)) {
                    return "Not a valid date."
                }
                const secondsSinceEpoch = datetime / 1000                 // Operations are in seconds, not milliseconds
                if (secondsSinceEpoch < new Date().getTime() / 1000) {
                    return "Deadline must not be already past."
                }
                return true
            }
        },
        {
            type: "input",
            name: "requestStartingTime",
            message: "Request starting time (in UTC format)",
            validate: (input) => {
                const datetime = new Date(input).getTime()
                if (isNaN(datetime)) {
                    return "Not a valid date."
                }
                const secondsSinceEpoch = datetime / 1000                 // Operations are in seconds, not milliseconds
                if (secondsSinceEpoch < new Date().getTime() / 1000) {
                    return "Starting time must not be already past."
                }
                return true
            }
        },
        {
            type: "input",
            name: "requestEndTime",
            message: "Request end time (in UCT format)",
            validate: (input) => {
                const datetime = new Date(input).getTime()
                if (isNaN(datetime)) {
                    return "Not a valid date."
                }
                const secondsSinceEpoch = datetime / 1000                 // Operations are in seconds, not milliseconds
                if (secondsSinceEpoch < new Date().getTime() / 1000) {
                    return "End time must not be already past."
                }
                return true
            }            
        },
        {
            type: "input",
            name: "minAuctionPrice",
            message: "Starting price/minute value for auction",
            validate: (input) => {
                try {
                    if (Web3.utils.toBN(input) > Web3.utils.toBN(0)) {
                        return true
                    }
                    return "Value must be > 0."
                } catch {
                    return "Value is not a number."
                }
            }            
        },
        {
            type: "input",
            name: "lockerID",
            message: "Locker ID",
            validate: (input) => {
                try {
                    if (Web3.utils.toBN(input) > Web3.utils.toBN(0)) {
                        return true
                    }
                    return "Value must be > 0."
                } catch {
                    return "Value is not a number."
                }
            }            
        }
    ] as inquirer.QuestionCollection
}

async function submitRequest(marketplace: SMAUGMarketplace, token: utils.MarketplaceAccessToken, deadline: Date, creatorAccount: string): Promise<BN> {
    const newRequestTransactionResult = await marketplace.methods.submitAuthorisedRequest(token.digest, token.signature, token.nonce, deadline.getTime()/1000).send({from: creatorAccount, gas: 2000000, gasPrice: "1"})

    const txStatus = (newRequestTransactionResult.events!.FunctionStatus.returnValues.status) as number
    if (txStatus != 0) {
        throw new Error(`Request creation failed with status ${txStatus}`)
    }
    const requestID = (newRequestTransactionResult.events!.RequestAdded.returnValues.requestID) as BN

    debug && console.log(`Request submitted with ID: ${requestID}`)

    return requestID
}

async function submitRequestExtra(marketplace: SMAUGMarketplace, extra: utils.RequestDetails): Promise<void> {
    const requestExtra = [extra.startTime.getTime()/1000, extra.durationInMinutes.toString(), extra.minAuctionPricePerMinute.toString()]
    if (extra.instantRentRules) {
        requestExtra.concat(utils.encodeRulesToSolidityArray(extra.instantRentRules))
    }
    requestExtra.push(extra.lockerID.toString())
    
    debug && console.log(`Submitting request extra [${requestExtra}]...`)

    const newRequestExtraTransactionResult = await marketplace.methods.submitRequestArrayExtra(extra.id.toString(), requestExtra).send({from: extra.creatorAccount, gas: 2000000, gasPrice: "1"})

    const txStatus = (newRequestExtraTransactionResult.events!.FunctionStatus.returnValues.status) as number
    if (txStatus != 0) {
        throw new Error(`Request extra submission failed with status ${txStatus}`)
    }

    debug && console.log(`Request extra submitted for ID: ${extra.id.toString()}`)
}

async function handleOfferCreation(): Promise<void> {
    const input = await inquirer.prompt(getOfferCreationQuestions())
    // const input = { requestID: lastRequestID.toString(), offerStartingTime: "2021-05-24T00:00:00Z", offerEndTime: "2021-05-24T23:59:59Z", totalPrice: "2000" }
    
    // Create offer
    const requestID = new BN(input.requestID)
    console.log(`Creating offer for request ${requestID}...`)
    const offerID = await submitOffer(SMAUGMarketplaceInstance, requestID, currentAccount)
    await utils.waitForEnter(`Offer created with ID ${offerID}. Press Enter to submit offer extra: `)

    // Create offer extra
    const startDate = new Date(input.offerStartingTime)
    const endDate = new Date(input.offerEndTime)
    const durationInMinutes = new BN(utils.distanceInMinutes(startDate, endDate))
    const totalPrice = new BN(input.totalPrice)
    const newKeyPair = crypto.crypto_box_seed_keypair([1])
    const encryptionKey = newKeyPair.boxPk
    const decryptionKey = newKeyPair.boxSk
    const offerDetails: utils.OfferDetails = { id: offerID, startTime: startDate, durationInMinutes: durationInMinutes, type: "auction", amount: new BN(totalPrice), encryptionKey: encryptionKey, creatorAccount: currentAccount }
    await submitOfferExtra(SMAUGMarketplaceInstance, offerDetails)
    console.log("Offer extra added!")
    console.log(utils.offerToString(offerDetails, (encryptionKey) => "0x" + crypto.to_hex(encryptionKey)))

    keys.set(offerID.toString(), [decryptionKey, encryptionKey])

    await utils.waitForEnter("Offer creation process completed! Press Enter to continue: ")
}

function getOfferCreationQuestions(): inquirer.QuestionCollection {
    return [
        {
            type: "input",
            name: "requestID",
            message: "Request ID",
            validate: (input) => {
                try {
                    if (Web3.utils.toBN(input) > Web3.utils.toBN(0)) {
                        return true
                    }
                    return "Value must be > 0."
                } catch {
                    return "Value is not a number."
                }
            }
        },
        {
            type: "input",
            name: "offerStartingTime",
            message: "Offer starting time (in UTC format)",
            validate: (input) => {
                const datetime = new Date(input).getTime()
                if (isNaN(datetime)) {
                    return "Not a valid date."
                }
                const secondsSinceEpoch = datetime / 1000                 // Operations are in seconds, not milliseconds
                if (secondsSinceEpoch < new Date().getTime() / 1000) {
                    return "Starting time must not be already past."
                }
                return true
            }
        },
        {
            type: "input",
            name: "offerEndTime",
            message: "Offer end time (in UCT format)",
            validate: (input) => {
                const datetime = new Date(input).getTime()
                if (isNaN(datetime)) {
                    return "Not a valid date."
                }
                const secondsSinceEpoch = datetime / 1000                 // Operations are in seconds, not milliseconds
                if (secondsSinceEpoch < new Date().getTime() / 1000) {
                    return "End time must not be already past."
                }
                return true
            }            
        },
        {
            type: "input",
            name: "totalPrice",
            message: "Price to pay",
            validate: (input) => {
                try {
                    if (Web3.utils.toBN(input) > Web3.utils.toBN(0)) {
                        return true
                    }
                    return "Value must be > 0."
                } catch {
                    return "Value is not a number."
                }
            }            
        }
    ] as inquirer.QuestionCollection
}

async function handleRequestClosing(): Promise<void> {
    const input = await inquirer.prompt(getRequestClosingQuestions())
    const requestID = new BN(input.requestID)

    console.log(`Closing request...`)
    await closeRequest(SMAUGMarketplaceInstance, requestID, currentAccount)

    await utils.waitForEnter("Request closed! Press Enter to continue: ")
}

function getRequestClosingQuestions(): inquirer.QuestionCollection {
    return [
        {
            type: "input",
            name: "requestID",
            message: "Request ID",
            validate: (input) => {
                try {
                    if (Web3.utils.toBN(input) > Web3.utils.toBN(0)) {
                        return true
                    }
                    return "Value must be > 0."
                } catch {
                    return "Value is not a number."
                }
            }
        },
    ] as inquirer.QuestionCollection
}

async function handleRequestDecision(): Promise<void> {
    const input = await inquirer.prompt(getRequestDecisionQuestions())
    const requestID = new BN(input.requestID)
    const offerIDs = filterAndConvertOfferIDs(cleanOfferIDsInput(input.offerIDs))

    console.log(`Deciding request...`)
    await decideRequest(SMAUGMarketplaceInstance, requestID, offerIDs, currentAccount)
    await utils.waitForEnter("Request decided! Press Enter to continue: ")
}

function getRequestDecisionQuestions(): inquirer.QuestionCollection {
    return [
        {
            type: "input",
            name: "requestID",
            message: "Request ID",
            validate: (input) => {
                try {
                    if (Web3.utils.toBN(input) > Web3.utils.toBN(0)) {
                        return true
                    }
                    return "Value must be > 0."
                } catch {
                    return "Value is not a number."
                }
            }
        },
        {
            type: "input",
            name: "offerIDs",
            message: "IDs of the offers, separated by a comma.",
            validate: (input: string) => {
                const cleanedInput = cleanOfferIDsInput(input)
                if (cleanedInput.length == 0) {
                    return "Not a valid input."
                }
                
                const validatedInput = filterOfferIDs(cleanedInput)
                if (validatedInput.length < cleanedInput.length) {
                    return "Some values are not numbers."
                }

                return true
            }
        }
    ] as inquirer.QuestionCollection
}

function cleanOfferIDsInput(rawOfferIDs: string): string[] {
    return rawOfferIDs.split(",").map(element => element.trim()).filter(element => element.length > 0)        // Split by comma, remove leading and trailing whitespaces, remove resulting empty strings
}

function filterOfferIDs(offerIDs: string[]): string[] {
    return offerIDs.filter(element => !isNaN(+element))
}

function filterAndConvertOfferIDs(offerIDs: string[]): BN[] {
    return filterOfferIDs(offerIDs).map(element => new BN(element))
}

async function handleOfferSettlment() {
    const input = await inquirer.prompt(getOfferSettlmentQuestions())
    const requestID = new BN(input.requestID)
    const offerID = new BN(input.offerID)

    console.log(`Settling offer...`)
    await settleOffer(SMAUGMarketplaceInstance, requestID, offerID, currentAccount)
    await utils.waitForEnter("Offer settled! Press Enter to continue: ")
}

function getOfferSettlmentQuestions(): inquirer.QuestionCollection {
    return [
        {
            type: "input",
            name: "requestID",
            message: "Request ID",
            validate: (input) => {
                try {
                    if (Web3.utils.toBN(input) > Web3.utils.toBN(0)) {
                        return true
                    }
                    return "Value must be > 0."
                } catch {
                    return "Value is not a number."
                }
            }
        },
        {
            type: "input",
            name: "offerID",
            message: "Offer ID",
            validate: (input) => {
                try {
                    if (Web3.utils.toBN(input) > Web3.utils.toBN(0)) {
                        return true
                    }
                    return "Value must be > 0."
                } catch {
                    return "Value is not a number."
                }
            }
        },
    ] as inquirer.QuestionCollection
}

async function handleRequestCreatorClaim(): Promise<void> {
    const input = await inquirer.prompt(getRequestCreatorClaimQuestions())
    const offerID = new BN(input.offerID)

    console.log(`Claming money...`)
    await claimMoney(SMAUGMarketplaceInstance, offerID, currentAccount)
    await utils.waitForEnter("Money claimed! Press Enter to continue: ")
}

function getRequestCreatorClaimQuestions(): inquirer.QuestionCollection {
    return [
        {
            type: "input",
            name: "offerID",
            message: "Offer ID",
            validate: (input) => {
                try {
                    if (Web3.utils.toBN(input) > Web3.utils.toBN(0)) {
                        return true
                    }
                    return "Value must be > 0."
                } catch {
                    return "Value is not a number."
                }
            }
        }
    ] as inquirer.QuestionCollection
}

async function handleOfferCreatorClaim(): Promise<void> {
    const input = await inquirer.prompt(getOfferCreatorClaimQuestions())
    const offerID = new BN(input.offerID)

    console.log(`Claming money...`)
    await claimMoney(SMAUGMarketplaceInstance, offerID, currentAccount)
    await utils.waitForEnter("Money claimed! Press Enter to continue: ")
}

function getOfferCreatorClaimQuestions(): inquirer.QuestionCollection {
    return [
        {
            type: "input",
            name: "offerID",
            message: "Offer ID",
            validate: (input) => {
                try {
                    if (Web3.utils.toBN(input) > Web3.utils.toBN(0)) {
                        return true
                    }
                    return "Value must be > 0."
                } catch {
                    return "Value is not a number."
                }
            }
        }
    ] as inquirer.QuestionCollection
}

function printNewOffersFulfilled(cleanAfterPrint: Boolean = false) {
    if (unseenOfferFulfilledEvents.length > 0) {
        console.log(`!!! ${unseenOfferFulfilledEvents.length} new offers have been fulfilled since last time!`)
        unseenOfferFulfilledEvents.forEach((offer, index) => {
            console.log(`${index+1})`)
            console.log(`- Offer ID: ${offer.returnValues.offerID}`)
            console.log(`- Encrypted token: ${offer.returnValues.token}`)
            const offerKeypair = keys.get(offer.returnValues.offerID)
            // Token decoding and decryption
            const tokenDecoded = web3MarketplaceInstance.utils.toUtf8(offer.returnValues.token)
            const cipherText = utils.base64ToUint8Array(tokenDecoded)
            const decryptedToken = crypto.crypto_box_seal_open(cipherText, offerKeypair[1], offerKeypair[0])
            const decodedDecryptedToken = crypto.decode_utf8(decryptedToken)

            const jwtHeader = jwtDecode(decodedDecryptedToken, {header: true})
            const jwtPayload = jwtDecode(decodedDecryptedToken)
            console.log("- Decrypted and decoded token:")
            console.log({header: jwtHeader, payload: jwtPayload})

            if (index < unseenOfferFulfilledEvents.length-1) {
                console.log("*****")
            }
        })
        if (cleanAfterPrint) {
            unseenOfferFulfilledEvents = []
        }
    } else {
        console.log("No new offers have been fulfilled!")
    }
}

function printNewOffersUnfulfilled(cleanAfterPrint: Boolean = false) {
    if (unseenOfferUnFulfilledEvents.length > 0) {
        console.log(`!!! ${unseenOfferUnFulfilledEvents.length} new offers have not been fulfilled since last time!`)
        unseenOfferUnFulfilledEvents.forEach((offer, index) => {
            console.log(`${index+1}) Offer ID: ${offer.returnValues.offerID}`)
        })
        if (cleanAfterPrint) {
            unseenOfferUnFulfilledEvents = []
        }
    } else {
        console.log("No new offers have not been fulfilled!")
    }
}

function checkForEventsGenerated(cleanAfterPrint: Boolean = false) {
    if (unseenEvents.length == 0) {
        console.log("No pending events.")
        return
    }

    console.log("Events emitted:")

    unseenEvents.forEach((event) => {
        console.log(event)
    })

    if (cleanAfterPrint) {
        unseenEvents = []
    }
}

function flipDebug() {
    debug = !debug
    console.log(`Debug switch now ${debug ? "ON" : "OFF"}!`)
}

async function getNewAccessToken(requestCreatorAccount: string) : Promise<utils.MarketplaceAccessToken> {
    const backendEndpoint = utils.getBackendEndpoint(backendURL, requestCreatorAccount)
    const requestCreationTokenHeaders = backendHost == undefined ? null : {"Host": backendHost}
    const requestCreationTokenResponse = await fetch(backendEndpoint, {headers: requestCreationTokenHeaders})

    return await requestCreationTokenResponse.json() as utils.MarketplaceAccessToken
}

async function submitOffer(marketplace: SMAUGMarketplace, requestID: BN, creatorAccount: string): Promise<BN> {
    const newOfferTransactionResult = await marketplace.methods.submitOffer(requestID.toString()).send({from: creatorAccount, gas: 2000000, gasPrice: "1"})

    const txStatus = (newOfferTransactionResult.events!.FunctionStatus.returnValues.status) as number
    if (txStatus != 0) {
        throw new Error(`Offer creation failed with status ${txStatus}. See https://github.com/SOFIE-project/Marketplace/blob/master/solidity/contracts/StatusCodes.sol for additional information.`)
    }
    const offerID = (newOfferTransactionResult.events!.OfferAdded.returnValues.offerID) as BN

    debug && console.log(`Offer submitted with ID: ${offerID}`)

    return offerID
}

async function submitOfferExtra(marketplace: SMAUGMarketplace, extra: utils.OfferDetails): Promise<void> {
    const offerExtra = [extra.startTime.getTime()/1000, extra.durationInMinutes.toString(), extra.type == "auction" ? 0 : 1, "0x" + crypto.to_hex(extra.encryptionKey)]
    if (extra.authenticationKey) {
        offerExtra.push(crypto.to_hex(extra.authenticationKey))
    }

    debug && console.log(`Submitting offer extra [${offerExtra}]...`)

    const newOfferExtraTransactionResult = await marketplace.methods.submitOfferArrayExtra(extra.id.toString(), offerExtra).send({from: extra.creatorAccount, gas: 2000000, gasPrice: "1", value: extra.amount.toString()})

    if (newOfferExtraTransactionResult.events!.FunctionStatus.returnValues == undefined) {
        // All good
        debug && console.log(`Offer extra submitted for ID: ${extra.id.toString()}`)
    } else {
        const txStatus = (newOfferExtraTransactionResult.events!.FunctionStatus.returnValues.status) as number
        if (txStatus != 0) {
            throw new Error(`Offer creation failed with status ${txStatus}. See https://github.com/SOFIE-project/Marketplace/blob/master/solidity/contracts/StatusCodes.sol for additional information.`)
        } else {
            debug && console.log(`Offer extra submitted for ID: ${extra.id.toString()}`)
        }
    } 
}

async function closeRequest(marketplace: SMAUGMarketplace, requestID: BN, requestCreatorAccount: string): Promise<void> {
    const requestClosingTransactionResult = await marketplace.methods.closeRequest(requestID.toString()).send({from: requestCreatorAccount, gas: 2000000, gasPrice: "1"})

    const txStatus = (requestClosingTransactionResult.events!.FunctionStatus.returnValues.status) as number
    if (txStatus != 0) {
        throw new Error(`Request closing failed with status ${txStatus}. See https://github.com/SOFIE-project/Marketplace/blob/master/solidity/contracts/StatusCodes.sol for additional information.`)
    }

    debug && console.log(`Request ${requestID} closed successfully.`)
}

async function decideRequest(marketplace: SMAUGMarketplace, requestID: BN, winningOfferIDs: BN[], requestCreatorAccount: string): Promise<void> {
    const requestDecisionTransactionResult = await marketplace.methods.decideRequest(requestID.toString(), winningOfferIDs.map(offerID => offerID.toString())).send({from: requestCreatorAccount, gas: 2000000, gasPrice: "1"})

    if (requestDecisionTransactionResult.events!.FunctionStatus.returnValues == undefined) {
        // All good
        debug && console.log(`Request ${requestID} decided with winning offers: [${winningOfferIDs}].`)
    } else {
        const txStatus = (requestDecisionTransactionResult.events!.FunctionStatus.returnValues.status) as number
        if (txStatus != 0) {
            throw new Error(`Offer creation failed with status ${txStatus}. See https://github.com/SOFIE-project/Marketplace/blob/master/solidity/contracts/StatusCodes.sol for additional information.`)
        } else {
            debug && console.log(`Request ${requestID} decided with winning offers: [${winningOfferIDs}].`)
        }
    }
}

async function settleOffer(marketplace: SMAUGMarketplace, requestID: BN, offerID: BN, transactionCreatorAccount: string): Promise<void> {
    const offerSettlmentTransactionResult = await marketplace.methods.settleTrade(requestID.toString(), offerID.toString()).send({from: transactionCreatorAccount, gas: 2000000, gasPrice: "1"})
    
    if (offerSettlmentTransactionResult.events!.FunctionStatus) {
        const txStatus = offerSettlmentTransactionResult.events!.FunctionStatus.returnValues.status as number
        throw new Error(`Offer settlment failed with status ${txStatus}. See https://github.com/SOFIE-project/Marketplace/blob/master/solidity/contracts/StatusCodes.sol for additional information.`)
    }

    debug && console.log(`Offer ${offerID} settled for request ${requestID}.`)
}

async function claimMoney(marketplace: SMAUGMarketplace, offerID: BN, requestorAccount: string): Promise<void> {
    const moneyClaimTransactionResult = await marketplace.methods.withdraw(offerID.toString()).send({from: requestorAccount, gas: 2000000, gasPrice: "1"})

    const txStatus = (moneyClaimTransactionResult.events!.FunctionStatus.returnValues.status) as number
    if (txStatus != 0) {
        throw new Error(`Money claim failed with status ${txStatus}. See https://github.com/SOFIE-project/Marketplace/blob/master/solidity/contracts/StatusCodes.sol for additional information.`)
    }

    debug && console.log(`Money correctly claimed for offer ${offerID}!`)
}