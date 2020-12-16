import os
from dotenv import load_dotenv

basedir = os.path.abspath(os.path.dirname(__file__))
load_dotenv(os.path.join(basedir, '.env'))


class Config(object):

    # Config binding to app variable for separation
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'batman_is_not_so_tall'
    HOST = os.environ.get('HOST') or '0.0.0.0'
    PORT = os.environ.get('PORT') or '5000'
    DEBUG = os.environ.get('LOG_TO_STDOUT') or False
    LOG_TO_STDOUT = os.environ.get('PORT') or False


    # db config
    SQLALCHEMY_DATABASE_URI = 'sqlite:///' + os.path.join(basedir, 'app.db')
    SQLALCHEMY_TRACK_MODIFICATIONS = False


class TestConfig(Config):
    TESTING = True
    SQLALCHEMY_DATABASE_URI = 'sqlite://'
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    DEBUG = True
    HOST = '0.0.0.0'
    PORT = '5123'
