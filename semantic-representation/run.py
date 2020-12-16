from config import Config
from project import create_app
from waitress import serve

config = Config()
app = create_app(config)

if __name__ == '__main__':
    # Prod env
    serve(app, host=app.config['HOST'], port=app.config['PORT'])

    # Development env
    #app.run(debug=app.config['DEBUG'], host=app.config['HOST'], port=app.config['PORT'])
