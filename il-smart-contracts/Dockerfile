FROM trufflesuite/ganache-cli:v6.10.2

# Copy test data from development folder. This can be automated in future, and a new smart contract deployed every time the network is run...
RUN mkdir -p /data
COPY authorisation_state/ /data

ENTRYPOINT [ "node", "/app/ganache-core.docker.cli.js", "--db", "/data", "--allowUnlimitedContractSize", "--mnemonic", "main blouse fashion brand own rocket fluid notable vacuum gain guitar leaf", "-i", "666" ]