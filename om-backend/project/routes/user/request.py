from datetime import datetime
from flask import render_template, request, json, redirect, url_for, session
from flask_babel import _
from flask_login import current_user
from project.models.smartLocker import SmartLocker
from project.routes.user import blueprint
from project.routes.user.form import RequestForm, OfferSelectionForm

from project import app_config as config

TIMESTAMP_FORMAT = '%d.%m.%Y %H:%M'


class BasicRequest:
    def __init__(self, request_id, status, duration, amount):
        self.request_id = request_id
        self.status = status
        self.duration = duration
        self.amount = amount


class DetailedRequest:
    def __init__(self, request_id, req, req_extra, offers):
        self.request_id = request_id
        self.locker_id = req_extra[-1]
        self.deadline = datetime.fromtimestamp(req[1]).strftime(TIMESTAMP_FORMAT)
        self.start_of_rent = datetime.fromtimestamp(req_extra[1]).strftime(TIMESTAMP_FORMAT)
        self.end_of_rent = datetime.fromtimestamp(req_extra[1] + req_extra[2]).strftime(TIMESTAMP_FORMAT)
        self.cost_per_minute = req_extra[3]
        instant_rent_rules = []
        for i in range(0, len(req_extra[4]) - 1, 2):
            instant_rent_rules.append([req_extra[4][i], req_extra[4][i+1]])
        self.instant_rent_rules = instant_rent_rules
        self.offers = offers


class Offer:
    def __init__(self, offer_id, start_time, duration, price_offered, encryption_key, authentication_key, accepted=False):
        self.id = offer_id
        self.start_time = datetime.fromtimestamp(start_time).strftime(TIMESTAMP_FORMAT)
        self.duration = duration
        self.price_offered = price_offered
        self.encryption_key = encryption_key
        self.authentication_key = authentication_key
        self.accepted = accepted


@blueprint.route('/requests', methods=['GET'])
def get_requests():
    if not current_user.is_authenticated:
        return redirect(url_for('auth.login'))

    from project.web3 import marketplace_sc
    request_ids = []
    user_lockers = SmartLocker.query.filter_by(owner_id=current_user.__dict__.get("id")).all()
    for locker in user_lockers:
        from project.routes.api.smart_locker import get_locker_open_requests
        locker_requests_response = get_locker_open_requests(locker.id)
        if locker_requests_response.status_code == 200:
            response_data = locker_requests_response.get_json()
            for status in ['open', 'decided', 'closed']:
                for request_id in response_data.get(status):
                    request_details = marketplace_sc.functions.getRequest(request_id).call()
                    if request_details[3] == config.USER_ETHEREUM_ADDRESS:
                        request_ids.append(request_id)

    requests = []
    for request_id in request_ids:
        req = marketplace_sc.functions.getRequest(request_id).call()
        if req[0] == 0:
            req_details = marketplace_sc.functions.getRequestExtra(request_id).call()
            requests.append(BasicRequest(request_id, req_details[0], req_details[2], req_details[3]))

    details_path_prefix = url_for('.get_requests')
    return render_template('request/requests.html', details_path_prefix=details_path_prefix, requests=requests)


@blueprint.route('/requests/<int:id>', methods=['GET', 'POST'])
def request_details(id):
    if not current_user.is_authenticated:
        return redirect(url_for('auth.login'))

    from project.web3 import marketplace_sc
    req = marketplace_sc.functions.getRequest(id).call()
    req_extra = marketplace_sc.functions.getRequestExtra(id).call()

    offers = []
    for offer_id in marketplace_sc.functions.getRequestOfferIDs(id).call()[1]:
        offer_extra = marketplace_sc.functions.getOfferExtra(offer_id).call()
        enc_key_hex = hex(offer_extra[5])
        enc_key_short = '{}...{}'.format(enc_key_hex[:10], enc_key_hex[len(enc_key_hex)-10:])
        offers.append(Offer(offer_id, offer_extra[1], offer_extra[2], offer_extra[4], enc_key_short, offer_extra[6]))

    request_details = DetailedRequest(id, req, req_extra, offers)

    form = OfferSelectionForm(request_details=request_details)
    if form.validate_on_submit():
        selected = [int(i) for i in request.form.getlist('select')]
        marketplace_sc.functions.decideRequest(id, selected).transact({"from": config.USER_ETHEREUM_ADDRESS, "gas": 2000000, "gasPrice": 1})

    allow_offer_selection = len(offers) > 0
    accepted_offers = marketplace_sc.functions.getRequestDecision(id).call()
    for offer in request_details.offers:
        if offer.id in accepted_offers[1]:
            offer.accepted = True
            allow_offer_selection = False

    return_url = url_for('.get_requests')
    return render_template('request/request_details.html', details=request_details, allow_offer_selection=allow_offer_selection, offer_selection_form=form, return_url=return_url)


@blueprint.route('/create_request', methods=['GET', 'POST'])
def create_request():
    if not current_user.is_authenticated:
        return redirect(url_for('auth.login'))

    selected_locker_id = request.args.get('locker')
    lockers = SmartLocker.query.filter_by(owner_id=current_user.__dict__.get("id")).all()

    rules = []
    form = RequestForm(instant_rent_rules=rules)
    form.locker_id.choices = [(locker.id, locker.name) for locker in lockers]
    if form.validate_on_submit():

        from project.routes.user.token import _fetch_token
        token = json.loads(_fetch_token(config.USER_ETHEREUM_ADDRESS))

        from project.web3 import marketplace_sc
        deadline = datetime.combine(form.deadline_date.data, form.deadline_time.data).timestamp()
        contract = marketplace_sc.functions.submitAuthorisedRequest(token.get('digest'), token.get('signature'), token.get('nonce'), int(deadline))
        tx_hash = contract.transact({"from": config.USER_ETHEREUM_ADDRESS, "gas": 2000000, "gasPrice": 1})

        from project.web3 import web3_instance
        receipt = web3_instance.eth.getTransactionReceipt(tx_hash)

        duration = datetime.combine(form.end_date.data, form.end_time.data).timestamp() - datetime.combine(form.start_date.data, form.start_time.data).timestamp()
        start_time_epoch = datetime.combine(form.start_date.data, form.start_time.data).timestamp()
        instant_rent_rules = []
        for rule in form.instant_rent_rules:
            instant_rent_rules.append(rule.time.data)
            instant_rent_rules.append(rule.value.data)
        request_data = [int(start_time_epoch), int(duration), form.cost_per_minute.data]
        request_data += instant_rent_rules
        request_data.append(form.locker_id.data)
        request_id = marketplace_sc.events.RequestAdded().processReceipt(receipt)[0].args.requestID
        marketplace_sc.functions.submitRequestArrayExtra(request_id, request_data).transact({"from": config.USER_ETHEREUM_ADDRESS, "gas": 2000000, "gasPrice": 1})
        return redirect(url_for('.request_details', id=request_id))

    forward_path = url_for('user.get_lockers') if selected_locker_id else url_for('.get_requests')
    return render_template('request/create_request.html', title=_('Create request'), lockers=lockers, selected_locker=selected_locker_id, forward_path=forward_path, form=form)


