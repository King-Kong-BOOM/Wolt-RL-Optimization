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
        
        Note: During training with SB3, actions are handled by env.step() internally,
        so we should not call get_action() here during training.
        """
        
        if self.graph:
            # If optimizer exists and NOT in training mode, get action and apply it
            # During training, SB3's learn() handles actions through env.step()
            if self.optimizer and not self.train:
                action = self.optimizer.get_action(self.graph)
                if action is not None:
                    self.graph.do_action(action)
            
            # Always advance graph time step (regardless of optimizer presence)
            self.graph.time_step()
            
            # train_step is not used with SB3's learn() method, which handles training internally
            # Only use train_step for custom training loops
            # if self.optimizer and self.train:
            #     self.optimizer.train_step(self.graph)
    
    def apply_action(self, action):
        """
        Applies a manual action (e.g., from user input) to the graph.
        This uses the same code path as optimizer actions through graph.do_action().
        
        Args:
            action: Action to apply (dict, np.ndarray, or other format supported by graph.do_action)
        """
        if self.graph:
            self.graph.do_action(action)