const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const path = require('path');
require('dotenv').config();

// Import middleware
const corsMiddleware = require('./middleware/cors');
const sessionMiddleware = require('./middleware/session');

// Import routes
const deepgramRoutes = require('./src/deepgram');
const ttsRoutes = require('./src/tts');
const metricsRoutes = require('./src/metrics');

const app = express();
const server = http.createServer(app);

// WebSocket server
const wss = new WebSocket.Server({ 
    server,
    path: '/ws'
});

// Basic middleware
app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false
}));
app.use(compression());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later.'
});
app.use('/api/', limiter);

// CORS middleware
app.use(corsMiddleware);

// Session middleware
app.use(sessionMiddleware);

// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).send('OK');
});

// API routes
app.use('/api/deepgram', deepgramRoutes);
app.use('/api/tts', ttsRoutes);
app.use('/api/metrics', metricsRoutes);

// WebSocket test page
app.get('/websocket-test.html', (req, res) => {
    res.send(`
<!DOCTYPE html>
<html>
<head>
    <title>WebSocket Test - Oracle Voice Chat</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; }
        .container { max-width: 800px; margin: 0 auto; }
        .status { padding: 10px; margin: 10px 0; border-radius: 5px; }
        .connected { background-color: #d4edda; color: #155724; }
        .disconnected { background-color: #f8d7da; color: #721c24; }
        .message { background-color: #f8f9fa; padding: 10px; margin: 5px 0; border-radius: 3px; }
        button { padding: 10px 20px; margin: 5px; cursor: pointer; }
        input { padding: 8px; margin: 5px; width: 300px; }
        #messages { height: 300px; overflow-y: auto; border: 1px solid #ccc; padding: 10px; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🔌 WebSocket Test - Oracle Voice Chat</h1>
        
        <div id="status" class="status disconnected">
            ❌ Disconnected
        </div>
        
        <div>
            <input type="text" id="wsUrl" value="ws://localhost:3000/ws" placeholder="WebSocket URL">
            <button onclick="connect()">Connect</button>
            <button onclick="disconnect()">Disconnect</button>
        </div>
        
        <div>
            <input type="text" id="messageInput" placeholder="Type message..." onkeypress="if(event.key==='Enter') sendMessage()">
            <button onclick="sendMessage()">Send Message</button>
        </div>
        
        <div>
            <button onclick="testVoiceChat()">🎤 Test Voice Chat</button>
            <button onclick="clearMessages()">Clear</button>
        </div>
        
        <div id="messages"></div>
    </div>

    <script>
        let ws = null;
        const statusDiv = document.getElementById('status');
        const messagesDiv = document.getElementById('messages');
        
        function updateStatus(connected, message) {
            statusDiv.className = connected ? 'status connected' : 'status disconnected';
            statusDiv.textContent = connected ? '✅ Connected' : '❌ Disconnected';
            if (message) {
                addMessage('SYSTEM', message);
            }
        }
        
        function addMessage(type, content) {
            const messageDiv = document.createElement('div');
            messageDiv.className = 'message';
            messageDiv.innerHTML = \`<strong>[\${new Date().toLocaleTimeString()}] \${type}:</strong> \${content}\`;
            messagesDiv.appendChild(messageDiv);
            messagesDiv.scrollTop = messagesDiv.scrollHeight;
        }
        
        function connect() {
            const url = document.getElementById('wsUrl').value;
            
            try {
                ws = new WebSocket(url);
                
                ws.onopen = function(event) {
                    updateStatus(true, 'WebSocket connection established');
                };
                
                ws.onmessage = function(event) {
                    addMessage('RECEIVED', event.data);
                };
                
                ws.onclose = function(event) {
                    updateStatus(false, \`Connection closed: \${event.code} - \${event.reason}\`);
                };
                
                ws.onerror = function(error) {
                    updateStatus(false, \`WebSocket error: \${error}\`);
                };
                
            } catch (error) {
                updateStatus(false, \`Connection failed: \${error.message}\`);
            }
        }
        
        function disconnect() {
            if (ws) {
                ws.close();
                ws = null;
            }
        }
        
        function sendMessage() {
            const input = document.getElementById('messageInput');
            const message = input.value.trim();
            
            if (message && ws && ws.readyState === WebSocket.OPEN) {
                ws.send(message);
                addMessage('SENT', message);
                input.value = '';
            } else {
                addMessage('ERROR', 'Not connected or empty message');
            }
        }
        
        function testVoiceChat() {
            if (ws && ws.readyState === WebSocket.OPEN) {
                const testMessage = {
                    type: 'voice_chat',
                    message: 'Hello, this is a test message for voice chat functionality.',
                    timestamp: new Date().toISOString()
                };
                
                ws.send(JSON.stringify(testMessage));
                addMessage('SENT', 'Voice chat test message');
            } else {
                addMessage('ERROR', 'Not connected to WebSocket');
            }
        }
        
        function clearMessages() {
            messagesDiv.innerHTML = '';
        }
        
        // Auto-connect on page load
        window.onload = function() {
            // Update URL based on current location
            const wsUrl = document.getElementById('wsUrl');
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const host = window.location.host || 'localhost:3000';
            wsUrl.value = \`\${protocol}//\${host}/ws\`;
        };
    </script>
</body>
</html>
    `);
});

// WebSocket connection handling
wss.on('connection', (ws, req) => {
    console.log('🔌 New WebSocket connection from:', req.socket.remoteAddress);
    
    // Send welcome message
    ws.send(JSON.stringify({
        type: 'connection',
        message: 'Connected to Oracle Voice Chat Backend',
        timestamp: new Date().toISOString()
    }));
    
    // Handle messages
    ws.on('message', (data) => {
        try {
            const message = data.toString();
            console.log('📨 WebSocket message received:', message);
            
            // Echo message back
            ws.send(JSON.stringify({
                type: 'echo',
                message: `Echo: ${message}`,
                timestamp: new Date().toISOString()
            }));
            
        } catch (error) {
            console.error('❌ WebSocket message error:', error);
            ws.send(JSON.stringify({
                type: 'error',
                message: 'Failed to process message',
                error: error.message,
                timestamp: new Date().toISOString()
            }));
        }
    });
    
    // Handle connection close
    ws.on('close', (code, reason) => {
        console.log('🔌 WebSocket connection closed:', code, reason.toString());
    });
    
    // Handle errors
    ws.on('error', (error) => {
        console.error('❌ WebSocket error:', error);
    });
});

// Error handling
app.use((err, req, res, next) => {
    console.error('❌ Server error:', err);
    res.status(500).json({
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        error: 'Not found',
        message: `Route ${req.method} ${req.path} not found`
    });
});

// Start server
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

server.listen(PORT, HOST, () => {
    console.log('🚀 Oracle Voice Chat Backend started');
    console.log(`📡 HTTP Server: http://${HOST}:${PORT}`);
    console.log(`🔌 WebSocket Server: ws://${HOST}:${PORT}/ws`);
    console.log(`🧪 WebSocket Test: http://${HOST}:${PORT}/websocket-test.html`);
    console.log(`💚 Health Check: http://${HOST}:${PORT}/health`);
    console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('🛑 SIGTERM received, shutting down gracefully');
    server.close(() => {
        console.log('✅ Server closed');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('🛑 SIGINT received, shutting down gracefully');
    server.close(() => {
        console.log('✅ Server closed');
        process.exit(0);
    });
});

module.exports = { app, server, wss };
