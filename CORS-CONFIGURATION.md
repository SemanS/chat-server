# 🌐 CORS Configuration Guide

Tento dokument popisuje CORS konfiguráciu pre Oracle Voice Chat aplikáciu s podporou pre `voice-chat.vocabu.io` a `oracle-voice-chat.pages.dev`.

## 📋 Prehľad

### Podporované domény
- ✅ `https://voice-chat.vocabu.io` (produkčná doména)
- ✅ `https://oracle-voice-chat.pages.dev` (Cloudflare Pages)
- ✅ Localhost pre development

### Architektúra
```
Frontend (Cloudflare Pages)     Backend (Oracle VM)
voice-chat.vocabu.io     →     129.159.9.170:443
                               ├── Nginx (CORS proxy)
                               └── Express (CORS middleware)
```

## 🔧 Nginx Konfigurácia

### 1. CORS Origin Map
```nginx
# Map for CORS origins - supports multiple domains
map $http_origin $cors_origin {
    default "";
    "https://voice-chat.vocabu.io" "https://voice-chat.vocabu.io";
    "https://oracle-voice-chat.pages.dev" "https://oracle-voice-chat.pages.dev";
}
```

### 2. Global CORS Headers
```nginx
# CORS headers for API endpoints
add_header Access-Control-Allow-Origin $cors_origin always;
add_header Access-Control-Allow-Methods "GET, POST, OPTIONS" always;
add_header Access-Control-Allow-Headers "Origin, X-Requested-With, Content-Type, Accept, Authorization" always;
add_header Access-Control-Allow-Credentials "true" always;
```

### 3. API Preflight Handling
```nginx
location ~ ^/api/ {
    if ($request_method = 'OPTIONS') {
        add_header Access-Control-Allow-Origin $cors_origin;
        add_header Access-Control-Allow-Methods "GET, POST, OPTIONS";
        add_header Access-Control-Allow-Headers "Origin, X-Requested-With, Content-Type, Accept, Authorization";
        add_header Access-Control-Allow-Credentials "true";
        add_header Access-Control-Max-Age 86400;
        return 204;
    }
}
```

### 4. WebSocket CORS Headers
```nginx
location /ws {
    # CORS headers for WebSocket handshake
    add_header Access-Control-Allow-Origin $cors_origin always;
    add_header Access-Control-Allow-Credentials "true" always;
    
    proxy_set_header Origin $http_origin;
    # ... other WebSocket config
}
```

## 🚀 Express Middleware

### CORS Middleware Configuration
```javascript
const allowedOrigins = [
    'https://oracle-voice-chat.pages.dev',
    'https://voice-chat.vocabu.io',
    // Development origins
    'http://localhost:3000',
    'http://localhost:8000',
    // Cloudflare Pages preview URLs
    /^https:\/\/[a-z0-9-]+\.oracle-voice-chat\.pages\.dev$/
];
```

## 🧪 Testovanie

### 1. HTTP API CORS Test
```bash
# Test voice-chat.vocabu.io
curl -H "Origin: https://voice-chat.vocabu.io" -I https://129.159.9.170/health

# Expected response:
# Access-Control-Allow-Origin: https://voice-chat.vocabu.io
```

### 2. WebSocket CORS Test
```javascript
// Frontend test
const ws = new WebSocket('wss://129.159.9.170/ws');
ws.onopen = () => console.log('✅ Connected');
ws.onclose = (e) => console.log('❌ Closed:', e.code);
```

### 3. Automated Tests
```bash
# Run CORS tests
node test-cors.js
node test-websocket-cors.js
```

## 📦 Deployment

### 1. Nginx Configuration Deployment
```bash
# Generate deployment package
./deploy-nginx-config.sh

# Transfer to Oracle VM
scp nginx-config-*.tar.gz oracle-vm:/tmp/

# Extract and deploy on Oracle VM
sudo tar -xzf /tmp/nginx-config-*.tar.gz -C /
sudo nginx -t
sudo systemctl reload nginx
```

### 2. Verification Commands
```bash
# Test CORS headers
curl -H "Origin: https://voice-chat.vocabu.io" -I https://129.159.9.170/health
curl -H "Origin: https://oracle-voice-chat.pages.dev" -I https://129.159.9.170/api/metrics

# Test WebSocket handshake
curl -H "Origin: https://voice-chat.vocabu.io" \
     -H "Connection: Upgrade" \
     -H "Upgrade: websocket" \
     -H "Sec-WebSocket-Version: 13" \
     -H "Sec-WebSocket-Key: test" \
     -I https://129.159.9.170/ws
```

## 🔍 Troubleshooting

### Common Issues

**1. CORS Error: "Access to fetch blocked"**
```
Solution: Check Origin header in Nginx map
Verify: curl -H "Origin: https://voice-chat.vocabu.io" -I https://129.159.9.170/health
```

**2. WebSocket Connection Failed**
```
Solution: Check CSP headers in _headers file
Verify: connect-src includes wss://129.159.9.170
```

**3. Preflight Request Failed**
```
Solution: Check OPTIONS handling in Nginx
Verify: curl -X OPTIONS -H "Origin: https://voice-chat.vocabu.io" https://129.159.9.170/api/health
```

### Debug Commands
```bash
# Check Nginx configuration
sudo nginx -t

# View Nginx error logs
sudo tail -f /var/log/nginx/error.log

# Test CORS with verbose output
curl -v -H "Origin: https://voice-chat.vocabu.io" https://129.159.9.170/health
```

## ✅ Test Results

### HTTP API CORS
- ✅ `voice-chat.vocabu.io` → Allowed
- ✅ `oracle-voice-chat.pages.dev` → Allowed  
- ❌ `example.com` → Blocked (expected)

### WebSocket CORS
- ✅ `voice-chat.vocabu.io` → Connected
- ✅ `oracle-voice-chat.pages.dev` → Connected
- ✅ All origins work (WebSocket doesn't enforce CORS)

## 🎯 Production Checklist

- [x] Nginx CORS map configured
- [x] Express CORS middleware updated
- [x] WebSocket CORS headers added
- [x] Frontend CSP headers configured
- [x] CORS tests passing
- [x] WebSocket tests passing
- [x] Deployment package created

**Status: ✅ Ready for production deployment**
