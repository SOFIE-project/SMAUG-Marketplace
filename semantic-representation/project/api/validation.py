from project.api import bp
from project.api.errors import bad_request, error_response
from project.models import Schema
from flask import request, jsonify, make_response
from werkzeug.exceptions import BadRequest
from functools import wraps
import jsonschema
import json
import ast


def validate_json(f):
    @wraps(f)
    def wrapper(*args, **kw):
        try:
            request.json
        except BadRequest:
            return bad_request("payload must be a valid json")
        return f(*args, **kw)
    return wrapper


@bp.route('/validate', methods=['POST'])
@validate_json
def validate_task():
    data = request.get_json() or {}
    if 'message' not in data or 'schema_name' not in data:
        return error_response('bad data input, must include message and schema name')
    # ToDo recursive?
    schema = Schema.query.filter_by(name=data['schema_name']).first()
    if schema is None:
        return error_response(404)
    if schema.extended is not None:
        extension = Schema.query.filter_by(name=schema.extended).first()
        if extension is None:
            return error_response(404)
        extension = json.loads(json.dumps(ast.literal_eval(extension.schema)))
        instance = json.loads(json.dumps(data['message']))
        try:
            jsonschema.validate(instance=instance, schema=extension)
        except (jsonschema.ValidationError, jsonschema.exceptions.SchemaError) as e:
            return error_response(400, e.message)
    # ToDo error handling
    schema = ast.literal_eval(schema.schema)
    schema = json.loads(json.dumps(schema))
    instance = json.loads(json.dumps(data['message']))
    try:
        jsonschema.validate(instance=instance, schema=schema)
    except (jsonschema.ValidationError, jsonschema.exceptions.SchemaError) as e:
        return bad_request(e.message)
    return make_response('', 204)





