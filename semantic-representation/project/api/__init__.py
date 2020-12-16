from flask import Blueprint

bp = Blueprint('api', __name__)

from project.api import schemas, validation, errors
