import appendQuery from "append-query";
import atob from "atob"
import { sys } from "typescript";
import urljoin from "url-join"
import BN from "bn.js";
import { URL } from "url";

export interface EnvVariables {
    MPAddress: string,
    MPABIPath: string,
    ethereumMPAddress: string,
    MPOwner: string,
    MPBackendAddress: string,
    MPBackendHost?: string
}

export interface MarketplaceAccessToken {
    digest: string
    encoded: string
    signature: string
    nonce: string
}
export interface RequestDetails {
    id: BN,
    deadline: Date,
    startTime: Date,
    durationInMinutes: BN,
    minAuctionPricePerMinute: BN,
    instantRentRules?: InstantRentRule[]
    lockerID: BN,
    creatorAccount: string
}

export interface InstantRentRule {
    startDuration: BN,
    pricePerMinute: BN
}

export interface OfferDetails {
    id: BN,
    startTime: Date,
    durationInMinutes: BN,
    type: "auction" | "instant",
    amount: BN,
    encryptionKey: Uint8Array,
    authenticationKey?: Uint8Array,
    creatorAccount: string
}

export async function waitForEnter(message?: string) {
    const waitForEnter = require("wait-for-enter");
    message = message || "Press Enter to continue: "
    console.log(message)
    await waitForEnter()
}

export function base64ToUint8Array(base64String: string): Uint8Array {
    let binaryString = atob(base64String.replace(/_/g, "/").replace(/-/g, "+"))
    let binaryStringLength = binaryString.length;
    let bytes = new Uint8Array(binaryStringLength);

    for (let i = 0; i < binaryStringLength; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
}

export function parseAndReturnEnvVariables(environment: NodeJS.ProcessEnv): EnvVariables {
    const MPAddress = process.env["MP_ADDRESS"] as string
    const MPABIPath = process.env["MP_ABI_PATH"] as string
    const ethereumMPAddress = process.env["ETHEREUM_MP_ADDRESS"] as string
    const MPOwner = process.env["MP_OWNER"] as string
    const MPBackendAddress = process.env["MP_BACKEND_ADDRESS"] as string
    const MPBackendHost = process.env["MP_BACKEND_HOST"] as string              // Optional

    if (MPAddress == undefined) {
        console.error("MP_ADDRESS env variable missing.")
        sys.exit(1)
    }
    if (MPABIPath == undefined) {
        console.error("MP_ABI_PATH env variable missing.")
        sys.exit(1)
    }
    if (ethereumMPAddress == undefined) {
        console.error("ETHEREUM_MP_ADDRESS env variable missing.")
        sys.exit(1)
    }
    if (MPOwner == undefined) {
        console.error("MP_OWNER env variable missing.")
        sys.exit(1)
    }
    if (MPBackendAddress == undefined) {
        console.error("MP_BACKEND_ADDRESS env variable missing.")
        sys.exit(1)
    }
    
    return { MPAddress, MPABIPath, ethereumMPAddress, MPOwner, MPBackendAddress, MPBackendHost }
}

export function printArgumentsDetails(options: EnvVariables) {
    console.log(`Arguments used:\n
        - MARKETPLACE ETHEREUM NETWORK ADDRESS: ${options.ethereumMPAddress}\n
        - MARKETPLACE SMART CONTRACT ADDRESS: ${options.MPAddress}\n
        - MARKETPLACE BACKEND ADDRESS: ${options.MPBackendAddress}
    `)
}

export function getBackendEndpoint(backendURL: URL, ethereumAddress: string): string {
    let backendEndpoint = urljoin(backendURL.toString(), "api", "marketplace", "gettoken")
    return appendQuery(backendEndpoint, {ethereum_address: ethereumAddress})
}

export function encodeRulesToSolidityArray(rules: InstantRentRule[]): string[] {
    let result: string[] = new Array(rules.length*2)

    rules.forEach((value, index) => {
        result[index*2] = `value.startDuration`
        result[index*2 + 1] = `value.pricePerMinute`
    })
    
    return result
}

export function requestToString(details: RequestDetails): string {
    return `
        - ID: ${details.id}\n
        - DEADLINE: ${details.deadline.toUTCString()}\n
        - START TIME: ${details.startTime.toUTCString()}\n
        - END TIME: ${new Date(new BN(details.startTime.getTime()).add(details.durationInMinutes.mul(new BN(60000))).toNumber()).toUTCString()}\n
        - LOCKER ID: ${details.lockerID.toString()}\n
        - CREATOR ACCOUNT: ${details.creatorAccount}
    `
}

export function offerToString(details: OfferDetails, keyEncodingFunction: (input: Uint8Array) => string): string {
    const authKeyLine = details.authenticationKey ? `- AUTH KEY: ${keyEncodingFunction(details.authenticationKey)}\n` : ""
    return `
        - ID: ${details.id}\n
        - START TIME: ${details.startTime.toUTCString()}\n
        - END TIME: ${new Date(new BN(details.startTime.getTime()).add(details.durationInMinutes.mul(new BN(60000))).toNumber()).toUTCString()}\n
        - ENCRYPTION KEY: ${keyEncodingFunction(details.encryptionKey)}\n
        ${authKeyLine}
        - CREATOR ACCOUNT: ${details.creatorAccount}
    `
}

export function distanceInMinutes(startDate: Date, endDate: Date): number {
    return Math.ceil((endDate.getTime() - startDate.getTime()) / 60000)
}