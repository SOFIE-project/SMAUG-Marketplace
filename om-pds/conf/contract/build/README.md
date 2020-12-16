# PDS smart contract

## Prerequisites
* npm
* solc (sudo npm install -g solc)

## Compiling
* npm install sofie-pds sofie-erc721
* cd node_modules
* solc -o ../ --allow-paths . --abi --bin sofie-pds/PDS.sol
* solc -o ../ --allow-paths . --abi --bin sofie-erc721/ERC721Metadata.sol
