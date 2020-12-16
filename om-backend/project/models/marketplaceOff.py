
import json
from project.models import db

class MarketplaceOffer(db.Model):
    __tablename__="marketplace_offer"

    id = db.Column(db.BIGINT, nullable=False, primary_key=True)
    start_time = db.Column(db.BIGINT)
    end_time = db.Column(db.BIGINT)
    offer_type = db.Column(db.BIGINT)
    price_offered = db.Column(db.BIGINT)
    offer_creator_encryption_key = db.Column(db.String)
    offer_creator_auth_key = db.Column(db.String)
    is_open = db.Column(db.BOOLEAN, default=False)
    request_id = db.Column(db.BIGINT, db.ForeignKey("marketplace_request.id"), nullable=False)

    def __repr__(self):
        return f"Marketplace offer {self.id} for request {self.request_id}: {self.price_offered} weis"

    @classmethod
    def new_offer(cls, offer_id, request_id):
        properties = {
            "id": offer_id,
            "request_id": request_id
        }
        return cls(**properties)

class MarketplaceOfferListDeserializer():
    def decode(self, marketplace_offer_details) -> MarketplaceOffer:
        properties = {
            "start_time": marketplace_offer_details[1],
            "end_time": marketplace_offer_details[2] + marketplace_offer_details[1]*60000,
            "offer_type": marketplace_offer_details[3],
            "price_offered": marketplace_offer_details[4],
            "offer_creator_encryption_key": hex(marketplace_offer_details[5]),
        }

        # Auth key can be null, and smart contract would return value 0.
        if (marketplace_offer_details[6] > 0):
            properties["offer_creator_auth_key"] = hex(marketplace_offer_details[6])
        return MarketplaceOffer(**properties)
