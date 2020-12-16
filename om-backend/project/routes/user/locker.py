from flask import render_template, url_for, redirect
from flask_login import current_user
from flask_babel import _
from project.routes.user import blueprint
from project.routes.user.form import SmartLockerForm
from project.models.smartLocker import SmartLocker, SmartLockerJSONSerializer, SmartLockerJSONDeserializer
from project.models import db

@blueprint.route('/user_lockers', methods=['GET'])
def get_lockers():
    if not current_user.is_authenticated:
        return redirect(url_for('auth.login'))
    lockers = SmartLocker.query.filter_by(owner_id=current_user.__dict__.get("id")).all()
    serial_lockers = []
    for locker in lockers:
        serial_lockers.append(SmartLockerJSONSerializer().default(locker))
    return render_template('locker/lockers.html', lockers=serial_lockers)


@blueprint.route('/lockers/<locker_id>', methods=['GET'])
def get_locker(locker_id):
    if not current_user.is_authenticated:
        return redirect(url_for('auth.login'))
    locker = SmartLocker.query.get(locker_id)
    locker = SmartLockerJSONSerializer().default(locker)
    return render_template('locker/locker_details.html', details=locker)


@blueprint.route('/add_locker/', methods=['GET', 'POST'])
def add_locker():
    if not current_user.is_authenticated:
        return redirect(url_for('auth.login'))
    form = SmartLockerForm()
    if form.validate_on_submit():
        properties = {
            "name": form.name.data,
            "location": {
                "lat": form.latitude.data,
                "lon": form.longitude.data
            },
            "icon_image": form.icon_image.data,
            "lock_mechanism": form.lock_mechanism.data,
        }
        smart_locker = SmartLockerJSONDeserializer().decode(properties)
        smart_locker.owner_id = current_user.__dict__.get("id")
        #ToDo check if the user has the same named locker in the db
        db.session.add(smart_locker)
        db.session.commit()
        return redirect(url_for('user.get_lockers'))
    return render_template('locker/add_locker.html', title=_('Add SmartLocker'), form=form)
