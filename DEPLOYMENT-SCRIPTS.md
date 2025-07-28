# 🚀 Oracle Voice Chat Backend - Deployment Scripts

Kompletný prehľad všetkých deployment skriptov s Piper TTS integráciou.

## 📋 Prehľad Skriptov

| Script | Účel | Použitie | Piper TTS |
|--------|------|----------|-----------|
| `deploy-universal.sh` | Štandardný deployment | `./deploy-universal.sh` | ✅ Automaticky |
| `deploy-universal.sh quick` | Rýchly deployment | `./deploy-universal.sh quick` | ✅ Automaticky |
| `deploy-universal.sh code-only` | Len kód | `./deploy-universal.sh code-only` | ➖ Zachováva existujúce |
| `deploy-universal.sh rollback` | Rollback | `./deploy-universal.sh rollback` | ➖ Obnoví predchádzajúce |
| `quick-deploy.sh` | Kompletný quick deploy | `./quick-deploy.sh` | ✅ Lokálne + Server |
| `start-local-with-piper.sh` | Lokálny vývoj | `./start-local-with-piper.sh` | ✅ Lokálne |
| `setup-piper-tts-web.sh` | Len Piper TTS setup | `./setup-piper-tts-web.sh` | ✅ Lokálne |
| `test-piper-tts-deployment.sh` | Testovanie | `./test-piper-tts-deployment.sh` | 🧪 Test |

## 🎯 Odporúčané Workflow

### Pre Produkciu
```bash
# 1. Rýchly deployment na server
./quick-deploy.sh

# 2. Testovanie deployment
./test-piper-tts-deployment.sh
```

### Pre Vývoj
```bash
# 1. Nastavenie lokálneho prostredia
./start-local-with-piper.sh

# 2. Vývoj a testovanie
npm run dev

# 3. Deployment zmien
./deploy-universal.sh code-only
```

### Pre Nový Server
```bash
# 1. Kompletný deployment
./deploy-universal.sh

# 2. Overenie funkcionality
./test-piper-tts-deployment.sh
```

## 🔧 Detailný Popis Skriptov

### 1. `deploy-universal.sh`
**Hlavný deployment script s Piper TTS integráciou**

```bash
# Štandardný deployment s potvrdením
./deploy-universal.sh

# Rýchly deployment bez potvrdenia
./deploy-universal.sh quick

# Deployment len kódu
./deploy-universal.sh code-only

# Rollback na predchádzajúcu verziu
./deploy-universal.sh rollback
```

**Čo robí:**
- ✅ Inštaluje systémové závislosti
- ✅ Nastavuje Piper TTS server
- ✅ Konfiguruje Docker Compose
- ✅ Spúšťa všetky služby
- ✅ Testuje funkcionalitu

### 2. `quick-deploy.sh`
**Najrýchlejší spôsob deployment s Piper TTS**

```bash
./quick-deploy.sh
```

**Čo robí:**
- ✅ Nastavuje Piper TTS lokálne
- ✅ Spúšťa `deploy-universal.sh quick`
- ✅ Kompletné riešenie v jednom príkaze

### 3. `start-local-with-piper.sh`
**Lokálny vývoj s Piper TTS serverom**

```bash
# Kompletné nastavenie a spustenie
./start-local-with-piper.sh

# Len nastavenie bez spustenia
./start-local-with-piper.sh setup-only
```

**Čo robí:**
- ✅ Kontroluje prerekvizity
- ✅ Inštaluje závislosti
- ✅ Nastavuje Piper TTS server
- ✅ Vytvorí `.env` pre development
- ✅ Testuje funkcionalitu
- ✅ Spúšťa aplikáciu

### 4. `setup-piper-tts-web.sh`
**Samostatné nastavenie Piper TTS servera**

```bash
./setup-piper-tts-web.sh
```

**Čo robí:**
- ✅ Sťahuje hlasové modely
- ✅ Vytvorí Docker Compose súbor
- ✅ Spúšťa Piper TTS server
- ✅ Aktualizuje `.env` súbor
- ✅ Testuje funkcionalitu

### 5. `test-piper-tts-deployment.sh`
**Komplexné testovanie deployment**

```bash
./test-piper-tts-deployment.sh
```

**Čo testuje:**
- 🧪 Dostupnosť služieb
- 🧪 API endpointy
- 🧪 TTS generovanie
- 🧪 Docker kontajnery
- 🧪 Konfiguračné súbory

