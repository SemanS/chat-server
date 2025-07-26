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
const { sessionMiddleware } = require('./middleware/session');

// Import routes
const deepgramRoutes = require('./src/deepgram');
const ttsRoutes = require('./src/tts');
const chatRoutes = require('./src/chat');
const metricsRoutes = require('./src/metrics');

const app = express();
const server = http.createServer(app);

// WebSocket server
const wss = new WebSocket.Server({
    server,
    path: '/ws'
});

// Basic middleware (helmet temporarily disabled for debugging)
// app.use(helmet({
//     contentSecurityPolicy: false,
//     crossOriginEmbedderPolicy: false
// }));
app.use(compression());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Rate limiting (temporarily disabled for debugging)
// const limiter = rateLimit({
//     windowMs: 15 * 60 * 1000, // 15 minutes
//     max: 100, // limit each IP to 100 requests per windowMs
//     message: 'Too many requests from this IP, please try again later.'
// });
// app.use('/api/', limiter);

// CORS middleware
app.use(corsMiddleware);

// Session middleware (temporarily disabled for debugging)
// app.use(sessionMiddleware);

// Debug middleware
app.use((req, res, next) => {
    console.log(`📥 ${req.method} ${req.url} from ${req.ip}`);
    next();
});

// Health check endpoint
app.get('/health', (req, res) => {
    console.log('💚 Health check requested');
    res.status(200).send('OK');
});

// API routes
app.use('/api/deepgram', deepgramRoutes);
app.use('/api/tts', ttsRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/metrics', metricsRoutes);

// Convenience endpoints for frontend compatibility
app.post('/api/transcribe', (req, res, next) => {
    req.url = '/transcribe';
    deepgramRoutes(req, res, next);
});

app.post('/api/speak', (req, res, next) => {
    req.url = '/synthesize';
    ttsRoutes(req, res, next);
});

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

// WebSocket message handlers
async function handleVoiceMessage(ws, audioBuffer, sessionId) {
    try {
        console.log(`🎤 Processing voice message: ${audioBuffer.length} bytes from session ${sessionId}`);

        // Step 1: Transcribe audio using Deepgram
        const multer = require('multer');
        const upload = multer({ storage: multer.memoryStorage() });

        // Create a mock request object for Deepgram
        const mockReq = {
            file: {
                buffer: audioBuffer,
                originalname: 'voice.webm',
                mimetype: 'audio/webm',
                size: audioBuffer.length
            },
            body: { detect_language: true }
        };

        // Call Deepgram transcription
        const { createClient } = require('@deepgram/sdk');
        let deepgram = null;
        if (process.env.DEEPGRAM_API_KEY && process.env.DEEPGRAM_API_KEY !== 'mock') {
            deepgram = createClient(process.env.DEEPGRAM_API_KEY);
        }

        let transcript = '';

        if (!deepgram) {
            // Mock transcription
            transcript = 'Toto je mock transkripcia hlasovej správy.';
            console.log('🧪 Using mock Deepgram transcription');
        } else {
            // Real Deepgram API call - optimized for Opus/WebM
            const options = {
                model: 'nova-2',
                language: 'sk',         // Correct Slovak language code for nova-2 model
                punctuate: true,
                smart_format: true,
                // Minimálne parametre pre WebM/Opus - nechaj Deepgram autodetegovať formát
                detect_language: false     // Nedeteguj jazyk, použij sk-SK
                // NEPOUŽÍVAJ encoding, sample_rate, filler_words, numerals, detect_topics, summarize
                // pre WebM/Opus - spôsobuje "corrupt data" chyby
            };

            const { result, error } = await deepgram.listen.prerecorded.transcribeFile(
                audioBuffer,
                options
            );

            if (error) {
                throw new Error(`Deepgram error: ${error.message}`);
            }

            transcript = result?.results?.channels?.[0]?.alternatives?.[0]?.transcript || '';
        }

        console.log(`📝 Transcribed: "${transcript}"`);

        if (!transcript || transcript.trim().length === 0) {
            ws.send(JSON.stringify({
                type: 'error',
                message: 'No speech detected in audio',
                sessionId: sessionId,
                timestamp: new Date().toISOString()
            }));
            return;
        }

        // Send transcription to client
        ws.send(JSON.stringify({
            type: 'transcription',
            transcript: transcript,
            sessionId: sessionId,
            timestamp: new Date().toISOString()
        }));

        // Step 2: Get AI response using OpenAI
        const OpenAI = require('openai');
        let openai = null;
        if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'mock') {
            openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
        }

        let aiResponse = '';

        if (!openai) {
            // Mock AI response
            aiResponse = `Rozumiem vašej správe: "${transcript}". Toto je mock odpoveď.`;
            console.log('🧪 Using mock OpenAI response');
        } else {
            // Real OpenAI API call
            const completion = await openai.chat.completions.create({
                model: 'gpt-4',
                messages: [
                    {
                        role: 'system',
                        content: 'Si užitočný AI asistent. Odpovedaj v slovenčine, buď stručný a priateľský.'
                    },
                    {
                        role: 'user',
                        content: transcript
                    }
                ],
                max_tokens: 500,
                temperature: 0.7
            });

            aiResponse = completion.choices[0]?.message?.content || 'Prepáčte, nepodarilo sa mi vygenerovať odpoveď.';
        }

        console.log(`🤖 AI response: "${aiResponse}"`);

        // Send AI response to client
        ws.send(JSON.stringify({
            type: 'ai_response',
            message: aiResponse,
            transcript: transcript,
            sessionId: sessionId,
            timestamp: new Date().toISOString()
        }));

        // Step 3: Generate TTS audio
        await generateAndSendTTS(ws, aiResponse, sessionId);

    } catch (error) {
        console.error(`❌ Voice message processing error for session ${sessionId}:`, error);

        ws.send(JSON.stringify({
            type: 'error',
            message: 'Voice processing failed',
            error: error.message,
            sessionId: sessionId,
            timestamp: new Date().toISOString()
        }));
    }
}

