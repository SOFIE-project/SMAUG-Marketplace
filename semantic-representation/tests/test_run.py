# !/usr/bin/env python
import sys
sys.path.append(".")
from project import create_app, db
from config import Config, TestConfig


def server_startup():
    app = create_app(TestConfig)
    app_context = app.app_context()
    app_context.push()
    db.create_all()
    app.run(debug=app.config['DEBUG'], host=app.config['HOST'], port=app.config['PORT'])


def server_shutdown():
    db.session.remove()
    db.drop_all()


if __name__ == '__main__':
    server_startup()
    server_shutdown()