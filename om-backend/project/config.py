import os
import urllib.parse
from dotenv import load_dotenv

load_dotenv('.env')


class BaseConfig(object):

    SR_ENDPOINT_URL = os.environ.get("SR_URL", "http://localhost:5000")
    IAA_ENDPOINT_URL = os.environ.get('IAA_ENDPOINT_URL', 'http://localhost:9000/')
    PDS_ENDPOINT_URL = os.environ.get('PDS_ENDPOINT_URL', 'http://localhost:9001/')
    PDS_MGMT_ENDPOINT_URL = os.environ.get('PDS_MGMT_URL', 'http://localhost:9002/')

    ETHEREUM_MARKETPLACE_NODE_ADDRESS = os.environ.get("ETH_MARKETPLACE_NODE_ADDR", "ws://localhost:8545")
    ETHEREUM_MARKETPLACE_SC_ADDRESS = os.environ.get("ETH_MARKETPLACE_SC_ADDR", "0xbcaAFEEA5F90d310f7B284c8348412DDc02C267b")
    ETHEREUM_MARKETPLACE_SC_ABI_PATH = os.path.abspath(os.path.join("project", "..", "SMAUGMarketPlaceABI.json"))
    ETHEREUM_MARKETPLACE_OWNER_ADDRESS = os.environ.get("ETH_MARKETPLACE_OWNER_ADDR", "0x471e0575bFC76d7e189ab3354E0ecb70FCbf3E46")

    MARKETPLACE_BROKER_URL = os.environ.get("MARKETPLACE_BROKER_URL")
    MARKETPLACE_BROKER_TOPIC = os.environ.get("MARKETPLACE_BROKER_TOPIC", "contract-events")

    PDS_CHALLENGE_URL = urllib.parse.urljoin(PDS_ENDPOINT_URL, "gettoken")
    PDS_TOKEN_URL = urllib.parse.urljoin(PDS_ENDPOINT_URL, "gettoken")
    IAA_VERIFY_URL = urllib.parse.urljoin(IAA_ENDPOINT_URL, "secure/jwt")

    SR_SCHEMA_NAME = os.environ.get("SR_SCHEMA_NAME", "SMAUG Smart Locker Schema")
    TD_PATH = os.environ.get("TD_PATH", os.path.abspath(os.path.join("project", "SMAUG_TD.json")))

    USER_ETHEREUM_ADDRESS = os.environ.get("USER_ETHEREUM_ADDRESS", "0x471e0575bFC76d7e189ab3354E0ecb70FCbf3E46")

    SERVER_NAME =  os.environ.get("SERVER_NAME", None)
    SECRET_KEY = os.environ.get("SECRET_KEY", "BatmanUsesSteroids")


class MockedDevConfig(BaseConfig):
    ENV = "development"
    SQLALCHEMY_DATABASE_URI = "sqlite://"
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    MOCK_DATA_FILE_PATH = os.path.abspath(os.path.join("project", "development", "mock_db_data.yaml"))
    MOCK_DID = os.environ.get("MOCK_DID", None)
    MOCK_WALLET_PATH = os.path.abspath(os.path.join("project", "development", "mock_did_wallet.yaml"))
