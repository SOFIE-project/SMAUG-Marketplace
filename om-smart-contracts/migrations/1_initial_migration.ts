const Migrations = artifacts.require("Migrations")

module.exports = (async (deployer) => {
  await deployer.deploy(Migrations)
}) as Truffle.Migration

// From: https://stackoverflow.com/questions/40900791/cannot-redeclare-block-scoped-variable-in-unrelated-files
export {}