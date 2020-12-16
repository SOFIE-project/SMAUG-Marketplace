from flask import json
from flask_wtf import FlaskForm
from wtforms import StringField, SubmitField
from flask_babel import _, lazy_gettext as _l
from wtforms.validators import ValidationError, DataRequired, Length

smartlocker_owner_form_fields = ['name', 'did', 'verkey', 'address', 'description', 'url', 'logo', 'phone']


class RegistrationForm(FlaskForm):
    name = StringField(_l('name'), validators=[DataRequired()])
    address = StringField(_l('address'))
    description = StringField(_l('description'))
    url = StringField(_l('url'))
    logo = StringField(_l('logo'))
    phone = StringField(_l('phone'))
    did = StringField(_l('user DID'), validators=[DataRequired()])
    verkey = StringField(_l('user verkey'), validators=[DataRequired()])
    submit = SubmitField(_l('Register'))

    def to_dict(self):
        new_dict = {}
        for field in smartlocker_owner_form_fields:
            new_dict[str(field)] = getattr(self, field).data
        return new_dict


class LoginDiDForm(FlaskForm):
    name = StringField(_l('username'), validators=[DataRequired()])
    submit = SubmitField(_l('Get challenge'))


class LoginProofForm(FlaskForm):
    challenge = StringField()
    proof = StringField(_l('user proof'), validators=[DataRequired()])
    submit = SubmitField('Send Proof')