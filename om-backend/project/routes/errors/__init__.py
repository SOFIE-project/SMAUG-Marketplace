from flask import Blueprint

blueprint = Blueprint("errors", "__name__")

# The routes in error_routes are added to the errors blueprint, hence those are loaded after the blueprint object has been initialised.
from project.routes.errors import error_routes