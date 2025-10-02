class WebSocketClient {
    constructor() {
        this.ws = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectInterval = 3000;
        this.messageHandlers = new Map();
        this.connectionPromise = null;
        this.pingInterval = null;
        this.connectionTimeout = null;
    }

    connect(token) {
        if (this.connectionPromise) {
            return this.connectionPromise;
        }

        this.connectionPromise = new Promise((resolve, reject) => {
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                resolve();
                return;
            }

            if (this.ws) {
                this.ws.close();
            }

            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const wsUrl = import.meta.env.MODE === 'development'
                ? 'ws://localhost:3000/realtime?token=${encodeURIComponent(token)}'
                : `${protocol}//${window.location.host}/realtime?token=${encodeURIComponent(token)}`;
            
            console.log('🔗 Connecting to WebSocket:', wsUrl);
            this.ws = new WebSocket(wsUrl);

            // Set connection timeout
            this.connectionTimeout = setTimeout(() => {
                if (this.ws && this.ws.readyState !== WebSocket.OPEN) {
                    console.error('WebSocket connection timeout');
                    this.ws.close();
                    reject(new Error('Connection timeout'));
                }
            }, 10000);

            this.ws.onopen = () => {
                console.log('✅ WebSocket connected successfully');
                clearTimeout(this.connectionTimeout);
                this.reconnectAttempts = 0;
                this.connectionPromise = null;
                
                // Start ping interval to keep connection alive
                this.startPingInterval();
                
                resolve();
            };

            this.ws.onmessage = (event) => {
                try {
                    const message = JSON.parse(event.data);
                    console.log('📨 WebSocket message received:', message);
                    this.handleMessage(message);
                } catch (error) {
                    console.error('❌ Error parsing WebSocket message:', error);
                    this.handleMessage({ 
                        type: 'error', 
                        payload: { 
                            message: 'Invalid message format',
                            error: error.message 
                        } 
                    });
                }
            };

            this.ws.onclose = (event) => {
                console.log('🔴 WebSocket disconnected:', event.code, event.reason);
                clearTimeout(this.connectionTimeout);
                this.stopPingInterval();
                this.connectionPromise = null;
                
                // Only attempt reconnection for unexpected closures
                if (event.code !== 1000 && this.reconnectAttempts < this.maxReconnectAttempts) {
                    this.handleReconnection(token);
                } else {
                    this.handleMessage({
                        type: 'connection-lost',
                        payload: { 
                            message: 'Connection lost',
                            code: event.code,
                            reason: event.reason
                        }
                    });
                }
            };

            this.ws.onerror = (error) => {
                console.error('❌ WebSocket error:', error);
                clearTimeout(this.connectionTimeout);
                this.connectionPromise = null;
                reject(new Error('WebSocket connection failed'));
            };
        });

        return this.connectionPromise;
    }

    startPingInterval() {
        // Clear existing interval
        this.stopPingInterval();
        
        // Send ping every 30 seconds to keep connection alive
        this.pingInterval = setInterval(() => {
            if (this.isConnected) {
                this.send({ type: 'ping', timestamp: Date.now() });
            }
        }, 30000);
    }

    stopPingInterval() {
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
            this.pingInterval = null;
        }
    }

    handleReconnection(token) {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            const delay = this.reconnectInterval * Math.pow(2, this.reconnectAttempts); // Exponential backoff
            setTimeout(() => {
                this.reconnectAttempts++;
                console.log(`🔄 Attempting WebSocket reconnection (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
                this.connect(token).catch(error => {
                    console.warn('Reconnection attempt failed:', error);
                });
            }, delay);
        } else {
            console.error('❌ Max reconnection attempts reached');
            this.handleMessage({
                type: 'connection-lost',
                payload: { message: 'Max reconnection attempts reached. Please refresh the page.' }
            });
        }
    }

    disconnect() {
        console.log('🛑 Disconnecting WebSocket...');
        this.reconnectAttempts = this.maxReconnectAttempts; 
        this.stopPingInterval();
        clearTimeout(this.connectionTimeout);
        
        if (this.ws) {
            this.ws.close(1000, 'Manual disconnect');
            this.ws = null;
        }
        this.connectionPromise = null;
    }

    send(message) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            try {
                this.ws.send(JSON.stringify(message));
                console.log('📤 WebSocket message sent:', message);
                return true;
            } catch (error) {
                console.error('❌ Error sending WebSocket message:', error);
                return false;
            }
        } else {
            console.warn('⚠️ WebSocket not connected, cannot send message');
            return false;
        }
    }

    on(messageType, handler) {
        if (!this.messageHandlers.has(messageType)) {
            this.messageHandlers.set(messageType, []);
        }
        this.messageHandlers.get(messageType).push(handler);
        console.log(`📝 Registered handler for: ${messageType}`);
    }

    off(messageType, handler) {
        const handlers = this.messageHandlers.get(messageType);
        if (handlers) {
            const index = handlers.indexOf(handler);
            if (index > -1) {
                handlers.splice(index, 1);
            }
        }
    }

    handleMessage(message) {
        const handlers = this.messageHandlers.get(message.type) || [];
        console.log(`🔄 Dispatching ${message.type} to ${handlers.length} handlers`);
        handlers.forEach(handler => {
            try {
                handler(message.payload || message);
            } catch (error) {
                console.error(`❌ Error in WebSocket message handler for ${message.type}:`, error);
            }
        });

        // Also call handlers for 'message' to catch all messages
        if (message.type !== 'message') {
            const allHandlers = this.messageHandlers.get('message') || [];
            allHandlers.forEach(handler => {
                try {
                    handler(message);
                } catch (error) {
                    console.error('❌ Error in general message handler:', error);
                }
            });
        }
    }

    get isConnected() {
        return this.ws && this.ws.readyState === WebSocket.OPEN;
    }

    // Helper methods for common operations
    subscribeToCO2Data(dataType) {
        return this.send({
            type: 'subscribe-co2-data',
            payload: { dataType }
        });
    }

    subscribeToGoalProgress(goalId) {
        return this.send({
            type: 'subscribe-goal-progress', 
            payload: { goalId }
        });
    }
}

export const websocketClient = new WebSocketClient();