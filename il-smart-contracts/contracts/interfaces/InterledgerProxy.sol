pragma solidity ^0.5.0;

contract InterledgerProxy {
    event InterledgerDataReceived(bytes data);

    function triggerInterledger(bytes calldata dataPayload) external;
}