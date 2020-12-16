import logging
from flask import Flask

_logger: logging.Logger

# Registers the blueprints for the given Flask app.
def init_app(app: Flask):
    from project.routes.errors import blueprint as errors_bp
    from project.routes.auth import blueprint as auth_bp
    from project.routes.api import blueprint as api_bp
    from project.routes.main import blueprint as main_bp
    from project.routes.user import blueprint as user_bp
    app.register_blueprint(errors_bp)
    app.register_blueprint(auth_bp)
    app.register_blueprint(main_bp)
    app.register_blueprint(user_bp, url_prefix="/user")
    app.register_blueprint(api_bp, url_prefix="/api")
    global _logger
    _logger = app.logger
    _logger.info("Routes initialised.")