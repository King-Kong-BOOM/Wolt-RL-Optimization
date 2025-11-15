from flask import Flask
from flask_cors import CORS
from routes import routes, set_app_state
from appstate import AppState
from graph import Graph
from websocket_handler import set_app_state as set_ws_app_state

def create_app():
    app = Flask(__name__)
    # Enable CORS for all routes
    CORS(app, resources={r"/api/*": {"origins": "*"}})
    app.register_blueprint(routes)
    
    # Initialize app state with a default graph
    graph = Graph(num_nodes=6, num_edges=7, num_drivers=2)
    app_state = AppState(graph=graph)
    
    # Set app state in routes and websocket handler
    set_app_state(app_state)
    set_ws_app_state(app_state)
    
    return app, app_state

def main():
    app, app_state = create_app()
    
    # Try to use Flask-SocketIO for WebSocket support
    try:
        from flask_socketio import SocketIO
        socketio = SocketIO(app, cors_allowed_origins="*")
        
        # Register WebSocket handlers
        from websocket_handler import register_socketio_handlers
        register_socketio_handlers(socketio)
        
        # Start the server with SocketIO
        socketio.run(app, host='localhost', port=5000, debug=True)
    except ImportError:
        # Flask-SocketIO not available, fall back to regular Flask
        # WebSocket will not be available
        print("Warning: flask-socketio not installed. WebSocket support disabled.")
        print("Install with: pip install flask-socketio")
        app.run(host='localhost', port=5000, debug=True)

if __name__ == "__main__":
    main()