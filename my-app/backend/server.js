import express from "express";
import cors from "cors";
import helmet from "helmet";
import { dataRoutes } from "./routes/dataRoutes.js";
import { userRoutes } from "./routes/userRoutes.js";
import { goalRoutes } from "./routes/goalRoutes.js";
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import jwt from "jsonwebtoken";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const port = process.env.PORT ? process.env.PORT : 3000;
const app = express();
const server = createServer(app);

// Your existing middleware
app.use(express.json());
app.use(express.urlencoded({extended: true}));
app.use(helmet());
app.use(cors({ allowedHeaders: ['Authorization', 'Content-Type'] }));
app.use(express.static(path.join(__dirname, '../dist')));

// Your existing routes
app.use('/api/account', userRoutes);
app.use('/api/data', dataRoutes);
app.use('/api/goals', goalRoutes);

// Store connected clients
const connectedClients = new Map();

// Create WebSocket server
const wss = new WebSocketServer({ 
  server,
  path: '/realtime' // Optional: specific WebSocket path
});

// WebSocket connection handling
wss.on('connection', (ws, req) => {
  console.log('New WebSocket connection attempted');
  
  // Extract token from URL query string or headers
  const url = new URL(req.url, `http://${req.headers.host}`);
  const token = url.searchParams.get('token');
  
  if (!token) {
    ws.close(1008, 'No token provided');
    return;
  }
  
  try {
    // Verify JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.user.id;
    const userEmail = decoded.user.email;
    
    // Store the authenticated connection
    ws.userId = userId;
    ws.userEmail = userEmail;
    
    // Add to connected clients
    if (!connectedClients.has(userId)) {
      connectedClients.set(userId, new Set());
    }
    connectedClients.get(userId).add(ws);
    
    console.log(`User ${userEmail} connected via WebSocket`);
    
    // Handle messages from client
    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data);
        handleWebSocketMessage(ws, message);
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
        sendToClient(ws, { 
          type: 'error', 
          message: 'Invalid message format' 
        });
      }
    });
    
    // Handle connection close
    ws.on('close', () => {
      if (connectedClients.has(userId)) {
        connectedClients.get(userId).delete(ws);
        if (connectedClients.get(userId).size === 0) {
          connectedClients.delete(userId);
        }
      }
      console.log(`User ${userEmail} disconnected from WebSocket`);
    });
    
    // Send welcome message
    sendToClient(ws, {
      type: 'connected',
      message: 'WebSocket connection established',
      userId: userId
    });
    
  } catch (error) {
    console.error('WebSocket authentication failed:', error);
    ws.close(1008, 'Authentication failed');
  }
});

// WebSocket message handler
function handleWebSocketMessage(ws, message) {
  const { type, payload } = message;
  
  switch (type) {
    case 'subscribe-co2-data':
      // Store subscription info on the WebSocket connection
      ws.co2Subscription = payload.dataType;
      sendToClient(ws, {
        type: 'subscribed',
        message: `Subscribed to ${payload.dataType} updates`
      });
      break;
      
    case 'subscribe-goal-progress':
      ws.goalSubscription = payload.goalId;
      sendToClient(ws, {
        type: 'subscribed', 
        message: `Subscribed to goal ${payload.goalId} progress`
      });
      break;
      
    case 'ping':
      sendToClient(ws, { type: 'pong', timestamp: Date.now() });
      break;
      
    default:
      sendToClient(ws, { 
        type: 'error', 
        message: `Unknown message type: ${type}` 
      });
  }
}

// Helper function to send messages to a client
function sendToClient(ws, data) {
  if (ws.readyState === 1) { // 1 = OPEN
    ws.send(JSON.stringify(data));
  }
}

// Broadcast to all clients of a specific user
export function broadcastToUser(userId, data) {
  const userClients = connectedClients.get(userId);
  if (userClients) {
    userClients.forEach(client => {
      sendToClient(client, data);
    });
  }
}

// Broadcast to all connected clients (for global announcements)
export function broadcastToAll(data) {
  connectedClients.forEach((userClients, userId) => {
    userClients.forEach(client => {
      sendToClient(client, data);
    });
  });
}

// Make broadcast functions available to routes
app.set('broadcastToUser', broadcastToUser);
app.set('broadcastToAll', broadcastToAll);

// Your existing error handling and routes
app.use((error, req, res, next) => {
    console.error("Error: ", next(error));
    res.status(500).send('Internal Server Error');
});

app.get("/", (req, res) => {
    res.status(200).send("Inside the server");
});

app.use((req, res) => {
  res.sendFile(path.join(__dirname, '../dist/index.html'));
});

server.listen(port, () => {
    console.log(`Server running with native WebSocket support on port ${port}`);
});