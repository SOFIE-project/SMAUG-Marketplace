import uuid, json.encoder
from project.models import db, smartLocker, login
from flask_login import UserMixin
from flask_serialize import FlaskSerializeMixin

FlaskSerializeMixin.db = db

smartlocker_owner_fields = ['name', 'did', 'address', 'description', 'url', 'logo', 'phone']


class SmartLockerOwner(UserMixin, db.Model, FlaskSerializeMixin):

    __tablename__="smart_locker_owner"

    id = db.Column(db.String, primary_key=True, default=lambda: uuid.uuid4().hex)
    did = db.Column(db.String)
    name = db.Column(db.String, nullable=False)
    address = db.Column(db.String)
    description = db.Column(db.String)
    url = db.Column(db.String)
    logo = db.Column(db.Text)
    phone = db.Column(db.String)
    smart_lockers = db.relationship("SmartLocker", backref="smart_locker", lazy=True)
    authenticated = db.Column(db.Boolean, default=False)

    def __repr__(self):
        return '<Smart locker owner %r>' % self.id

    def from_dict(self, data):
        data = json.loads(json.dumps(data))
        for field in smartlocker_owner_fields:
            if field in data:
                setattr(self, field, str(data[field]))

    def is_active(self):
        """True, as all users are active."""
        return True

    def get_id(self):
        """Return the email address to satisfy Flask-Login's requirements."""
        return self.id

    def is_authenticated(self):
        """Return True if the user is authenticated."""
        return self.authenticated

    def is_anonymous(self):
        """False, as anonymous users aren't supported."""
        return False



@login.user_loader
def load_user(id):
    return SmartLockerOwner.query.get(id)


class SmartLockerOwnerJSONSerializer(json.encoder.JSONEncoder):
    def default(self, owner: SmartLockerOwner) -> {}:
        # Get the locker owner properties from the SQLAlchemy model, filter only the needed properties, and remove any None values.
        locker_owner_properties = {property: owner.__dict__[property] for property in {"name", "id", "description", "address", "url", "logo", "phone"} if owner.__dict__[property] is not None}
        locker_owner_properties["locker_ids"] = [locker.id for locker in owner.smart_lockers]
        return locker_owner_properties