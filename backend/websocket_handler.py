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
is_training = False  # Flag to track training mode
training_update_counter = 0  # Counter for reduced updates during training
simulation_speed = 1.0  # Timesteps per second (default: 1 timestep per second)

def set_app_state(state):
    """Set the global app state instance."""
    global app_state
    app_state = state

def send_state_update():
    """Send state update via SocketIO to all connected clients."""
    global app_state, socketio_instance, is_training, training_update_counter
    
    if socketio_instance is None or app_state is None or app_state.graph is None:
        return
    
    # During training, skip state updates to save resources
    # Optionally send updates every 100 timesteps for progress tracking
    if is_training:
        training_update_counter += 1
        # Only send update every 100 timesteps during training (or disable completely)
        if training_update_counter % 100 != 0:
            return
    
    try:
        render_data = app_state.graph.get_render_data()
        message = {
            'type': 'state_update',
            'mode': 'training' if is_training else 'simulation',
            'data': render_data,
            'timestep': render_data.get('timestep', 0)
        }
        socketio_instance.emit('state_update', message)
    except Exception as e:
        print(f"Error sending state update: {e}")

def set_simulation_speed(speed: float):
    """Set the simulation speed (timesteps per second)."""
    global simulation_speed
    if speed > 0:
        simulation_speed = float(speed)
    else:
        simulation_speed = 0.1  # Minimum speed

def get_simulation_speed() -> float:
    """Get the current simulation speed."""
    return simulation_speed

def start_simulation_loop():
    """Start the simulation loop that sends periodic updates."""
    global simulation_running, app_state, simulation_speed
    
    if simulation_running:
        return  # Already running
    
    simulation_running = True
    
    def loop():
        global simulation_speed
        while simulation_running:
            if app_state and app_state.graph:
                # Advance simulation by one step
                app_state.time_step()
                # Send state update to all clients
                send_state_update()
            
            # Calculate sleep interval based on speed (timesteps per second)
            # If speed is 1.0, we want 1 timestep per second, so sleep 1.0 second
            # If speed is 2.0, we want 2 timesteps per second, so sleep 0.5 seconds
            # If speed is 0.5, we want 0.5 timesteps per second, so sleep 2.0 seconds
            update_interval = 1.0 / simulation_speed if simulation_speed > 0 else 1.0
            time.sleep(update_interval)
    
    global simulation_thread
    simulation_thread = threading.Thread(target=loop, daemon=True)
    simulation_thread.start()

def stop_simulation_loop():
    """Stop the simulation loop."""
    global simulation_running
    simulation_running = False

def set_training_mode(training: bool):
    """Set training mode flag to reduce/disable communication during training."""
    global is_training, training_update_counter
    is_training = training
    if not training:
        training_update_counter = 0  # Reset counter when training ends

def send_training_start_message(timestep: int):
    """Send training start message via WebSocket."""
    global socketio_instance
    if socketio_instance:
        socketio_instance.emit('state_update', {
            'type': 'training_start',
            'mode': 'training',
            'timestep': timestep
        })

def send_training_end_message(timestep: int):
    """Send training end message via WebSocket with final state."""
    global socketio_instance, app_state
    if socketio_instance and app_state and app_state.graph:
        try:
            render_data = app_state.graph.get_render_data()
            socketio_instance.emit('state_update', {
                'type': 'training_end',
                'mode': 'simulation',
                'timestep': timestep,
                'data': render_data
            })
        except Exception as e:
            print(f"Error sending training end message: {e}")

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