async function handleVoiceChatMessage(ws, message, sessionId) {
    try {
        console.log(`💬 Voice chat message from ${sessionId}:`, message);

        // This handles JSON voice chat messages (not binary audio)
        if (message.message) {
            // Process text message through AI
            await handleTextChatMessage(ws, message, sessionId);
        } else {
            ws.send(JSON.stringify({
                type: 'error',
                message: 'Voice chat message missing content',
                sessionId: sessionId,
                timestamp: new Date().toISOString()
            }));
        }

    } catch (error) {
        console.error(`❌ Voice chat message error for session ${sessionId}:`, error);

        ws.send(JSON.stringify({
            type: 'error',
            message: 'Voice chat processing failed',
            error: error.message,
            sessionId: sessionId,
            timestamp: new Date().toISOString()
        }));
    }
}

async function handleTextChatMessage(ws, message, sessionId) {
    try {
        console.log(`💬 Text chat message from ${sessionId}:`, message.message);

        // Get AI response using OpenAI
        const OpenAI = require('openai');
        let openai = null;
        if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'mock') {
            openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
        }

        let aiResponse = '';

        if (!openai) {
            // Mock AI response
            aiResponse = `Rozumiem vašej správe: "${message.message}". Toto je mock odpoveď.`;
            console.log('🧪 Using mock OpenAI response');
        } else {
            // Real OpenAI API call
            const completion = await openai.chat.completions.create({
                model: 'gpt-4',
                messages: [
                    {
                        role: 'system',
                        content: 'Si užitočný AI asistent. Odpovedaj v slovenčine, buď stručný a priateľský.'
                    },
                    {
                        role: 'user',
                        content: message.message
                    }
                ],
                max_tokens: 500,
                temperature: 0.7
            });

            aiResponse = completion.choices[0]?.message?.content || 'Prepáčte, nepodarilo sa mi vygenerovať odpoveď.';
        }

        console.log(`🤖 AI response: "${aiResponse}"`);

        // Send AI response to client
        ws.send(JSON.stringify({
            type: 'ai_response',
            message: aiResponse,
            sessionId: sessionId,
            timestamp: new Date().toISOString()
        }));

    } catch (error) {
        console.error(`❌ Text chat message error for session ${sessionId}:`, error);

        ws.send(JSON.stringify({
            type: 'error',
            message: 'Text chat processing failed',
            error: error.message,
            sessionId: sessionId,
            timestamp: new Date().toISOString()
        }));
    }
}

