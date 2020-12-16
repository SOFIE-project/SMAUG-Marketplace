import os
from project import kafka
from flask import Flask
from project.config import BaseConfig
from web3 import Web3

app_config: BaseConfig = None                   # Stores the global config office used for the Flask app


def create_app(config=None) -> Flask:
    global app_config
    app_config = config
    app = _create_and_setup_flask_app(config)
    from project import models, routes, web3
    from flask_bootstrap import Bootstrap
    Bootstrap(app)
    models.init_app(app)
    routes.init_app(app)
    web3.init_app(app)
    kafka.init_app(app)
    _configure_sl_schema(app)

    return app

def _create_and_setup_flask_app(configuration: BaseConfig) -> Flask:
    import logging
    app = Flask(__name__)
    app.config.from_object(configuration)
    app.logger.setLevel(logging.DEBUG)

    return app

# Saves the SMAUG schema in the SR component, if it has not been previously created.
def _configure_sl_schema(app: Flask):
    import urllib.parse, requests, json
    sr_endpoint = app.config.get("SR_ENDPOINT_URL")
    sr_path = urllib.parse.urljoin(sr_endpoint, "api/schema")
    schema_file_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "SL_Schema.json"))       # No check whether the file actually exists or not

    with open(schema_file_path, "r") as sl_schema_file:
        sl_schema = json.load(sl_schema_file)
    response = requests.post(sr_path, json={"name": app.config.get("SR_SCHEMA_NAME"), "schema": sl_schema})
    if response.status_code == 409:
        app.logger.debug("Schema already existing in the SR component.")
    elif response.status_code == 201:
        app.logger.debug("Schema saved in the SR component.")
    else:
        app.logger.error("Some other error has occurred while interacting with the SR component.")
        exit(255)