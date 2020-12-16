import json.decoder
from project.models import db


class SmartLocker(db.Model):

    next_id = 1
    __tablename__="smart_locker"

    @classmethod
    def get_next_id(cls):
        return_value = cls.next_id
        cls.next_id += 1
        return return_value    

    id = db.Column(db.BIGINT, primary_key=True, default=get_next_id)
    name = db.Column(db.Text, nullable=False)
    description = db.Column(db.Text)
    lat = db.Column(db.Float, nullable=False)
    lon = db.Column(db.Float, nullable=False)
    loc_description = db.Column(db.Text)
    icon_image = db.Column(db.Text, nullable=False)
    additional_images = db.Column(db.Text)                     # Serialised JSON Array
    lock_mechanism = db.Column(db.Text, nullable=False)
    owner_id = db.Column(db.String, db.ForeignKey("smart_locker_owner.id"), nullable=False)

    chain_id = db.Column(db.Text)
    marketplace_smart_contract_address = db.Column(db.Text)

    def __repr__(self):
        return '<Smart locker %r>' % self.id


class SmartLockerJSONSerializer(json.encoder.JSONEncoder):
    def default(self, smart_locker: SmartLocker) -> {}:
        # Get the locker properties from the SQLAlchemy model, filter only the needed properties, and remove any None values.
        locker_properties = {property: smart_locker.__dict__[property] for property in {"name", "id", "description", "lat", "lon", "loc_description", "icon_image", "additional_images", "lock_mechanism", "owner_id"} if smart_locker.__dict__[property] is not None}
        marketplace_properties = {property: smart_locker.__dict__[property] for property in {"chain_id", "marketplace_smart_contract_address"} if smart_locker.__dict__[property] is not None}
        if locker_properties.get("additional_images") is not None:
            encoded_additional_images = locker_properties.pop("additional_images")
            locker_properties["additional_images"] = encoded_additional_images.split("\n")    # Definitely not safe. Used for testing, for now.
        lat = locker_properties.pop("lat")
        lon = locker_properties.pop("lon")
        locker_properties["location"] = {"lat": lat, "lon": lon}
        if (locker_properties.get("loc_description")):
            loc_description = locker_properties.pop("loc_description")
            locker_properties["location"]["additional_info"] = loc_description
        result = {"locker": locker_properties}
        if len(marketplace_properties) > 0:
            result["marketplace"] = marketplace_properties
        return result


class SmartLockerJSONDeserializer(json.decoder.JSONDecoder):
    def decode(self, smart_locker_json) -> SmartLocker: 
        properties = {
            "name": smart_locker_json.get("name"),
            "lat": smart_locker_json.get("location").get("lat"),
            "lon": smart_locker_json.get("location").get("lon"),
            "icon_image": smart_locker_json.get("icon_image"),
            "lock_mechanism": smart_locker_json.get("lock_mechanism"),
        }
        # Only include in the result dict values that are != than None.
        if smart_locker_json.get("description") is not None:
             properties["description"] = smart_locker_json.get("description")
        if smart_locker_json.get("location").get("additional_info") is not None:
            properties["loc_description"] = smart_locker_json.get("location").get("additional_info")
        if smart_locker_json.get("additional_images") is not None:
            properties["additional_images"] = "\n".join(smart_locker_json.get("additional_images"))
        return SmartLocker(**properties)
