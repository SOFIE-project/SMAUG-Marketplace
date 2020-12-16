# Tried to use Alpine, but there was some error with rusty-rlp package installation (used by Web3)
FROM python:3.6

ARG PROJECT_PATH="/om-backend"
ARG EXPOSED_PORT="61234"

RUN apt update -y && \
    apt install -y gnupg2 software-properties-common git &&\
    apt-key adv --keyserver keyserver.ubuntu.com --recv-keys CE7709D068DB5E88 &&\
    add-apt-repository "deb https://repo.sovrin.org/sdk/deb bionic stable" &&\
    apt update -y &&\
    apt install -y libindy

RUN mkdir -p ${PROJECT_PATH}
WORKDIR ${PROJECT_PATH}
COPY requirements.txt ./
RUN pip install -r requirements.txt

EXPOSE ${EXPOSED_PORT}

COPY start_backend SMAUGMarketPlaceABI.json requirements.txt app.py ./
COPY ./project/ ./project

ENTRYPOINT [ "./start_backend" ]