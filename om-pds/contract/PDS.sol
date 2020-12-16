pragma solidity ^0.5.0;
import { Ownable } from "@openzeppelin/contracts/ownership/Ownable.sol";
contract PDS is Ownable {
    event Debug(bytes data);
    event token_added (bytes indexed metadata, uint index);
    struct token_entry {
        bytes metadata;
        bytes enc_token;
    }
    token_entry[] tokens;
    function new_token(bytes memory metadata, bytes memory enc_token) public onlyOwner {
        tokens.push(token_entry(metadata, enc_token));
        emit token_added(metadata, tokens.length-1);
        emit Debug(metadata);
    }
    function get_token(uint index) public view returns (bytes memory metadata, bytes memory enc_token) {
        return(tokens[index].metadata, tokens[index].enc_token);
    }
}