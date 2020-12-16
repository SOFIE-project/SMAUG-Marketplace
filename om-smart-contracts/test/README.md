# All the methods to test, per smart contract

Normal method names: not tested.

*Italic method names*: tested.

## MultiManagersBaseContract (tested by Aalto)

- changeOwner()
- addManager()
- revokeManagerCert()
- MultiManagers interface conformance

## AbstractMarketPlace (tested by Aalto)

- ERC165 interface conformance
- Marketplace interface conformance

## AbstractAuthorisedOwnerManageableMarketPlace (via SMAUGMarketPlace)

- *getMarketInformation()*
- *resetAccessTokens()*
- *submitAuthorisedRequest() & isRequestDefined() & getRequest() & getOpenRequestIdentifiers()*
- *settleTrade()*

## SMAUGMarketPlace

- *getType()*
- *closeRequest() & getClosedRequestIdentifiers()*
- *decideRequest() & isRequestDecided() & getRequestDecision()*
- *deleteRequest()*
- *submitRequestArrayExtra() & getRequestExtra()*
- *submitOffer() & isOfferDefined() & getOffer() & getRequestOfferIDs()*
- *submitOfferArrayExtra() & getOfferExtra()*
- *interledgerReceive()*
- *withdraw()*