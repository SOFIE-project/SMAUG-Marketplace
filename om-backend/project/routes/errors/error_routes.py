from project.models import db
from project.routes.errors import blueprint
from project.routes.api.errors import error_response as api_error_response


@blueprint.app_errorhandler(404)
def not_found_error(error):
    return api_error_response(404)


@blueprint.app_errorhandler(500)
def internal_error(error):
    db.session.rollback()
    return api_error_response(500)