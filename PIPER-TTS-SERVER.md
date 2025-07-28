# Piper TTS Server Setup

Tento dokument popisuje nastavenie samostatného Piper TTS servera pre zlepšenie výkonu generovania reči.

## Problém s aktuálnym riešením

Súčasná implementácia v `src/tts.js` spúšťa Piper binárku pre každý TTS požiadavok pomocou `spawn()`. Toto spôsobuje:

- **Vysoké oneskorenie**: Každé spustenie načítava veľký .onnx model (cca 63MB)
- **Vysokú záťaž CPU**: Opakované načítavanie modelu
- **Neefektívnosť**: Model sa načítava znovu a znovu namiesto jednorazového načítania

## Riešenie: Samostatný TTS Server

Použitím Docker kontajnera s Piper TTS serverom sa model načíta raz a zostane v pamäti.

### Dostupné Docker obrazy

1. **rhasspy/wyoming-piper** (oficiálny)
   - Podporuje HTTP API aj Wyoming protokol
   - HTTP server na porte 5000
   - Konfigurovateľný hlas cez `--voice` parameter

2. **waveoffire/piper-tts-server** (komunitný)
   - Jednoduchý HTTP API
   - POST požiadavky s textom v tele

## Rýchle nastavenie

### 1. Automatický setup script

```bash
# Spustenie oficiálneho Wyoming Piper servera
./setup-piper-tts-server.sh wyoming

# Spustenie alternatívneho servera
./setup-piper-tts-server.sh alternative

# Spustenie oboch serverov
./setup-piper-tts-server.sh both
```

### 2. Docker Compose (odporúčané)

```bash
# Vytvorenie adresára pre hlasové modely
mkdir -p piper-data

# Stiahnutie slovenského hlasu
curl -L -o piper-data/sk_SK-lili-medium.onnx \
  "https://huggingface.co/rhasspy/piper-voices/resolve/main/sk/sk_SK/lili/medium/sk_SK-lili-medium.onnx"
curl -L -o piper-data/sk_SK-lili-medium.onnx.json \
  "https://huggingface.co/rhasspy/piper-voices/resolve/main/sk/sk_SK/lili/medium/sk_SK-lili-medium.onnx.json"

# Spustenie TTS servera
docker-compose -f docker-compose.piper-tts.yml up -d piper-tts-wyoming
```

### 3. Manuálne Docker príkazy

```bash
# Wyoming Piper (oficiálny)
docker run -d \
  --name piper-tts-server \
  -p 5000:5000 \
  -v $(pwd)/piper-data:/data \
  rhasspy/wyoming-piper \
  --voice sk_SK-lili-medium \
  --http-port 5000

# Alternatívny server
docker run -d \
  --name piper-tts-simple \
  -p 5001:5000 \
  waveoffire/piper-tts-server:latest
```

## Konfigurácia aplikácie

### Environment premenné

Pridaj do `.env` súboru:

```env
# Remote TTS Server URL
PIPER_TTS_URL=http://localhost:5000

# Zachovaj existujúce nastavenia pre fallback
PIPER_PATH=/usr/local/bin/piper
PIPER_VOICES_PATH=/app/voices
TTS_VOICE=sk_SK-lili-medium
TTS_CACHE_ENABLED=true
```

### Logika výberu TTS

Aplikácia automaticky vyberie TTS metódu v tomto poradí:

1. **Remote TTS** (ak je `PIPER_TTS_URL` nastavené)
2. **Local Piper** (ak je `PIPER_PATH` nastavené)
3. **Mock TTS** (fallback)

## Testovanie

### 1. Test TTS servera

```bash
# Test Wyoming Piper API
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{"text": "Ahoj, toto je test.", "voice": "sk_SK-lili-medium"}' \
  http://localhost:5000/api/tts \
  --output test.wav

# Test jednoduchého servera
curl -X POST \
  -H "Content-Type: text/plain" \
  -d "Ahoj, toto je test." \
  http://localhost:5001 \
  --output test.wav
```

### 2. Test aplikačného API

```bash
# Test TTS endpoint
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{"text": "Ahoj, toto je test TTS servera."}' \
  http://localhost:3000/api/tts/synthesize \
  --output app-test.wav

# Kontrola statusu
curl http://localhost:3000/api/tts/status
```

## Výhody riešenia

### Výkon
- **Rýchlejšie generovanie**: Model sa načíta raz
- **Nižšia záťaž CPU**: Žiadne opakované spúšťanie procesov
- **Lepšia škálovateľnosť**: Server môže obsluhovať viacero požiadavkov súčasne

### Správa
- **Jednoduchšie nasadenie**: Docker kontajnery
- **Lepšie monitorovanie**: Health checks, logy
- **Flexibilita**: Možnosť použiť rôzne TTS servery

### Kompatibilita
- **Backward compatibility**: Zachováva podporu lokálneho Piper
- **Graceful fallback**: Automatický prechod na lokálny/mock TTS pri problémoch
- **Konfigurovateľnosť**: Jednoduché prepínanie medzi metódami

## Riešenie problémov

### Server sa nespúšťa

```bash
# Kontrola Docker logov
docker logs piper-tts-server

# Kontrola portov
netstat -tulpn | grep :5000

# Reštart kontajnera
docker restart piper-tts-server
```

### Chýbajúce hlasové modely

```bash
# Kontrola obsahu adresára
ls -la piper-data/

# Manuálne stiahnutie
curl -L -o piper-data/sk_SK-lili-medium.onnx \
  "https://huggingface.co/rhasspy/piper-voices/resolve/main/sk/sk_SK/lili/medium/sk_SK-lili-medium.onnx"
```

### Aplikácia nepoužíva remote TTS

```bash
# Kontrola environment premenných
echo $PIPER_TTS_URL

# Kontrola .env súboru
grep PIPER_TTS_URL .env

# Reštart aplikácie
pm2 restart voice-chat
```

## Monitoring

### Docker Compose monitoring

```bash
# Status kontajnerov
docker-compose -f docker-compose.piper-tts.yml ps

# Logy
docker-compose -f docker-compose.piper-tts.yml logs -f piper-tts-wyoming

# Health check
docker-compose -f docker-compose.piper-tts.yml exec piper-tts-wyoming curl -f http://localhost:5000
```

### Aplikačné metriky

Aplikácia trackuje metriky cez `trackMetric()`:
- Doba generovania TTS
- Veľkosť audio súborov
- Použitý hlas
- Cache hit/miss

## Ďalšie kroky

1. **Produkčné nasadenie**: Použiť Docker Compose s restart policies
2. **Load balancing**: Viacero TTS serverov za load balancerom
3. **Monitoring**: Pridať Prometheus metriky
4. **Optimalizácia**: Fine-tuning hlasových modelov
