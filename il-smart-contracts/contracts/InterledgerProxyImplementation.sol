pragma solidity ^0.5.0;

import { InterledgerProxy } from "./interfaces/InterledgerProxy.sol";

import { InterledgerReceiverInterface } from "sofie-interledger-contracts/contracts/InterledgerReceiverInterface.sol";
import { InterledgerSenderInterface } from "sofie-interledger-contracts/contracts/InterledgerSenderInterface.sol";

// This contract is owned and deployed by the IL owner (very likely the marketplace owner). PDS smart contracts will need to follow the protocol to interact with it.
contract InterledgerProxyImplementation is InterledgerProxy, InterledgerReceiverInterface, InterledgerSenderInterface {

    enum InterledgerEventType {
        RequestDecision
    }

    // InterledgerReceiverInterface compliance

    // Forwards the interledger payload to all potential listeners and accepts the interledger event
    function interledgerReceive(uint256 nonce, bytes memory data) public {
        emit InterledgerDataReceived(data);
        emit InterledgerEventAccepted(nonce);
    }

    // InterledgerSenderInterface compliance

    // Can be called by interested parties to trigger an interledger operation with the marketplace
    function triggerInterledger(bytes calldata dataPayload) external {
        emit InterledgerEventSending(uint(InterledgerEventType.RequestDecision), dataPayload);
    }

    function interledgerCommit(uint256 id) public {}

    function interledgerCommit(uint256 id, bytes memory data) public {}

    function interledgerAbort(uint256 id, uint256 reason) public {}
}