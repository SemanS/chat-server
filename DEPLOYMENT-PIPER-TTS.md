# Oracle Voice Chat Backend - Deployment s Piper TTS Server

Tento dokument popisuje nové deployment módy s integrovaným Piper TTS serverom.

## 🚀 Deployment Módy

### 1. Štandardný Deployment
```bash
./deploy-universal.sh
```
- Kompletný deployment s potvrdením
- Automatické nastavenie Piper TTS servera
- Inštalácia všetkých závislostí
- Testovanie funkcionality

### 2. Rýchly Deployment (bez potvrdenia)
```bash
./deploy-universal.sh quick
```
- Rovnaký ako štandardný, ale bez potvrdenia
- Ideálny pre automatizované deployment

### 3. Deployment len kódu
```bash
./deploy-universal.sh code-only
```
- Aktualizuje len aplikačný kód
- Neinstaluje systémové závislosti
- Rýchly update existujúcej inštalácie

### 4. Rollback na predchádzajúcu verziu
```bash
./deploy-universal.sh rollback
```
- Vráti sa na posledný funkčný backup
- Automatické obnovenie služieb

### 5. Quick Deploy (s lokálnym Piper TTS)
```bash
./quick-deploy.sh
```
- Najprv nastaví Piper TTS lokálne
- Potom spustí deployment na server
- Kompletné riešenie v jednom príkaze

## 🔊 Piper TTS Server Integrácia

### Automatické nastavenie
Všetky deployment skripty teraz automaticky:

1. **Sťahujú slovenský voice model** (`sk_SK-lili-medium`)
2. **Spúšťajú Piper TTS server** v Docker kontajneri
3. **Konfigurujú aplikáciu** na použitie remote TTS
4. **Testujú funkcionalitu** TTS generovania

### Konfigurácia
```env
# TTS Configuration - Remote Piper TTS Server
PIPER_TTS_URL=http://piper-tts-server:5000
TTS_VOICE=sk_SK-lili-medium
TTS_CACHE_ENABLED=true
```

### Docker Compose
Automaticky sa vytvorí `docker-compose.piper-tts.yml`:
```yaml
services:
  piper-tts-server:
    image: rhasspy/wyoming-piper:latest
    ports:
      - "5000:5000"    # HTTP API
      - "10200:10200"  # Wyoming protokol
    volumes:
      - ./piper-data:/data
    command: --voice sk_SK-lili-medium --http-port 5000
```

## 🛠️ Lokálny Vývoj

### Nastavenie lokálneho prostredia
```bash
./start-local-with-piper.sh
```

Tento skript:
- Skontroluje prerekvizity (Node.js, Docker)
- Nainštaluje závislosti
- Nastaví Piper TTS server lokálne
- Vytvorí `.env` súbor pre development
- Otestuje funkcionalitu
- Spustí aplikáciu v dev móde

### Len nastavenie (bez spustenia)
```bash
./start-local-with-piper.sh setup-only
```

### Manuálne nastavenie Piper TTS
```bash
./setup-piper-tts-web.sh
```

## 📋 Výhody nového riešenia

### Výkon
- **10x rýchlejšie TTS generovanie** - model sa načíta raz
- **Nižšia záťaž CPU** - žiadne opakované spúšťanie procesov
- **Lepšia škálovateľnosť** - server obsluží viacero požiadavkov súčasne

### Jednoduchosť
- **Automatické nastavenie** - žiadna manuálna konfigurácia
- **Jeden príkaz** - kompletný deployment
- **Fallback mechanizmy** - graceful degradation pri problémoch

### Kompatibilita
- **Backward compatibility** - zachováva podporu starých metód
- **Frontend ready** - funguje s existujúcim frontend kódom
- **Docker native** - využíva Docker ekosystém

## 🧪 Testovanie

### Automatické testy
Každý deployment automaticky testuje:
```bash
# Test Piper TTS Server
curl -X POST -H "Content-Type: application/json" \
     -d '{"text":"Test", "voice":"sk_SK-lili-medium"}' \
     http://localhost:5000/api/tts

# Test aplikačného TTS API
curl -X POST -H "Content-Type: application/json" \
     -d '{"text":"Test"}' \
     http://localhost:3000/api/tts/synthesize

# Test TTS status
curl http://localhost:3000/api/tts/status
```

### Manuálne testovanie
```bash
# Stav kontajnerov
docker-compose -f docker-compose.piper-tts.yml ps

# Logy Piper TTS servera
docker logs piper-tts-server

# Test generovania reči
curl -X POST -H "Content-Type: application/json" \
     -d '{"text":"Ahoj, toto je test slovenského hlasu"}' \
     http://localhost:5000/api/tts --output test.wav
```

## 🔧 Správa služieb

### Piper TTS Server
```bash
# Spustenie
docker-compose -f docker-compose.piper-tts.yml up -d

# Zastavenie
docker-compose -f docker-compose.piper-tts.yml down

# Reštart
docker-compose -f docker-compose.piper-tts.yml restart

# Logy
docker-compose -f docker-compose.piper-tts.yml logs -f
```

### Hlavná aplikácia
```bash
# Spustenie
docker-compose up -d

# Zastavenie
docker-compose down

# Reštart
docker-compose restart voice-chat-backend

# Logy
docker-compose logs -f voice-chat-backend
```

## 🚨 Riešenie problémov

### Piper TTS server sa nespúšťa
```bash
# Kontrola logov
docker logs piper-tts-server

# Kontrola portov
netstat -tulpn | grep :5000

# Reštart
docker restart piper-tts-server
```

### Aplikácia nepoužíva remote TTS
```bash
# Kontrola environment premenných
docker exec oracle-voice-chat-backend env | grep PIPER

# Kontrola TTS status
curl http://localhost:3000/api/tts/status

# Reštart aplikácie
docker-compose restart voice-chat-backend
```

### Chýbajúce hlasové modely
```bash
# Kontrola súborov
ls -la piper-data/

# Manuálne stiahnutie
curl -L -o piper-data/sk_SK-lili-medium.onnx \
  "https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/sk/sk_SK/lili/medium/sk_SK-lili-medium.onnx"
```

## 📊 Monitoring

### Health Checks
```bash
# Aplikácia
curl http://localhost:3000/health

# Piper TTS Server
curl http://localhost:5000

# TTS funkcionalita
curl http://localhost:3000/api/tts/status
```

### Metriky
Aplikácia automaticky trackuje:
- Doba TTS generovania
- Veľkosť audio súborov
- Cache hit/miss ratio
- Chybovosť TTS požiadavkov

## 🔄 Migration z pôvodného riešenia

### Automatická migrácia
Nové deployment skripty automaticky:
1. Detekujú existujúcu inštaláciu
2. Vytvorí backup
3. Aktualizujú konfiguráciu
4. Spustia Piper TTS server
5. Otestujú funkcionalitu

### Manuálna migrácia
```bash
# 1. Backup existujúcej konfigurácie
cp .env .env.backup

# 2. Nastavenie Piper TTS servera
./setup-piper-tts-web.sh

# 3. Aktualizácia .env
echo "PIPER_TTS_URL=http://piper-tts-server:5000" >> .env

# 4. Reštart aplikácie
docker-compose restart
```

## 🎯 Ďalšie kroky

1. **Produkčné nasadenie** - použiť `./quick-deploy.sh`
2. **Monitoring** - pridať Prometheus metriky
3. **Load balancing** - viacero TTS serverov
4. **Optimalizácia** - fine-tuning hlasových modelov
5. **Backup stratégia** - automatické zálohy hlasových modelov
