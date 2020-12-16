from flask_wtf import FlaskForm
from wtforms import StringField, SubmitField, FloatField, SelectField, FieldList, FormField, BooleanField
from flask_babel import _, lazy_gettext as _l
from wtforms.fields.html5 import IntegerField, DateField, TimeField
from wtforms.validators import DataRequired

lock_mechanism_data = ['push-to-lock', 'other']


class SmartLockerForm(FlaskForm):
    name = StringField(_l('name'), validators=[DataRequired()])
    description = StringField(_l('description'))
    latitude = FloatField(_l('latitude'), validators=[DataRequired()])
    longitude = FloatField(_l('longitude'), validators=[DataRequired()])
    loc_description = StringField(_l('loc description'))
    icon_image = StringField(_l('icon image'), validators=[DataRequired()])
    additional_images = StringField(_l('additional images'))
    lock_mechanism = SelectField('lock mechanism', choices=lock_mechanism_data)
    submit = SubmitField(_l('Add SmartLocker'))


class InstantRuleForm(FlaskForm):
    time = IntegerField('Time')
    value = IntegerField('Value')


class RequestForm(FlaskForm):
    locker_id = SelectField('Locker ID', coerce=int)
    start_date = DateField('Start date')
    start_time = TimeField('Start time')
    end_date = DateField('End date')
    end_time = TimeField('End time')
    deadline_date = DateField('Deadline date')
    deadline_time = TimeField('Deadline date')
    cost_per_minute = IntegerField('Cost per minute')
    instant_rent_rules = FieldList(FormField(InstantRuleForm), label='Add new rule', min_entries=2, max_entries=2)

    submit = SubmitField(_l('Create request'))


class OfferSelectionForm(FlaskForm):
    id = IntegerField('Offer id')
    select = BooleanField('Select')
