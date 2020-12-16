import yaml, logging
from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from flask_login import LoginManager
from flask_babel import Babel, lazy_gettext as _l
from project.authorization_server import AuthorizationServer
from project.db_utils import _populate_mocked_db_and_pds
from distutils.util import strtobool


_auth: AuthorizationServer
db = SQLAlchemy()
login = LoginManager()
_logger: logging.Logger


def init_app(app: Flask):
    from project.models.smartLocker import SmartLocker
    from project.models.smartLockerOwner import SmartLockerOwner
    from project.models.marketplaceReq import MarketplaceRequest
    from project.models.marketplaceOff import MarketplaceOffer

    global _auth
    _auth = AuthorizationServer()
    
    db.init_app(app)

    login.init_app(app)
    login.login_view = 'auth.login'
    login.login_message = _l('Please log in to access this page.')

    Babel(app)

    global _logger
    _logger = app.logger

    Migrate().init_app(app, db)
    with app.app_context():
        db.create_all()
        
    mock_data_file_path = app.config.get("MOCK_DATA_FILE_PATH")
    if mock_data_file_path is not None:
        with app.app_context():
            _populate_mocked_db_and_pds(db, mock_data_file_path, _auth)
        _logger.info("DB and PDS models initialised.")
        mock_did = app.config.get("MOCK_DID")
        if mock_did is not None and strtobool(mock_did):
            from project.did_utils import create_mock_wallet
            create_mock_wallet(app.config.get("MOCK_WALLET_PATH"))
            _logger.info("Mocked wallet created.")


