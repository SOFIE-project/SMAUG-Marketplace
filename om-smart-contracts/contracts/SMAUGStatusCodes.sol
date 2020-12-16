pragma solidity ^0.5.0;

import { StatusCodes } from "sofie-offer-marketplace/contracts/StatusCodes.sol";

contract SMAUGStatusCodes is StatusCodes {

    uint8 constant internal TokenAlreadyUsed = 101;                         // Token has already been used.
    uint8 constant internal OfferExtraInvalid = 102;                        // The extra for the offer does not meet the requirements.
    uint8 constant internal InstantRentNotSupported = 103;                  // Instant rent offer submitted for auction-only request.
    uint8 constant internal InsufficientEscrowPayment = 104;                // Amount of money escrowed in an offer lower than the minimum required by the request.
    uint8 constant internal PaymentNotExisting = 105;                       // Withdrawing money for an offer that is not claimable.
    uint8 constant internal PaymentNotResolved = 106;                       // Withdrawing money for an offer that has not yet been resolved (either winning or losing).
    uint8 constant internal EmptyInterledgerPayload = 107;                  // Empty interledger payload received.
    uint8 constant internal AlreadySettledOffer = 108;                      // Settling an offer previously settled.
}