"""
WebSocket handler for real-time simulation state updates.
Uses Flask-SocketIO for WebSocket support.
"""
import json
import threading
import time

# Global app state instance (will be set by main.py)
app_state = None
simulation_thread = None
simulation_running = False
socketio_instance = None

def set_app_state(state):
    """Set the global app state instance."""
    global app_state
    app_state = state

def send_state_update():
    """Send state update via SocketIO to all connected clients."""
    global app_state, socketio_instance
    
    if socketio_instance is None or app_state is None or app_state.graph is None:
        return
    
    try:
        render_data = app_state.graph.get_render_data()
        message = {
            'type': 'state_update',
            'mode': 'simulation',
            'data': render_data,
            'timestep': render_data.get('timestep', 0)
        }
        socketio_instance.emit('state_update', message)
    except Exception as e:
        print(f"Error sending state update: {e}")

def start_simulation_loop(update_interval=0.1):
    """Start the simulation loop that sends periodic updates."""
    global simulation_running, app_state
    
    if simulation_running:
        return  # Already running
    
    simulation_running = True
    
    def loop():
        while simulation_running:
            if app_state and app_state.graph:
                # Advance simulation by one step
                app_state.time_step()
                # Send state update to all clients
                send_state_update()
            time.sleep(update_interval)
    
    global simulation_thread
    simulation_thread = threading.Thread(target=loop, daemon=True)
    simulation_thread.start()

def stop_simulation_loop():
    """Stop the simulation loop."""
    global simulation_running
    simulation_running = False

def register_socketio_handlers(socketio):
    """Register WebSocket event handlers with Flask-SocketIO."""
    global socketio_instance
    socketio_instance = socketio
    
    @socketio.on('connect')
    def handle_connect():
        print('WebSocket client connected')
        # Send initial state on connect
        send_state_update()
    
    @socketio.on('disconnect')
    def handle_disconnect():
        print('WebSocket client disconnected')
    
    @socketio.on('request_state')
    def handle_request_state():
        """Handle client request for current state."""
        send_state_update()
