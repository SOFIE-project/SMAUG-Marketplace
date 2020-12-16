from project import db

MAX_SCHEMA_LEN = 2048
MAX_NAME_LEN = 40


class Schema(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(MAX_NAME_LEN), unique=True)
    schema = db.Column(db.String(MAX_SCHEMA_LEN))
    extended = db.Column(db.String(MAX_NAME_LEN), default=None)

    def __repr__(self):
        return '<Schema {}>'.format(self.name)

    def from_dict(self, data):
        for field in ['name', 'schema', 'extended']:
            if field in data:
                setattr(self, field, str(data[field]))

    def to_dict(self):
        data = {
            'id': self.id,
            'name': self.name,
            'schema': self.schema,
            'extended': self.extended
        }
        return data


'''class SchemaExtension(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(MAX_NAME_LEN), unique=True)
    extension = db.Column(db.String(MAX_SCHEMA_LEN))
    extended_schema = db.Column(db.String(MAX_NAME_LEN), db.ForeignKey(Schema.name))

    def __repr__(self):
        return '<Schema Extension {}>'.format(self.name)

    def from_dict(self, data):
        extension = str(data['extension'])
        name = str(data['extension']['$id'])
        extended = str(data['extended'])
        setattr(self, 'extension', extension)
        setattr(self, 'name', name)
        setattr(self, 'extended_schema', extended)

    def to_dict(self):
        data = {
            'id': self.id,
            'name': self.name,
            'extension': self.extension,
            'extended_schema': self.extended_schema
        }
        return data'''
