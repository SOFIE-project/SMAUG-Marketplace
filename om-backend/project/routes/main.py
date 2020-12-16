from project.routes.auth import blueprint
from flask import render_template


@blueprint.route('/', methods=['GET', 'POST'])
@blueprint.route('/index', methods=['GET', 'POST'])
def index():
    return render_template('index.html', title='Home')