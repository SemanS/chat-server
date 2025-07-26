const http = require('http');

// Test CORS headers for different origins
const testOrigins = [
    'https://voice-chat.vocabu.io',
    'https://oracle-voice-chat.pages.dev',
    'https://example.com' // Should not be allowed
];

function testCORS(origin, path = '/health') {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'localhost',
            port: 3000,
            path: path,
            method: 'GET',
            headers: {
                'Origin': origin,
                'User-Agent': 'CORS-Test/1.0'
            }
        };

        const req = http.request(options, (res) => {
            const corsHeader = res.headers['access-control-allow-origin'];
            
            console.log(`\n🧪 Testing Origin: ${origin}`);
            console.log(`📍 Path: ${path}`);
            console.log(`📊 Status: ${res.statusCode}`);
            console.log(`🔒 CORS Header: ${corsHeader || 'NOT SET'}`);
            console.log(`✅ Allowed: ${corsHeader === origin ? 'YES' : 'NO'}`);
            
            resolve({
                origin,
                path,
                status: res.statusCode,
                corsHeader,
                allowed: corsHeader === origin
            });
        });

        req.on('error', (err) => {
            console.error(`❌ Error testing ${origin}:`, err.message);
            reject(err);
        });

        req.end();
    });
}

async function runCORSTests() {
    console.log('🔍 Testing CORS configuration...\n');
    
    const results = [];
    
    // Test health endpoint
    for (const origin of testOrigins) {
        try {
            const result = await testCORS(origin, '/health');
            results.push(result);
        } catch (error) {
            console.error(`Failed to test ${origin}:`, error.message);
        }
    }
    
    // Test API endpoint
    console.log('\n' + '='.repeat(50));
    console.log('Testing API endpoint (/api/metrics)');
    console.log('='.repeat(50));
    
    for (const origin of testOrigins) {
        try {
            const result = await testCORS(origin, '/api/metrics');
            results.push(result);
        } catch (error) {
            console.error(`Failed to test ${origin}:`, error.message);
        }
    }
    
    // Summary
    console.log('\n' + '='.repeat(50));
    console.log('📊 CORS Test Summary');
    console.log('='.repeat(50));
    
    const allowedOrigins = results.filter(r => r.allowed);
    const blockedOrigins = results.filter(r => !r.allowed);
    
    console.log(`✅ Allowed origins: ${allowedOrigins.length}`);
    allowedOrigins.forEach(r => {
        console.log(`   - ${r.origin} (${r.path})`);
    });
    
    console.log(`❌ Blocked origins: ${blockedOrigins.length}`);
    blockedOrigins.forEach(r => {
        console.log(`   - ${r.origin} (${r.path})`);
    });
    
    // Check if our target domains are working
    const targetDomains = [
        'https://voice-chat.vocabu.io',
        'https://oracle-voice-chat.pages.dev'
    ];
    
    const workingTargets = targetDomains.filter(domain => 
        allowedOrigins.some(r => r.origin === domain)
    );
    
    console.log(`\n🎯 Target domains working: ${workingTargets.length}/${targetDomains.length}`);
    
    if (workingTargets.length === targetDomains.length) {
        console.log('🎉 All target domains have proper CORS configuration!');
    } else {
        console.log('⚠️  Some target domains may have CORS issues');
    }
}

// Run tests
runCORSTests().catch(console.error);
