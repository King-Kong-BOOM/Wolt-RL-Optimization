from flask import Flask
from routes import routes

def create_app():
    app = Flask(__name__)
    app.register_blueprint(routes)
    return app

def main():
    app = create_app()
    app.run()

if __name__ == "__main__":
    main()