async function generateAndSendTTS(ws, text, sessionId) {
    try {
        console.log(`🔊 Generating TTS for session ${sessionId}: "${text}"`);

        if (!process.env.PIPER_PATH) {
            // Ak Piper nie je dostupný, nechaj frontend použiť Web Speech API
            console.log('🧪 Piper nie je dostupný - frontend použije Web Speech API');
            // ai_response správa už bola poslaná, frontend ju spracuje s Web Speech API
            return;
        }

        // Use real Piper TTS
        console.log('🔊 Using Piper TTS');
        let audioBuffer;
        try {
            audioBuffer = await generatePiperTTSAudio(text);
        } catch (error) {
            console.error('❌ Piper TTS failed, frontend použije Web Speech API fallback:', error);
            // Neposielame mock audio, nechaj frontend použiť Web Speech API
            return;
        }

        // Send audio as binary data
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(audioBuffer);
            console.log(`🔊 Sent TTS audio: ${audioBuffer.length} bytes to session ${sessionId}`);
        }

    } catch (error) {
        console.error(`❌ TTS generation error for session ${sessionId}:`, error);

        ws.send(JSON.stringify({
            type: 'error',
            message: 'TTS generation failed',
            error: error.message,
            sessionId: sessionId,
            timestamp: new Date().toISOString()
        }));
    }
}

function generateMockTTSAudio(text) {
    // Create a simple WAV file with silence (same as in tts.js)
    const sampleRate = 22050;
    const duration = Math.max(1, Math.min(10, text.length * 0.1)); // 0.1s per character, max 10s
    const numSamples = Math.floor(sampleRate * duration);
    const numChannels = 1;
    const bitsPerSample = 16;

    // WAV header
    const header = Buffer.alloc(44);
    header.write('RIFF', 0);
    header.writeUInt32LE(36 + numSamples * 2, 4);
    header.write('WAVE', 8);
    header.write('fmt ', 12);
    header.writeUInt32LE(16, 16);
    header.writeUInt16LE(1, 20);
    header.writeUInt16LE(numChannels, 22);
    header.writeUInt32LE(sampleRate, 24);
    header.writeUInt32LE(sampleRate * numChannels * bitsPerSample / 8, 28);
    header.writeUInt16LE(numChannels * bitsPerSample / 8, 32);
    header.writeUInt16LE(bitsPerSample, 34);
    header.write('data', 36);
    header.writeUInt32LE(numSamples * 2, 40);

    // Audio data (generate simple tone instead of silence)
    const audioData = Buffer.alloc(numSamples * 2);
    const frequency = 440; // A4 note
    const amplitude = 8000; // Volume level

    for (let i = 0; i < numSamples; i++) {
        // Generate sine wave
        const sample = Math.sin(2 * Math.PI * frequency * i / sampleRate) * amplitude;
        // Apply envelope to avoid clicks (fade in/out)
        const envelope = Math.min(i / (sampleRate * 0.1), 1) * Math.min((numSamples - i) / (sampleRate * 0.1), 1);
        const finalSample = Math.round(sample * envelope);

        // Write 16-bit signed integer (little endian)
        audioData.writeInt16LE(finalSample, i * 2);
    }

    return Buffer.concat([header, audioData]);
}

