require("ts-node/register")

module.exports = {
  migrations_directory: "./app/migrations",
  networks: {
    marketplace: {
      host: "127.0.0.1",
      port: 8545,
      network_id: "*"
    }
  },
  compilers: {
    solc: {
      version: "^0.5.0",
      settings: {
        optimizer: {
          enabled: true
        }
      }
    }
  }
}