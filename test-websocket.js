const WebSocket = require('ws');

console.log('🧪 Testing WebSocket connection to localhost:3000/ws');

const ws = new WebSocket('ws://localhost:3000/ws');

ws.on('open', function open() {
    console.log('✅ WebSocket connected!');
    console.log('📤 Sending ping message...');
    
    // Send ping message
    ws.send(JSON.stringify({
        type: 'ping',
        message: 'Hello from test client',
        timestamp: new Date().toISOString()
    }));
    
    // Send test chat message after 1 second
    setTimeout(() => {
        console.log('📤 Sending test chat message...');
        ws.send(JSON.stringify({
            type: 'text_chat',
            message: 'Ahoj, toto je test správa!',
            timestamp: new Date().toISOString()
        }));
    }, 1000);
    
    // Close connection after 5 seconds
    setTimeout(() => {
        console.log('🔌 Closing connection...');
        ws.close(1000, 'Test completed');
    }, 5000);
});

ws.on('message', function message(data) {
    console.log('📨 Received:', data.toString());
    
    try {
        const parsed = JSON.parse(data.toString());
        console.log('📨 Parsed message:', {
            type: parsed.type,
            sessionId: parsed.sessionId,
            message: parsed.message?.substring(0, 100)
        });
    } catch (e) {
        console.log('📨 Binary or non-JSON data received');
    }
});

ws.on('close', function close(code, reason) {
    console.log(`🔌 Connection closed: ${code} - ${reason.toString()}`);
});

ws.on('error', function error(err) {
    console.error('❌ WebSocket error:', err);
});

// Timeout after 10 seconds
setTimeout(() => {
    if (ws.readyState === WebSocket.OPEN) {
        console.log('⏰ Test timeout, closing connection');
        ws.close();
    }
    process.exit(0);
}, 10000);