// Generate TTS using Piper (real implementation)
async function generatePiperTTSAudio(text) {
    const { spawn } = require('child_process');
    const path = require('path');
    const fs = require('fs').promises;
    const fsSync = require('fs');
    const os = require('os');

    return new Promise(async (resolve, reject) => {
        const piperPath = process.env.PIPER_PATH;
        const voicesPath = process.env.PIPER_VOICES_PATH || '/app/voices';
        const voiceName = process.env.TTS_VOICE || 'sk_SK-lili-medium';

        if (!piperPath) {
            reject(new Error('PIPER_PATH not configured'));
            return;
        }

        // Check if voice file exists
        const voiceFile = path.join(voicesPath, `${voiceName}.onnx`);
        if (!fsSync.existsSync(voiceFile)) {
            console.error(`❌ Voice file not found: ${voiceFile}`);
            reject(new Error(`Voice file not found: ${voiceName}.onnx`));
            return;
        }

        // Create temporary file for WAV output
        const tmpFile = path.join(os.tmpdir(), `tts-${Date.now()}-${Math.random().toString(36).substr(2, 9)}.wav`);

        const args = [
            '--model', voiceFile,
            '--output_file', tmpFile, // Output to temporary WAV file instead of stdout
        ];

        console.log(`🔊 Generating Piper TTS: "${text}" with voice ${voiceName}`);
        console.log(`🎤 Using voice file: ${voiceFile}`);
        console.log(`📁 Output file: ${tmpFile}`);

        const piper = spawn(piperPath, args);
        let errorOutput = '';

        piper.stderr.on('data', (data) => {
            errorOutput += data.toString();
            console.error('Piper TTS stderr:', data.toString());
        });

        piper.on('close', async (code) => {
            if (code === 0) {
                try {
                    // Read the generated WAV file
                    const audioBuffer = await fs.readFile(tmpFile);
                    console.log(`✅ Piper TTS generated ${audioBuffer.length} bytes of WAV audio`);

                    // Clean up temporary file
                    try {
                        await fs.unlink(tmpFile);
                    } catch (cleanupError) {
                        console.warn(`⚠️ Could not delete temp file ${tmpFile}:`, cleanupError.message);
                    }

                    resolve(audioBuffer);
                } catch (readError) {
                    console.error(`❌ Error reading generated audio file ${tmpFile}:`, readError);
                    reject(new Error(`Failed to read generated audio: ${readError.message}`));
                }
            } else {
                console.error(`❌ Piper TTS exited with code ${code}, stderr: ${errorOutput}`);
                // Clean up temporary file on error
                try {
                    await fs.unlink(tmpFile);
                } catch (cleanupError) {
                    console.warn(`⚠️ Could not delete temp file ${tmpFile}:`, cleanupError.message);
                }
                reject(new Error(`Piper TTS exited with code ${code}: ${errorOutput}`));
            }
        });

        piper.on('error', async (error) => {
            console.error(`❌ Piper TTS spawn error:`, error);
            // Clean up temporary file on error
            try {
                await fs.unlink(tmpFile);
            } catch (cleanupError) {
                console.warn(`⚠️ Could not delete temp file ${tmpFile}:`, cleanupError.message);
            }
            reject(error);
        });

        // Send text to Piper
        try {
            piper.stdin.write(text);
            piper.stdin.end();
        } catch (error) {
            console.error(`❌ Error writing to Piper stdin:`, error);
            // Clean up temporary file on error
            try {
                await fs.unlink(tmpFile);
            } catch (cleanupError) {
                console.warn(`⚠️ Could not delete temp file ${tmpFile}:`, cleanupError.message);
            }
            reject(error);
        }
    });
}

