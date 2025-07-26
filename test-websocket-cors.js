const WebSocket = require('ws');
const http = require('http');

// Test WebSocket connection with different origins
async function testWebSocketWithOrigin(origin) {
    return new Promise((resolve, reject) => {
        console.log(`\n🧪 Testing WebSocket with Origin: ${origin}`);
        
        // Create WebSocket with custom headers
        const ws = new WebSocket('ws://localhost:3000/ws', {
            headers: {
                'Origin': origin,
                'User-Agent': 'WebSocket-CORS-Test/1.0'
            }
        });
        
        let connected = false;
        let handshakeResponse = null;
        
        // Capture handshake response
        ws.on('upgrade', (response) => {
            handshakeResponse = response;
            console.log(`📡 Handshake response headers:`);
            Object.keys(response.headers).forEach(key => {
                if (key.toLowerCase().includes('cors') || key.toLowerCase().includes('origin')) {
                    console.log(`   ${key}: ${response.headers[key]}`);
                }
            });
        });
        
        ws.on('open', function open() {
            connected = true;
            console.log('✅ WebSocket connected successfully!');
            
            // Send test message
            ws.send(JSON.stringify({
                type: 'ping',
                message: `Test from ${origin}`,
                timestamp: new Date().toISOString()
            }));
        });
        
        ws.on('message', function message(data) {
            try {
                const parsed = JSON.parse(data.toString());
                console.log(`📨 Received: ${parsed.type} - ${parsed.message?.substring(0, 50)}...`);
                
                if (parsed.type === 'connection') {
                    console.log(`🆔 Session ID: ${parsed.sessionId}`);
                }
            } catch (e) {
                console.log('📨 Received binary or non-JSON data');
            }
        });
        
        ws.on('close', function close(code, reason) {
            console.log(`🔌 Connection closed: ${code} - ${reason.toString()}`);
            resolve({
                origin,
                connected,
                code,
                reason: reason.toString(),
                handshakeHeaders: handshakeResponse?.headers || {}
            });
        });
        
        ws.on('error', function error(err) {
            console.error(`❌ WebSocket error: ${err.message}`);
            resolve({
                origin,
                connected: false,
                error: err.message,
                handshakeHeaders: {}
            });
        });
        
        // Close connection after 3 seconds
        setTimeout(() => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.close(1000, 'Test completed');
            }
        }, 3000);
        
        // Timeout after 5 seconds
        setTimeout(() => {
            if (!connected) {
                ws.terminate();
                resolve({
                    origin,
                    connected: false,
                    error: 'Connection timeout',
                    handshakeHeaders: {}
                });
            }
        }, 5000);
    });
}

async function runWebSocketCORSTests() {
    console.log('🔍 Testing WebSocket CORS configuration...\n');
    
    const testOrigins = [
        'https://voice-chat.vocabu.io',
        'https://oracle-voice-chat.pages.dev',
        'https://example.com' // Should work (WebSocket doesn't enforce CORS like HTTP)
    ];
    
    const results = [];
    
    for (const origin of testOrigins) {
        try {
            const result = await testWebSocketWithOrigin(origin);
            results.push(result);
            
            // Wait between tests
            await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (error) {
            console.error(`Failed to test ${origin}:`, error.message);
            results.push({
                origin,
                connected: false,
                error: error.message,
                handshakeHeaders: {}
            });
        }
    }
    
    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 WebSocket CORS Test Summary');
    console.log('='.repeat(60));
    
    const successful = results.filter(r => r.connected);
    const failed = results.filter(r => !r.connected);
    
    console.log(`✅ Successful connections: ${successful.length}`);
    successful.forEach(r => {
        console.log(`   - ${r.origin}`);
    });
    
    console.log(`❌ Failed connections: ${failed.length}`);
    failed.forEach(r => {
        console.log(`   - ${r.origin} (${r.error || 'Unknown error'})`);
    });
    
    // Check target domains
    const targetDomains = [
        'https://voice-chat.vocabu.io',
        'https://oracle-voice-chat.pages.dev'
    ];
    
    const workingTargets = targetDomains.filter(domain => 
        successful.some(r => r.origin === domain)
    );
    
    console.log(`\n🎯 Target domains working: ${workingTargets.length}/${targetDomains.length}`);
    
    if (workingTargets.length === targetDomains.length) {
        console.log('🎉 All target domains can connect to WebSocket!');
        console.log('\n📋 Ready for production deployment:');
        console.log('1. Deploy backend to Oracle VM');
        console.log('2. Deploy frontend to Cloudflare Pages');
        console.log('3. Test end-to-end connection');
    } else {
        console.log('⚠️  Some target domains may have connection issues');
    }
    
    return results;
}

// Run tests
runWebSocketCORSTests()
    .then(results => {
        console.log('\n✅ WebSocket CORS testing completed');
        process.exit(0);
    })
    .catch(error => {
        console.error('❌ Test failed:', error);
        process.exit(1);
    });
