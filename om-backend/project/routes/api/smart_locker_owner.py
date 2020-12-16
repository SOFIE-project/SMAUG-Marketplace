import flask
from project.routes.api import blueprint
from project.routes.api.errors import bad_request, error_response


@blueprint.route("/owners/<owner_id>", methods=["GET"])
def get_owner_details(owner_id: str):
    from project.models.smartLockerOwner import SmartLockerOwner, SmartLockerOwnerJSONSerializer
    smart_locker_owner = SmartLockerOwner.query.get(owner_id)
    if smart_locker_owner is None:
        return error_response(404)
    response: flask.Response = flask.jsonify(SmartLockerOwnerJSONSerializer().default(smart_locker_owner))
    response.status_code = 200
    return response