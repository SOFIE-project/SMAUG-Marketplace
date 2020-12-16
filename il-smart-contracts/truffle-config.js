require("ts-node/register")

module.exports = {
  migrations_directory: "./app/migrations",
  networks: {
    authorisation: {
      host: "localhost",
      port: 8546,
      network_id: "*"
    }
  },
  compilers: {
    solc: {
      version: "^0.5.0"
    }
  }
}
