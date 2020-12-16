from project import db
from project.api import bp
from project.api.errors import bad_request, error_response
from flask import request, jsonify, Response
from project.models import Schema


@bp.route('/schema', methods=['POST'])
def add_schema():
    data = request.get_json() or {}
    if 'name' not in data or 'schema' not in data:
        return error_response(422, 'bad data input, must include schema and schema name')
    if Schema.query.filter_by(name=data['name']).first():
        return error_response(409, 'schema name already saved')
    if 'extended' in data:
        if not Schema.query.filter_by(name=data['extended']).first():
            return error_response(406, 'Extended schema not in the DB')
    schema = Schema()
    schema.from_dict(data)
    db.session.add(schema)
    db.session.commit()
    response = jsonify(schema.to_dict())
    response.status_code = 201
    return response


@bp.route('/schema/<int:id>', methods=['DELETE'])
def remove_schema(id):
    schema = Schema.query.filter_by(id=id).first()
    if schema is None:
        return error_response(404)
    db.session.delete(schema)
    db.session.commit()
    response = jsonify({'message': 'schema removed'})
    response.status_code = 201
    return response


@bp.route('/schema', methods=['PUT'])
def update_schema():
    data = request.get_json() or {}
    if 'name' not in data or 'schema' not in data:
        return error_response(422, 'bad data input, must include schema and schema name')
    schema = Schema.query.filter_by(name=data['name']).first()
    if schema is None:
        return error_response(404)
    schema.from_dict(data)
    db.session.commit()
    response = jsonify(schema.to_dict())
    response.status_code = 201
    return response


@bp.route('/schema/<int:id>', methods=['GET'])
def get_schema2(id):
    schema = Schema.query.get_or_404(id)
    return jsonify(schema.schema)


@bp.route('/schemas', methods=['GET'])
def get_schema_list():
    schemas = Schema.query.all()
    if schemas is None or len(schemas) is 0:
        return error_response(404)
    schemas_dict = {k: v for k, v in ((schema.id, schema.name) for schema in schemas)}
    response = jsonify(schemas_dict)
    response.status_code = 200
    return response

