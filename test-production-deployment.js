#!/usr/bin/env node

// Production Deployment Test Script
// Tests the complete architecture: Cloudflare Pages → Oracle VM

const https = require('https');
const WebSocket = require('ws');

// Configuration
const FRONTEND_URL = 'https://c61dff04.oracle-voice-chat.pages.dev';
const BACKEND_URL = 'https://129.159.9.170';
const WS_URL = 'wss://129.159.9.170/ws';

// Colors for output
const colors = {
    reset: '\033[0m',
    red: '\033[31m',
    green: '\033[32m',
    yellow: '\033[33m',
    blue: '\033[34m',
    magenta: '\033[35m',
    cyan: '\033[36m'
};

function log(message, color = 'blue') {
    const timestamp = new Date().toLocaleTimeString();
    console.log(`${colors[color]}[${timestamp}] ${message}${colors.reset}`);
}

function success(message) {
    log(`✅ ${message}`, 'green');
}

function error(message) {
    log(`❌ ${message}`, 'red');
}

function warning(message) {
    log(`⚠️  ${message}`, 'yellow');
}

// Test HTTP request with CORS
function testHTTP(url, origin) {
    return new Promise((resolve, reject) => {
        const options = {
            method: 'GET',
            headers: {
                'Origin': origin,
                'User-Agent': 'Production-Test/1.0'
            },
            rejectUnauthorized: false // Accept self-signed certificates
        };

        const req = https.request(url, options, (res) => {
            const corsHeader = res.headers['access-control-allow-origin'];
            
            resolve({
                status: res.statusCode,
                corsHeader,
                allowed: corsHeader === origin || corsHeader === '*',
                headers: res.headers
            });
        });

        req.on('error', (err) => {
            reject(err);
        });

        req.end();
    });
}

// Test WebSocket connection
function testWebSocket(url, origin) {
    return new Promise((resolve, reject) => {
        const ws = new WebSocket(url, {
            headers: {
                'Origin': origin
            },
            rejectUnauthorized: false
        });

        let connected = false;
        let sessionId = null;

        const timeout = setTimeout(() => {
            if (!connected) {
                ws.terminate();
                resolve({
                    connected: false,
                    error: 'Connection timeout'
                });
            }
        }, 10000);

        ws.on('open', () => {
            connected = true;
            clearTimeout(timeout);
            
            // Send test message
            ws.send(JSON.stringify({
                type: 'ping',
                message: 'Production test',
                timestamp: new Date().toISOString()
            }));
        });

        ws.on('message', (data) => {
            try {
                const message = JSON.parse(data.toString());
                if (message.type === 'connection') {
                    sessionId = message.sessionId;
                }
            } catch (e) {
                // Ignore parsing errors
            }
        });

        ws.on('close', (code, reason) => {
            resolve({
                connected: true,
                sessionId,
                closeCode: code,
                closeReason: reason.toString()
            });
        });

        ws.on('error', (err) => {
            resolve({
                connected: false,
                error: err.message
            });
        });

        // Close after 3 seconds
        setTimeout(() => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.close(1000, 'Test completed');
            }
        }, 3000);
    });
}

async function runProductionTests() {
    console.log('🚀 Production Deployment Test Suite');
    console.log('=====================================\n');

    log('Testing complete architecture: Cloudflare Pages → Oracle VM');
    
    // Test 1: Frontend accessibility
    log('1. Testing Frontend (Cloudflare Pages)...');
    try {
        const frontendResult = await testHTTP(FRONTEND_URL, FRONTEND_URL);
        if (frontendResult.status === 200) {
            success(`Frontend accessible: ${FRONTEND_URL}`);
        } else {
            error(`Frontend returned status: ${frontendResult.status}`);
        }
    } catch (err) {
        error(`Frontend test failed: ${err.message}`);
    }

    // Test 2: Backend health check
    log('\n2. Testing Backend Health (Oracle VM)...');
    try {
        const backendResult = await testHTTP(`${BACKEND_URL}/health`, FRONTEND_URL);
        if (backendResult.status === 200) {
            success(`Backend health check passed`);
            if (backendResult.allowed) {
                success(`CORS configured correctly for frontend`);
            } else {
                warning(`CORS may need configuration: ${backendResult.corsHeader}`);
            }
        } else {
            error(`Backend health check failed: ${backendResult.status}`);
        }
    } catch (err) {
        error(`Backend test failed: ${err.message}`);
    }

    // Test 3: API endpoint with CORS
    log('\n3. Testing API Endpoint with CORS...');
    try {
        const apiResult = await testHTTP(`${BACKEND_URL}/api/metrics`, FRONTEND_URL);
        if (apiResult.status === 200) {
            success(`API endpoint accessible`);
            if (apiResult.allowed) {
                success(`API CORS configured correctly`);
            } else {
                warning(`API CORS may need configuration: ${apiResult.corsHeader}`);
            }
        } else {
            error(`API endpoint failed: ${apiResult.status}`);
        }
    } catch (err) {
        error(`API test failed: ${err.message}`);
    }

    // Test 4: WebSocket connection
    log('\n4. Testing WebSocket Connection...');
    try {
        const wsResult = await testWebSocket(WS_URL, FRONTEND_URL);
        if (wsResult.connected) {
            success(`WebSocket connection successful`);
            if (wsResult.sessionId) {
                success(`Session established: ${wsResult.sessionId}`);
            }
            log(`Close code: ${wsResult.closeCode} (${wsResult.closeReason})`);
        } else {
            error(`WebSocket connection failed: ${wsResult.error}`);
        }
    } catch (err) {
        error(`WebSocket test failed: ${err.message}`);
    }

    // Summary
    console.log('\n=====================================');
    log('🎯 Production Test Summary', 'magenta');
    console.log('=====================================');
    
    console.log(`\n📍 URLs:`);
    console.log(`   Frontend: ${FRONTEND_URL}`);
    console.log(`   Backend:  ${BACKEND_URL}`);
    console.log(`   WebSocket: ${WS_URL}`);
    
    console.log(`\n🔧 Architecture:`);
    console.log(`   Frontend: Cloudflare Pages`);
    console.log(`   Backend:  Oracle VM + Nginx + Express`);
    console.log(`   Protocol: HTTPS + WebSocket Secure`);
    
    console.log(`\n📋 Next Steps:`);
    console.log(`   1. Configure custom domain: voice-chat.vocabu.io`);
    console.log(`   2. Update CORS for custom domain`);
    console.log(`   3. Test voice chat functionality`);
    console.log(`   4. Monitor production logs`);
    
    success('\n🎉 Production deployment test completed!');
}

// Run tests
runProductionTests().catch(console.error);
