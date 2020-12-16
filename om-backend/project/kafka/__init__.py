from requests.api import request
from project.models.marketplaceReq import MarketplaceRequest
from flask import Flask
from kafka import KafkaConsumer
import json, logging

# From https://stackoverflow.com/a/53294319/4048201

_logger: logging.Logger

def init_app(app: Flask):
    global _logger
    _logger = app.logger

    import threading

    server_urls = [app.config.get("MARKETPLACE_BROKER_URL")] if app.config.get("MARKETPLACE_BROKER_URL") is not None else []

    if len(server_urls) == 0:
        _logger.debug("No Kafka URL passed. Kafka consumer not started.")
        return
    
    topic_name = app.config.get("MARKETPLACE_BROKER_TOPIC")
    consumer = KafkaConsumer(topic_name, bootstrap_servers=server_urls)
    
    _logger.info(f"Kafka consumer started for {topic_name} on {server_urls[0]}")

    t1 = threading.Thread(target=_poll_kafka_broker, args=[app, consumer], daemon=True)
    t1.start()

def _poll_kafka_broker(app: Flask, consumer: KafkaConsumer):
    consumer.poll(timeout_ms=1000)
    for msg in consumer:
        _message_handler(msg, app)

def _message_handler(data, app):
    serialised_data = json.loads(data.value)
    event_name = serialised_data["details"]["name"]

    _logger.debug(f"Event name: {event_name}")

    if event_name == "RequestExtraAdded":
        _logger.info(f"Adding new request to DB...")
        request_id = serialised_data["details"]["nonIndexedParameters"][0]["value"]
        _logger.debug(f"Request ID: {request_id}")
        request_details = _fetch_request_details(request_id)
        _save_request_state(app, request_id, request_details)
    elif event_name == "RequestClosed":
        _logger.info(f"Marking request as closed...")
        request_id = serialised_data["details"]["nonIndexedParameters"][0]["value"]
        _logger.debug(f"Request ID: {request_id}")        
        _update_request_status(app, request_id, "closed")
    elif event_name == "RequestDecided":
        _logger.info(f"Marking request as decided...")
        request_id = serialised_data["details"]["nonIndexedParameters"][0]["value"]
        _logger.debug(f"Request ID: {request_id}")        
        _update_request_status(app, request_id, "decided")
    elif event_name == "OfferAdded":
        _logger.info(f"Adding new offer to DB...")
        offer_id = serialised_data["details"]["nonIndexedParameters"][0]["value"]
        request_id = serialised_data["details"]["nonIndexedParameters"][1]["value"]
        _logger.debug(f"Offer ID: {offer_id}")
        _save_new_offer(app, offer_id, request_id)
    elif event_name == "OfferExtraAdded":
        _logger.info(f"Adding new offer extra to DB...")
        offer_id = serialised_data["details"]["nonIndexedParameters"][0]["value"]
        _logger.debug(f"Offer ID: {offer_id}")
        offer_details = _fetch_offer_details(offer_id)
        _save_offer_state(app, offer_id, offer_details)

def _fetch_request_details(request_id: str):
    from project.web3 import marketplace_sc
    request_details = marketplace_sc.functions.getRequestExtra(request_id).call()
    locker_id = request_details[-1]
    _logger.debug(request_details)
    _logger.info(f"Locker ID for request {request_id}: {locker_id}.")
    return request_details

def _save_request_state(app: Flask, request_id, request_details):
    from project.models import db
    from project.models.marketplaceReq import MarketplaceRequestListDeserializer

    marketplace_request = MarketplaceRequestListDeserializer().decode(request_details)

    with app.app_context():
        existing_marketplace_request = MarketplaceRequest.query.get(request_id)

    if existing_marketplace_request is not None:
        _logger.error("Trying to save a request that was already present in the DB.")
        return
    
    marketplace_request.id = request_id
    with app.app_context():
        db.session.add(marketplace_request)
        db.session.commit()
        _logger.info(f"Request {marketplace_request.id} added to db.")

def _update_request_status(app: Flask, request_id, request_status):
    from project.models import db

    with app.app_context():
        existing_marketplace_request = MarketplaceRequest.query.get(request_id)
        if existing_marketplace_request is None:
            _logger.warning(f"No request with ID {request_id} was updated.")
        else:
            if existing_marketplace_request.set_status(request_status):
                db.session.commit()
                _logger.info(f"Request with ID {request_id} set to {request_status}.")
            else:
                _logger.warning(f"State for request with ID {request_id} not changed.")

def _save_new_offer(app:Flask, offer_id, request_id):
    from project.models import db
    from project.models.marketplaceOff import MarketplaceOffer

    marketplace_offer = MarketplaceOffer.new_offer(offer_id, request_id)

    with app.app_context():
        existing_marketplace_offer = MarketplaceOffer.query.get(offer_id)

    if existing_marketplace_offer is not None:
        _logger.error("Trying to save a offer that was already present in the DB.")
        return
    
    with app.app_context():
        db.session.add(marketplace_offer)
        db.session.commit()
        _logger.info(f"Offer {offer_id} added to db.")


def _fetch_offer_details(offer_id: str):
    from project.web3 import marketplace_sc
    offer_details = marketplace_sc.functions.getOfferExtra(offer_id).call()
    _logger.debug(offer_details)
    return offer_details

def _save_offer_state(app: Flask, offer_id, offer_status):
    from project.models import db
    from project.models.marketplaceOff import MarketplaceOfferListDeserializer, MarketplaceOffer

    marketplace_offer_with_extra = MarketplaceOfferListDeserializer().decode(offer_status)

    with app.app_context():
        existing_marketplace_offer = MarketplaceOffer.query.get(offer_id)

    if existing_marketplace_offer is None:
        _logger.error("Trying to save extra for an offer that is not present in the DB.")
        return
    
    # From https://www.michaelcho.me/article/sqlalchemy-commit-flush-expire-refresh-merge-whats-the-difference
    with app.app_context():
        marketplace_offer_with_extra.id = offer_id
        db.session.merge(marketplace_offer_with_extra)
        db.session.commit()
        _logger.info(f"Offer {offer_id} extra added to db.")