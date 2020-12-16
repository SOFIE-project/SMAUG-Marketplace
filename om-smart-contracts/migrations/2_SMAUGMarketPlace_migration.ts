const AccessTokenLibrary = artifacts.require("AccessTokenLibrary")
const UtilsLibrary = artifacts.require("UtilsLibrary")
const SMAUGMarketPlace = artifacts.require("SMAUGMarketPlace")

module.exports = (async (deployer, accounts) => {
    await deployer.deploy(AccessTokenLibrary)
    await deployer.deploy(UtilsLibrary)
    deployer.link(AccessTokenLibrary, SMAUGMarketPlace)
    deployer.link(UtilsLibrary, SMAUGMarketPlace)
    await deployer.deploy(SMAUGMarketPlace)
}) as Truffle.Migration

// because of https://stackoverflow.com/questions/40900791/cannot-redeclare-block-scoped-variable-in-unrelated-files
export {}