// WebSocket connection handling
wss.on('connection', (ws, req) => {
    console.log('🔌 New WebSocket connection from:', req.socket.remoteAddress);

    // Generate unique session ID
    const sessionId = 'ws_' + Math.random().toString(36).substr(2, 9);
    ws.sessionId = sessionId;

    // Track connection metrics (safe import)
    try {
        const { trackMetric } = require('./src/metrics');
        trackMetric('websocket', 'connect', { sessionId });
    } catch (error) {
        console.log('📊 Metrics tracking not available:', error.message);
    }

    // Send handshake message
    ws.send(JSON.stringify({
        type: 'connection',
        sessionId: sessionId,
        message: 'Connected to Oracle Voice Chat Backend',
        features: ['voice_chat', 'text_chat', 'ping_pong'],
        timestamp: new Date().toISOString()
    }));

    // Setup ping/pong for connection keepalive
    const pingInterval = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
            ws.ping();
        }
    }, 30000); // Ping every 30 seconds

    ws.on('pong', () => {
        console.log(`🏓 Pong received from session ${sessionId}`);
    });

    // Handle messages
    ws.on('message', async (data) => {
        try {
            // Track message metrics (safe import)
            try {
                const { trackMetric } = require('./src/metrics');
                trackMetric('websocket', 'message_received', { sessionId });
            } catch (error) {
                console.log('📊 Metrics tracking not available:', error.message);
            }

            // Check if it's binary data (audio)
            if (data instanceof Buffer) {
                console.log(`🎵 Binary audio data received: ${data.length} bytes from session ${sessionId}`);
                await handleVoiceMessage(ws, data, sessionId);
                return;
            }

            // Handle text messages
            const message = data.toString();
            console.log(`📨 WebSocket text message from ${sessionId}:`, message);

            let parsedMessage;
            try {
                parsedMessage = JSON.parse(message);
            } catch (e) {
                // Handle plain text messages
                parsedMessage = { type: 'text_chat', message: message };
            }

            switch (parsedMessage.type) {
                case 'voice_chat':
                    await handleVoiceChatMessage(ws, parsedMessage, sessionId);
                    break;

                case 'text_chat':
                    await handleTextChatMessage(ws, parsedMessage, sessionId);
                    break;

                case 'ping':
                    ws.send(JSON.stringify({
                        type: 'pong',
                        timestamp: new Date().toISOString()
                    }));
                    break;

                case 'end_voice':
                    console.log(`🔇 Voice session ended for ${sessionId}`);
                    ws.send(JSON.stringify({
                        type: 'voice_ended',
                        sessionId: sessionId,
                        timestamp: new Date().toISOString()
                    }));
                    break;

                default:
                    console.log(`❓ Unknown message type: ${parsedMessage.type}`);
                    ws.send(JSON.stringify({
                        type: 'error',
                        message: `Unknown message type: ${parsedMessage.type}`,
                        timestamp: new Date().toISOString()
                    }));
            }

        } catch (error) {
            console.error('❌ WebSocket message error:', error);
            // Track error metrics (safe import)
            try {
                const { trackMetric } = require('./src/metrics');
                trackMetric('websocket', 'error', { sessionId, error: error.message });
            } catch (metricsError) {
                console.log('📊 Metrics tracking not available:', metricsError.message);
            }

            ws.send(JSON.stringify({
                type: 'error',
                message: 'Failed to process message',
                error: error.message,
                sessionId: sessionId,
                timestamp: new Date().toISOString()
            }));
        }
    });

    // Handle connection close
    ws.on('close', (code, reason) => {
        console.log(`🔌 WebSocket connection closed: ${sessionId}, code: ${code}, reason: ${reason.toString()}`);
        clearInterval(pingInterval);
        try {
            const { trackMetric } = require('./src/metrics');
            trackMetric('websocket', 'disconnect', { sessionId, code });
        } catch (error) {
            console.log('📊 Metrics tracking not available:', error.message);
        }
    });

    // Handle errors
    ws.on('error', (error) => {
        console.error(`❌ WebSocket error for session ${sessionId}:`, error);
        // Track error metrics (safe import)
        try {
            const { trackMetric } = require('./src/metrics');
            trackMetric('websocket', 'error', { sessionId, error: error.message });
        } catch (metricsError) {
            console.log('📊 Metrics tracking not available:', metricsError.message);
        }
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
