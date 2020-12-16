const InterledgerProxyImplementation = artifacts.require("InterledgerProxyImplementation")

module.exports = (async (deployer) => {
  await deployer.deploy(InterledgerProxyImplementation)
}) as Truffle.Migration

// From: https://stackoverflow.com/questions/40900791/cannot-redeclare-block-scoped-variable-in-unrelated-files
export {}