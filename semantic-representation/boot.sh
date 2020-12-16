#!/bin/bash

export FLASK_APP=run.py
export LC_ALL=C.UTF-8
export LANG=C.UTF-8

cd /var/semantic-representation/

flask db init
flask db migrate -m "init table"
flask db upgrade

python3 run.py