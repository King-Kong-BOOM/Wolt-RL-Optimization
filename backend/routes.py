from flask import Blueprint, request


"""
This module defines the routes Blueprint for the Flask application.

This module basically defines the user interface endpoints for interacting with the backend.

This module should include features for:

- Retrieving the current state of the graph, drivers, and orders when the simulation is running.
  This should probably be implemented using websockets for real-time updates.

- Sending commands to start, stop, and reset the simulation. Can be probably be implemented using simple HTTP POST (or GET)
  requests as these are not real-time commands.

- Configuring the simulation setting such as number of drivers, order distribution, optimizer settings, etc. Altough these are
  probably only modifed before starting the simulation so they can also be implemented using simple HTTP requests.

- Functionality for saving and loading simulation states. This can be useful for debugging and testing different optimizer strategies
  Also when showing the simulation to others we dont have to train from scratch each time.

- Also perhaps some route for retrieving statistics for the performance of the optimizer over time such as average delivery time.

"""

routes = Blueprint("routes", __name__)