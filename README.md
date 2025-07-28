# 🎤 Oracle Voice Chat Backend

Pokročilý Node.js backend pre voice chat aplikáciu s AI integráciou, optimalizovaný pre Oracle Cloud deployment.

## ✨ Funkcie

- 🎤 **Speech-to-Text** - Deepgram API integrácia
- 🤖 **AI Chat** - OpenAI GPT-4 konverzácie  
- 🔊 **Text-to-Speech** - Piper TTS engine
- 📡 **WebSocket** - Real-time komunikácia
- 🐳 **Docker** - Containerizovaný deployment
- 🔒 **CORS & Security** - Bezpečné API endpoints
- 📊 **Monitoring** - Metriky a health checks
- 🗄️ **Session Management** - Redis/in-memory sessions

## 🚀 Deployment Módy

### **Produkčný Deployment**

```bash
# Štandardný deployment s potvrdením
./deploy-universal.sh

# Rýchly deployment (bez potvrdenia)
./deploy-universal.sh quick

# Deployment len kódu (bez systémových závislostí)
./deploy-universal.sh code-only

# Rollback na predchádzajúcu verziu
./deploy-universal.sh rollback

# Kompletný quick deploy s Piper TTS
./quick-deploy.sh
```

### **Lokálny Vývoj s Piper TTS**

```bash
# Kompletné nastavenie a spustenie
./start-local-with-piper.sh

# Len nastavenie Piper TTS servera
./setup-piper-tts-web.sh

# Testovanie deployment
./test-piper-tts-deployment.sh
```

## 🔊 Piper TTS Server

Nové deployment skripty automaticky nastavujú vysokovýkonný Piper TTS server:

- **10x rýchlejšie** generovanie reči
- **Nižšia záťaž CPU** - model sa načíta raz
- **Docker kontajner** - `rhasspy/wyoming-piper`
- **HTTP API** na porte 5000
- **Slovenský hlas** `sk_SK-lili-medium`

### Konfigurácia
```env
PIPER_TTS_URL=http://piper-tts-server:5000
TTS_VOICE=sk_SK-lili-medium
TTS_CACHE_ENABLED=true
```

## 🛠️ Quick Start

### **Development**

```bash
# Clone repository
git clone https://github.com/SemanS/chat-backend.git
cd chat-backend

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env

# Start development server
npm run dev
```

### **Production (Docker)**

```bash
# Build and start containers
docker-compose up -d

# Check status
docker-compose ps

# View logs
docker-compose logs -f voice-chat-backend
```

## 🏗️ Architektúra

```
Frontend (Cloudflare Pages)
    ↓ HTTPS/WSS
Oracle Voice Chat Backend (Node.js)
    ├── Express.js API Server
    ├── WebSocket Server
    ├── Deepgram STT Integration
    ├── OpenAI GPT-4 Integration
    ├── Piper TTS Engine
    ├── Redis Session Store
    └── Nginx Reverse Proxy
```

## 📁 Štruktúra projektu

```
chat-backend/
├── src/
│   ├── deepgram.js          # Speech-to-Text API
│   ├── tts.js               # Text-to-Speech API
│   └── metrics.js           # Monitoring & metrics
├── middleware/
│   ├── cors.js              # CORS konfigurácia
│   └── session.js           # Session management
├── tests/                   # Unit & integration testy
├── scripts/                 # Deployment skripty
├── docker/                  # Docker konfigurácie
├── nginx/                   # Nginx konfigurácie
├── server.js                # Hlavný server súbor
├── Dockerfile               # Docker image
├── docker-compose.yml       # Multi-container setup
└── README.md                # Dokumentácia
```

## 🔧 API Endpoints

### **Health & Monitoring**
```
GET  /health                 # Health check
GET  /api/metrics            # System metrics
GET  /api/metrics/health     # Detailed health info
POST /api/metrics/track      # Track custom metrics
```

### **Speech-to-Text**
```
POST /api/deepgram/transcribe    # Audio transcription
GET  /api/deepgram/languages     # Supported languages
GET  /api/deepgram/models        # Available models
GET  /api/deepgram/status        # Service status
```

### **Text-to-Speech**
```
POST /api/tts/synthesize         # Text to audio
GET  /api/tts/voices             # Available voices
GET  /api/tts/status             # Service status
```

### **WebSocket**
```
WS   /ws                         # Real-time communication
GET  /websocket-test.html        # WebSocket test page
```

## 🌐 WebSocket API

### **Connection**
```javascript
const ws = new WebSocket('wss://your-domain.com/ws');

ws.onopen = () => {
    console.log('Connected to Oracle Voice Chat');
};

ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    console.log('Message:', data);
};
```

