from flask import render_template, redirect, json, flash, url_for, request
from project.routes.auth import blueprint
from project.routes.auth.form import LoginDiDForm, LoginProofForm, RegistrationForm
from project.routes.api.authorization import challenge_token, issue_token, user_registration
from flask_babel import _
from flask_login import login_user, current_user, logout_user
from project.models import db
from project.models.smartLockerOwner import SmartLockerOwner


@blueprint.route('/registration', methods=['GET', 'POST'])
def registration():
    if current_user.is_authenticated:
        return redirect(url_for('auth.index'))
    form = RegistrationForm()
    if form.validate_on_submit():
        form_data = form.to_dict()
        response = user_registration(form_data)
        print(response.data)
        if response.status_code is 200:
            flash(_('Registration successful '))
            return redirect(url_for('auth.index'))
        else:
            message = 'Registration problem: ' + json.loads(response.data)['message']
            flash(_(message))
            return redirect(url_for('auth.login'))
    return render_template('auth/auth_basic.html', title=_('Registration'), form=form)


@blueprint.route('/login', methods=['GET', 'POST'])
def login():
    if current_user.is_authenticated:
        return redirect(url_for('auth.index'))
    form = LoginDiDForm()
    if form.validate_on_submit():
        username = form.name.data
        user = SmartLockerOwner.query.filter_by(name=username).first()
        if user is None:
            flash(_('User not found'))
            return redirect(url_for('auth.login'))
        challenge_response = challenge_token({'did': user.did})
        if challenge_response.status_code is 200:
            challenge = json.loads(challenge_response.data)['message']
            flash(_(challenge))
            user_data = {
                'name': user.name,
                'did': user.did,
                'challenge': challenge
            }
            return redirect(url_for('auth.proof', json=json.dumps(user_data)), code=307)
        else:
            flash(_('Invalid did'))
            return redirect(url_for('auth.login'))
    return render_template('auth/auth_basic.html', title=_('Login Did'), form=form)


@blueprint.route('/login_proof', methods=['POST'])
def proof():
    if current_user.is_authenticated:
        return redirect(url_for('auth.index'))
    data = request.get_json() or request.args.to_dict()['json'] or {}
    data = json.loads(data)
    if 'did' not in data or 'challenge' not in data or 'name' not in data:
        flash(_('invalid proof'))
        return redirect(url_for('auth.login'))
    form = LoginProofForm()
    form.challenge.data = data['challenge']
    if form.validate_on_submit():
        token_data = {
            'did': data['did'],
            'challenge': data['challenge'],
            'proof': form.proof.data
        }
        token_response = issue_token(json.loads(json.dumps(token_data)))
        if token_response.status_code is not 200:
            print(token_response.json)
            flash('User not recognized')
            return redirect(url_for('auth.login'))
        user = SmartLockerOwner.query.filter_by(name=data['name']).first()
        login_user(user)
        flash('User logged')
        return redirect(url_for('auth.login'))
    return render_template('auth/auth_basic.html', title='Login Proof', form=form)


@blueprint.route('/logout')
def logout():
    logout_user()
    return redirect(url_for('auth.index'))
