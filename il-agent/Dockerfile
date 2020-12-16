# Tried to use Alpine, but there was some error with rusty-rlp package installation (used by Web3)
FROM python:3.6

ARG PROJECT_PATH="/interledger"

# Build layers
RUN mkdir -p ${PROJECT_PATH}
WORKDIR ${PROJECT_PATH}
COPY setup.py ./
COPY ./src/ ./src
RUN python setup.py develop

# Run layers
COPY ./config/abi ./config/abi
COPY ./config/SMAUG-Docker.cfg ./config/SMAUG-Docker.cfg
COPY ./start_interledger.py ./
ENTRYPOINT [ "python", "start_interledger.py", "config/SMAUG-Docker.cfg" ]