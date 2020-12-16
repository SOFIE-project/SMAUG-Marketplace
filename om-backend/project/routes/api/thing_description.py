import flask
from project import app_config
from project.routes.api import blueprint
from project.routes.api.errors import bad_request, error_response


@blueprint.route("/td/<locker_id>", methods=["GET"])
def get_thing_description(locker_id: int):
    from project.models.smartLocker import SmartLocker
    smart_locker = SmartLocker.query.get(locker_id)
    if smart_locker is None:
        return error_response(404)
    import json, os
    from project.routes.api.smart_locker import get_locker_details
    td_path = app_config.TD_PATH
    with open(td_path, "r") as td_file: 
        td = json.load(td_file)
    locker_details_endpoint_url = flask.url_for("api.{}".format(get_locker_details.__name__), locker_id=locker_id)
    td["properties"]["lockerDetails"]["href"] = locker_details_endpoint_url
    response = flask.jsonify(td)
    response.status_code = 200
    response.content_type = "application/ld+json"
    return response
