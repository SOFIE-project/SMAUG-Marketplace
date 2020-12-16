# !/usr/bin/env python
from project import create_app, db
from config import Config, TestConfig # Import the custom configuration here if needed
import sys
import os
import unittest
import json
import requests
sys.path.append(".")


basedir = os.path.abspath(os.path.dirname(__file__))
staticdir = os.path.join(basedir, 'static/')


class SemanticRepresentationAPI(unittest.TestCase):

    def setUp(self):
        self.app = create_app(Config) # Select the custom configuration here, if needed
        self.baseurl = 'http://' + self.app.config['HOST'] + ':' + self.app.config['PORT']
        print('Test address: ', self.baseurl)
        self.schema_url = self.baseurl + '/api/schema'
        self.app_context = self.app.app_context()
        self.app_context.push()
        self.loadFile()
        db.create_all()

    def loadFile(self):
        with open(os.path.join(staticdir + 'test_schema.json')) as file:
            self.schemas = json.loads(file.read())
        with open(os.path.join(staticdir + 'valid_msg.json')) as file:
            self.valid_msg = json.loads(file.read())
        with open(os.path.join(staticdir + 'invalid_msg.json')) as file:
            self.invalid_msg = json.loads(file.read())
        with open(os.path.join(staticdir + 'schema_extension.json')) as file:
            self.schema_extension = json.loads(file.read())

    def tearDown(self):
        db.session.remove()
        db.drop_all()
        self.app_context.pop()

    '''
    The function add a schema into the SR component's DBs and tests if the schema is inserted correctly
    '''
    def test_add_schema(self):
        schema1 = {'name': self.schemas[0]['$id'], 'schema': self.schemas[0]}
        success = requests.post(self.schema_url, json=schema1)
        duplicate = requests.post(self.schema_url, json=schema1)
        bad_data_input = requests.post(self.schema_url, json={})
        # Run tests
        self.assertEqual(success.status_code, 201)
        self.assertEqual(json.loads(success.text)['schema'], str(schema1['schema']))
        self.assertEqual(duplicate.status_code, 409)
        self.assertEqual(json.loads(duplicate.text), json.loads('{ "error": "Conflict", "message": "schema name already saved"}'))
        self.assertEqual(bad_data_input.status_code, 422)
        self.assertEqual(json.loads(bad_data_input.text), json.loads('{ "error": "Unprocessable Entity", "message": "bad data input, must include schema and schema name"}'))
        # Remove entry
        self.remove_schemas()

    '''
    This function test the schema extension functionality. 
    
    The db is populated with a schema, then the test add a schema extension that refers to it and everything is expected
     to work.
    Then, the test tries to add a schema extension to a schema that does not exist in the db and the component is expect
    to notify that the schema to be extended does not exist
    '''
    def test_add_extension(self):
        # Add schema to be extended in the db
        schema_name = self.schemas[0]['$id']
        extended_schema = self.schemas[0]
        requests.post(self.schema_url, json={'name': schema_name, 'schema': extended_schema})
        # Add valid schema extension
        data = {'name': self.schema_extension['$id'], 'schema': self.schema_extension, 'extended': schema_name}
        response = requests.post(self.schema_url, json=data)

        self.assertEqual(response.status_code, 201)
        self.assertEqual(json.loads(response.text)['name'], self.schema_extension['$id'])
        self.assertEqual(json.loads(response.text)['schema'], str(self.schema_extension))
        # Add a not valid schema extension
        data = {'name': 'new schema extension', 'schema': self.schema_extension, 'extended': 'I dont exist'}
        response = requests.post(self.schema_url, json=data)
        self.assertEqual(response.status_code, 406)
        self.assertEqual(json.loads(response.text), json.loads('{"error": "Not Acceptable", "message": "Extended schema not in the DB"}'))
        # clean db for next tests
        self.remove_schemas()

    '''
    This function test the update schema functionality of the SR component. First a schema is added, then its updated 
    dynamically with a new schema version 
    '''
    def test_update_schema(self):
        data = {'name': self.schemas[0]['$id'], 'schema': self.schemas[0]}
        requests.post(self.schema_url, json=data)
        # Update schema
        data = {'name': self.schemas[0]['$id'], 'schema': self.schemas[1]}
        data2 = {'name': 'not_found', 'schema': self.schemas[1]}
        success = requests.put(self.schema_url, json=data)
        response_not_found = requests.put(self.schema_url, json=data2)
        response_data_empty = requests.put(self.schema_url, json={})

        self.assertEqual(success.status_code, 201)
        self.assertEqual(json.loads(success.text)['schema'], str(self.schemas[1]))
        self.assertEqual(json.loads(response_not_found.text), json.loads('{ "error": "Not Found"}'))
        self.assertEqual(response_data_empty.status_code, 422)
        self.assertEqual(json.loads(response_data_empty.text), json.loads('{ "error": "Unprocessable Entity", "message": "bad data input, must include schema and schema name"}'))
        # Remove entry
        self.remove_schemas()

    '''
    This function tests the remove schema functionality of the SR component. A schema is added to the SR component's DB then removed
    '''
    def test_remove_schema(self):
        # Add entry
        requests.post(url=self.schema_url, json={'name': self.schemas[0]['$id'], 'schema': self.schemas[0]})
        # There is only one entry in the test db, so the id is '1'
        success = requests.delete(url=self.baseurl + '/api/schema/1')
        not_found = requests.delete(url=self.baseurl + '/api/schema/2')

        self.assertEqual(success.status_code, 201)
        self.assertEqual(json.loads(success.text), json.loads('{"message": "schema removed"}'))
        self.assertEqual(not_found.status_code, 404)
        self.assertEqual(json.loads(not_found.text), json.loads('{ "error": "Not Found"}'))

    '''
    This function tests SR component get functionality.
    A schema is added to the component's db, then this schema is retrieved with a get request using its URL 
    '''
    def test_get_schema(self):
        # Add first and second schema
        requests.post(url=self.schema_url, json={'name': self.schemas[0]['$id'], 'schema': self.schemas[0]})
        requests.post(url=self.schema_url, json={'name': self.schemas[1]['$id'], 'schema': self.schemas[1]})
        success1 = requests.get(self.baseurl + '/api/schema/1')
        success2 = requests.get(self.baseurl + '/api/schema/2')
        not_found = requests.get(self.baseurl + '/api/schema/3')

        self.assertEqual(success1.status_code, 200)
        self.assertEqual(json.loads(success1.text), str(self.schemas[0]))
        self.assertEqual(success2.status_code, 200)
        self.assertEqual(json.loads(success2.text), str(self.schemas[1]))
        self.assertEqual(not_found.status_code, 404)
        self.assertEqual(json.loads(not_found.text), json.loads('{"error": "Not Found"}'))
        # Clean db
        self.remove_schemas()

    '''
    This test shows the message validation functionality of the SR component.
    First is added the schema to validate the messages against.
    A set of valid messages are validated against that 
    schema and the component informs that the messages are validated
    Then, a set of invalid messages are validated against the schema, in this case the component informs that 
    the messages are not valid and why they are not valid. 
    '''
    def test_api_validate(self):
        # Add schema
        requests.post(self.schema_url, json={'name': self.schemas[0]['$id'], 'schema': self.schemas[0]})
        # Valid msg
        url = self.baseurl + '/api/validate'
        for msg in self.valid_msg:
            valid = requests.post(url, json={'message': msg, 'schema_name': self.schemas[0]['$id']})
            self.assertEqual(valid.status_code, 204)
        # Not valid msg
        invalid_msg_assert = (
            '{"error": "Bad Request", "message": "\'lockerId\' is a required property"}',
            '{"error": "Bad Request", "message": "100 is greater than the maximum of 50"}',
            '{"error": "Bad Request", "message": "-5 is less than the minimum of 0"}'
        )
        for msg, inv_msg in zip(self.invalid_msg, invalid_msg_assert):
            not_valid = requests.post(url, json={'message': msg, 'schema_name': self.schemas[0]['$id']})
            self.assertEqual(not_valid.status_code, 400)
            self.assertEqual(json.loads(not_valid.content), json.loads(inv_msg))
        # Schema not found
        for msg in self.valid_msg:
            not_found = requests.post(url, json={'message': msg, 'schema_name': 'not_found'})
            self.assertEqual(not_found.status_code, 404)
            self.assertEqual(json.loads(not_found.content), json.loads('{"error": "Not Found"}'))
        # Clear DB for the next tests
        self.remove_schemas()

    '''
    This test shows how validation works on extended schemas. 
    A message is valid if its semantic defines the mandatory fields of the schema and if the values of all fields 
    (mandatory and not) are correct. If a message contains fields that are not defined in the schema, the message is valid.
    
    First, a valid messaged is validated against a schema extension and the extended schema, expecting valid results
    
    Second, a message is validated against a schema and its proven valid. The same message is validated against the 
    extended schema and its proven not valid. This because the message contains a field that is not correct, is not
     defined in the original schema, but is defined in its extension.
     
    A message to be proven valid against a schema extension must be valid for the original schema first. 
    '''
    def test_api_extended_validation(self):
        # Add schema
        requests.post(self.schema_url, json={'name': self.schemas[0]['$id'], 'schema': self.schemas[0]})

        # Add valid schema extension
        data = {'name': self.schema_extension['$id'], 'schema': self.schema_extension, 'extended': self.schemas[0]['$id']}
        requests.post(self.schema_url, json=data)

        url = self.baseurl + '/api/validate'

        # Validate the valid message
        valid_extension_mgs = json.loads(json.dumps({"lockerId": 1234, "price": 35, "volume": 15, "extended": 2}))
        response = requests.post(url, json={'message': valid_extension_mgs, 'schema_name': self.schema_extension['$id']})
        self.assertEqual(response.status_code, 204)

        # Invalid message for the extended schema (volume is required in the extended schema, not in the extension)
        not_valid_extension_mgs = json.loads(json.dumps({"lockerId": 1234, "price": 35, "extended": 2}))
        response = requests.post(url, json={'message': not_valid_extension_mgs, 'schema_name': self.schema_extension['$id']})
        self.assertEqual(response.status_code, 400)
        self.assertEqual(json.loads(response.text), json.loads('{"error": "Bad Request", "message": "\'volume\' is a required property"}'))

        # Invalid message for the schema extension (extension is required in the schema extension, not in the extended schema)
        extension_mgs = json.loads(json.dumps({"lockerId": 1234, "price": 35, "volume": 15}))
        data = {'message': extension_mgs, 'schema_name': self.schema_extension['$id']}
        response = requests.post(url, json=data)
        self.assertEqual(response.status_code, 400)
        self.assertEqual(json.loads(response.text), json.loads('{"error": "Bad Request", "message": "\'extended\' is a required property"}'))

        # Clear db for the next tests
        self.remove_schemas()

    def test_get_schemas(self):
        # Test no schema is found
        url = self.baseurl + '/api/schemas'
        not_found = requests.get(url)
        self.assertEqual(not_found.status_code, 404)
        self.assertEqual(json.loads(not_found.content), json.loads('{"error": "Not Found"}'))
        # Add 1st and 2d schema
        requests.post(url=self.schema_url, json= {'name': self.schemas[0]['$id'], 'schema': self.schemas[0]})
        requests.post(url=self.schema_url, json={'name': self.schemas[1]['$id'], 'schema': self.schemas[1]})
        # get all schemas on the db
        url = self.baseurl + '/api/schemas'
        response = requests.get(url)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(json.loads(response.content), json.loads('{"1":"http://smaugexample.com/schema.json","2":"http://smaugexample.com/schema2.json"}'))
        self.remove_schemas()

    def remove_schemas(self):
        schemas = requests.get(url=self.baseurl + '/api/schemas')
        schemas = json.loads(schemas.content)
        for key in schemas.keys():
            response = requests.delete(url=self.baseurl+'/api/schema/'+key)
            if response.status_code is not 201:
                print(json.loads(response.content))


def add_schemas(url, schemas):
    for schema in schemas:
        data = {'name': schema['$id'], 'schema': schemas}
        requests.post(url, json=data)


if __name__ == '__main__':
    unittest.main(verbosity=2)