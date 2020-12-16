from flask import Blueprint

blueprint = Blueprint("auth", "__name__")

# The routes in index_routes are added to the auth blueprint, hence those are loaded after the blueprint object has been initialised.
from project.routes.auth import auth