### **Message Format**
```javascript
// Odoslanie správy
ws.send(JSON.stringify({
    type: 'voice_chat',
    message: 'Hello, how are you?',
    language: 'sk-SK',
    timestamp: new Date().toISOString()
}));

// Prijatie odpovede
{
    type: 'ai_response',
    message: 'I am doing well, thank you!',
    audio_url: '/api/tts/audio/12345.wav',
    timestamp: '2024-01-01T12:00:00.000Z'
}
```

## 🔑 Environment Variables

### **Základné nastavenia**
```bash
NODE_ENV=production
PORT=3000
HOST=0.0.0.0
TZ=Europe/Bratislava
```

### **API kľúče**
```bash
DEEPGRAM_API_KEY=your-deepgram-key
OPENAI_API_KEY=your-openai-key
```

### **Redis konfigurácia**
```bash
USE_REDIS=true
REDIS_URL=redis://localhost:6379
REDIS_PASSWORD=your-password
```

## 🐳 Docker Deployment

### **Single Container**
```bash
# Build image
docker build -t oracle-voice-chat-backend .

# Run container
docker run -d \
  --name voice-chat \
  -p 3000:3000 \
  -e NODE_ENV=production \
  oracle-voice-chat-backend
```

### **Multi-Container (Recommended)**
```bash
# Start all services
docker-compose up -d

# Scale backend
docker-compose up -d --scale voice-chat-backend=3

# Update services
docker-compose pull && docker-compose up -d
```

## 🧪 Testovanie

### **Unit testy**
```bash
npm test                    # Všetky testy
npm run test:watch          # Watch mode
npm run test:coverage       # Coverage report
```

### **Integration testy**
```bash
npm run test:cors           # CORS testy
npm run test:deepgram       # STT testy
npm run test:tts            # TTS testy
npm run test:websocket      # WebSocket testy
```

### **Manual testing**
```bash
# Health check
curl http://localhost:3000/health

# API test
curl -X POST http://localhost:3000/api/deepgram/transcribe \
  -H "Content-Type: application/json" \
  -d '{"audio": "base64-audio-data", "language": "sk-SK"}'

# WebSocket test
# Open: http://localhost:3000/websocket-test.html
```

## 📊 Monitoring

### **Metrics Dashboard**
```
http://localhost:3000/api/metrics
```

### **Health Check**
```
http://localhost:3000/api/metrics/health
```

### **Docker Logs**
```bash
# Backend logs
docker-compose logs -f voice-chat-backend

# Nginx logs
docker-compose logs -f nginx

# All services
docker-compose logs -f
```

## 🔒 Bezpečnosť

### **CORS Protection**
- Whitelist povolených domén
- Credentials support
- Preflight handling

### **Rate Limiting**
- API endpoints: 100 req/15min
- WebSocket: Connection limiting
- File upload: Size restrictions

### **Headers Security**
- Helmet.js middleware
- XSS protection
- Content type validation

## 🚀 Production Deployment

### **Oracle Cloud Setup**
```bash
# 1. Create Oracle Cloud instance
# 2. Install Docker & Docker Compose
# 3. Configure Security List (ports 80, 443, 3000)
# 4. Setup SSL certificates
# 5. Deploy application

# Quick deployment
./scripts/deploy-oracle.sh
```

### **Environment Setup**
```bash
# Production environment
cp .env.example .env
# Edit .env with production values

# SSL certificates
mkdir ssl/
# Copy Cloudflare Origin CA certificates

# Start production
docker-compose -f docker-compose.yml up -d
```

## 📈 Performance

### **Optimalizácie**
- Node.js clustering
- Redis session store
- Nginx reverse proxy
- Docker multi-stage builds
- Gzip compression

### **Benchmarks**
- **API Response**: < 100ms
- **WebSocket Latency**: < 50ms
- **STT Processing**: 1-3s
- **TTS Generation**: 1-2s
- **Memory Usage**: ~200MB

## 🔄 CI/CD

### **GitHub Actions**
```yaml
# .github/workflows/deploy.yml
name: Deploy to Oracle Cloud
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Deploy to Oracle
        run: ./scripts/deploy-oracle.sh
```

## 🐛 Troubleshooting

### **Časté problémy**

1. **Port 3000 already in use**
   ```bash
   lsof -ti:3000 | xargs kill -9
   ```

2. **Docker permission denied**
   ```bash
   sudo usermod -aG docker $USER
   newgrp docker
   ```

3. **CORS errors**
   - Skontroluj `middleware/cors.js`
   - Pridaj doménu do `allowedOrigins`

4. **WebSocket connection failed**
   - Overi port 3000 accessibility
   - Skontroluj firewall rules

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/SemanS/chat-backend/issues)
- **Discussions**: [GitHub Discussions](https://github.com/SemanS/chat-backend/discussions)
- **Documentation**: [Wiki](https://github.com/SemanS/chat-backend/wiki)

## 📄 Licencia

MIT License - pozri [LICENSE](LICENSE) súbor.

---

**Vytvorené s ❤️ pre Oracle Cloud a voice AI komunikáciu**
