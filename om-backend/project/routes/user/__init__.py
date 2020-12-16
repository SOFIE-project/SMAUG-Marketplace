from flask import Blueprint

blueprint = Blueprint("user", "__name__")

from project.routes.user import locker
from project.routes.user import request
from project.routes.user import token
