class AppState:

    def __init__(self, graph=None, optimizer=None):
        self.graph = graph
        self.optimizer = optimizer
        # Represent whether the optimizer is in training mode. Mainly consideres wether to update the agent
        # values or not and wether to render or not.
        self.train = True 


    def time_step(self):
        """
        Advances the application state by one time step. This involves updating the graph and optimizer states.
        """
        
        if self.optimizer and self.graph:
            action = self.optimizer.get_action(self.graph)
            self.graph.do_action(action)
            self.graph.time_step()
            if self.train:
                self.optimizer.train_step(self.graph)