## 🌐 Environment Variables

### Produkčné
```env
# Server konfigurácia
SERVER_IP=129.159.9.170
SSH_KEY=/path/to/ssh-key.key
SSH_USER=ubuntu
REMOTE_DIR=/home/ubuntu/chat-server

# API kľúče
DEEPGRAM_API_KEY=your-deepgram-key
OPENAI_API_KEY=your-openai-key

# TTS konfigurácia
TTS_VOICE=sk_SK-lili-medium
PIPER_TTS_PORT=5000
```

### Lokálne
```env
# TTS konfigurácia
PIPER_TTS_URL=http://localhost:5000
TTS_VOICE=sk_SK-lili-medium
TTS_CACHE_ENABLED=true

# Development
NODE_ENV=development
PORT=3000
DEBUG=voice-chat:*
```

## 🐳 Docker Compose Súbory

### `docker-compose.piper-tts.yml`
```yaml
services:
  piper-tts-server:
    image: rhasspy/wyoming-piper:latest
    ports:
      - "5000:5000"
      - "10200:10200"
    volumes:
      - ./piper-data:/data
    command: --voice sk_SK-lili-medium --http-port 5000
```

### `docker-compose.yml` (aktualizovaný)
```yaml
services:
  voice-chat-backend:
    environment:
      - PIPER_TTS_URL=http://piper-tts-server:5000
    networks:
      - voice-chat-network

networks:
  voice-chat-network:
    external: true
```

## 🧪 Testovanie

### Automatické testy
```bash
# Kompletné testovanie
./test-piper-tts-deployment.sh

# Test konkrétnych endpointov
curl http://localhost:3000/api/tts/status
curl http://localhost:5000
```

### Manuálne testy
```bash
# Test TTS generovania
curl -X POST -H "Content-Type: application/json" \
     -d '{"text":"Test slovenského hlasu"}' \
     http://localhost:3000/api/tts/synthesize \
     --output test.wav

# Test Piper TTS servera priamo
curl -X POST -H "Content-Type: application/json" \
     -d '{"text":"Test", "voice":"sk_SK-lili-medium"}' \
     http://localhost:5000/api/tts \
     --output test-direct.wav
```

## 🚨 Riešenie Problémov

### Časté problémy

1. **Piper TTS server sa nespúšťa**
   ```bash
   docker logs piper-tts-server
   docker restart piper-tts-server
   ```

2. **Aplikácia nepoužíva remote TTS**
   ```bash
   curl http://localhost:3000/api/tts/status
   docker-compose restart voice-chat-backend
   ```

3. **Chýbajúce hlasové modely**
   ```bash
   ls -la piper-data/
   ./setup-piper-tts-web.sh
   ```

4. **Port konflikty**
   ```bash
   netstat -tulpn | grep -E ':(3000|5000)'
   docker-compose down
   ```

### Debug príkazy
```bash
# Stav kontajnerov
docker ps

# Logy služieb
docker logs piper-tts-server
docker-compose logs -f voice-chat-backend

# Testovanie sieťovej konektivity
docker exec voice-chat-backend ping piper-tts-server
```

## 📊 Výhody Nového Riešenia

### Výkon
- **10x rýchlejšie TTS** - model sa načíta raz
- **Nižšia záťaž CPU** - žiadne opakované spúšťanie
- **Lepšia škálovateľnosť** - viacero súčasných požiadavkov

### Jednoduchosť
- **Jeden príkaz deployment** - `./quick-deploy.sh`
- **Automatické nastavenie** - žiadna manuálna konfigurácia
- **Fallback mechanizmy** - graceful degradation

### Kompatibilita
- **Backward compatibility** - funguje s existujúcim kódom
- **Frontend ready** - žiadne zmeny v FE potrebné
- **Docker native** - využíva Docker ekosystém

## 🎯 Ďalšie Kroky

1. **Použiť `./quick-deploy.sh`** pre produkčný deployment
2. **Otestovať funkcionalitu** s `./test-piper-tts-deployment.sh`
3. **Monitorovať výkon** TTS generovania
4. **Optimalizovať** podľa potreby

---

**💡 Tip:** Pre najrýchlejší start použite `./quick-deploy.sh` - nastaví všetko automaticky!
