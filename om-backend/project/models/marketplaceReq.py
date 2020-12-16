
import json
from project.models import db

class MarketplaceRequest(db.Model):
    __tablename__="marketplace_request"

    id = db.Column(db.BIGINT, nullable=False, primary_key=True)
    start_time = db.Column(db.BIGINT, nullable=False)
    end_time = db.Column(db.BIGINT, nullable=False)
    auction_min_price_per_slot = db.Column(db.BIGINT, nullable=False)
    instant_rent_rules = db.Column(db.String)
    locker_id = db.Column(db.BIGINT, db.ForeignKey("smart_locker.id"), nullable=False)
    status = db.Column(db.String, default="open")

    def __repr__(self):
        return f"Marketplace request {self.id} for locker {self.locker_id}: {self.status}"

    def set_status(self, status):
        if self.status == "decided":            # Do not update if a request is already decided
            return False
        self.status = status
        return True

class MarketplaceRequestListDeserializer():
    def decode(self, marketplace_request_details) -> MarketplaceRequest:
        properties = {
            "start_time": marketplace_request_details[1],
            "end_time": marketplace_request_details[1] + marketplace_request_details[2]*60000,
            "auction_min_price_per_slot": marketplace_request_details[3],
            "locker_id": marketplace_request_details[5]
        }
        if len(marketplace_request_details[4]) > 0:
            stringified_instant_rent_rules = [str(rule) for rule in marketplace_request_details[4]]
            properties["instant_rent_rules"] = ",".join(stringified_instant_rent_rules)
        return MarketplaceRequest(**properties)
