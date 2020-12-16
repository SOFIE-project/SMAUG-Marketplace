# Marketplace demo

Very simple demo for the marketplace, mainly to be used to test Interledger operations. The script allows to manually create a new request, a new offer, or to decide a request. The script also allows the automate the creation of a request and some offers, of which only a subset is selected as winner by the request creator. The script also listens for Interledger (receiving) events, and shows the access tokens that have been issued for the winning offers.

## Fresh install

Upon a fresh clone of the project, `npm install` must be run. This installs the needed `npm` packages and generates the Web3 typescript bindings for the SMAUG smart contract.

## Run

> Before running the demo, a test blockchain must be running. For convenience, the one provided in this project can be used; it can be started by running `npm run deploy:marketplace` from the root of the project.

> Before running the demo, the ABI for the SMAUGMarketPlace smart contract must be copied in `config/abi`. For instance, in this project, it can be retrieved by copying the `abi` array value of `build/contracts/SMAUGMarketPlace.json`. For convenience, the latest ABI is already present in the folder.

The demo application can be run by executing `npm run demo -- --marketplace-address <MARKETPLACE_ADDRESS> --backend-url <MARKETPLACE_BACKEND_URL> --marketplace-abi-path <MARKETPLACE_ABI_PATH> --ethereum-address <ETHEREUM_NETWORK_ADDRESS> --marketplace-owner <MARKETPLACE_OWNER_ADDRESS>`.

For convenience, there is a second script that can be run instead of the previous one, and that is `npm run demo:default`. This will start the demo using default parameters, and assumes that the test marketplace blockchain provided in this project has been deployed. Since it contains a shared state, the addresses of the smart contracts are already defined and do not need to be changed every time the blockchain is restarted. For instance, the `demo:default` npm script will execute the following command: `ts-node ./src/main.ts --marketplace-address 0x51Cdd045E893528fB7C6F2DCEB07Efa9eb2FB375 --backend-url http://127.0.0.1:61234 --marketplace-abi-path ./config/abi/SMAUGMarketPlace.json --ethereum-address ws://127.0.0.1:8545 --marketplace-owner 0x471e0575bFC76d7e189ab3354E0ecb70FCbf3E46`.