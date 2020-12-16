from flask import Blueprint

blueprint = Blueprint("api", "__name__")

# The routes in all the imported classes are added to the api blueprint, hence those are loaded after the blueprint object has been initialised.
from project.routes.api import authorization, errors, marketplace, smart_locker, smart_locker_owner, thing_description
