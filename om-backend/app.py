from flask.app import Flask
from project import create_app
from project.db_utils import load_server_config
from dotenv import load_dotenv
from os import environ

load_dotenv('.env')
_app: Flask = None


# Singleton for Flask app
def get_app() -> Flask:
    global _app
    if _app is None:
        _app = create_app(load_server_config())
    return _app


if __name__ == "__main__":
    app = get_app()
    app.run(host=environ.get('HOST', '0.0.0.0'),
            port=environ.get('PORT', '61234'))
