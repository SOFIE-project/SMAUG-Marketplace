pragma solidity ^0.5.0;

/**
@notice An interface for a manageable marketplace where request creation is limited to callers owning a valid access token.
*/
interface AuthorisedManageableMarketPlace {

    function submitAuthorisedRequest
        (bytes32 tokenDigest, bytes calldata signature, bytes32 nonce, uint deadline)
        external returns (uint8 status, uint requestID);
}