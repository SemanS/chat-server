const express = require('express');
const { spawn } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const { trackMetric } = require('./metrics');
const router = express.Router();

// TTS Configuration
const TTS_CONFIG = {
    // For development, we'll use Web Speech API fallback
    // In production, you would install Piper TTS binary
    piperPath: process.env.PIPER_PATH || null,
    voicesPath: process.env.PIPER_VOICES_PATH || './voices',
    defaultVoice: process.env.TTS_VOICE || 'sk-SK-female',
    cacheEnabled: process.env.TTS_CACHE_ENABLED === 'true',
    cacheDir: './tmp/tts_cache',
    maxCacheSize: 100 * 1024 * 1024, // 100MB
};

// Ensure cache directory exists
async function ensureCacheDir() {
    try {
        await fs.mkdir(TTS_CONFIG.cacheDir, { recursive: true });
    } catch (error) {
        console.warn('⚠️ Could not create TTS cache directory:', error.message);
    }
}

// Generate cache key for text and voice
function getCacheKey(text, voice) {
    return crypto.createHash('md5').update(`${text}-${voice}`).digest('hex');
}

// Check if cached audio exists
async function getCachedAudio(cacheKey) {
    if (!TTS_CONFIG.cacheEnabled) return null;

    try {
        const cachePath = path.join(TTS_CONFIG.cacheDir, `${cacheKey}.wav`);
        const audioBuffer = await fs.readFile(cachePath);
        console.log(`🎵 Using cached TTS audio: ${cachePath}`);
        return audioBuffer;
    } catch (error) {
        return null; // Cache miss
    }
}

// Save audio to cache
async function cacheAudio(cacheKey, audioBuffer) {
    if (!TTS_CONFIG.cacheEnabled) return;

    try {
        const cachePath = path.join(TTS_CONFIG.cacheDir, `${cacheKey}.wav`);
        await fs.writeFile(cachePath, audioBuffer);
        console.log(`💾 Cached TTS audio: ${cachePath}`);
    } catch (error) {
        console.warn('⚠️ Could not cache TTS audio:', error.message);
    }
}

// Generate TTS using Piper (if available)
async function generatePiperTTS(text, voice) {
    return new Promise((resolve, reject) => {
        if (!TTS_CONFIG.piperPath) {
            reject(new Error('Piper TTS not configured'));
            return;
        }

        const voiceFile = path.join(TTS_CONFIG.voicesPath, `${voice}.onnx`);
        const args = [
            '--model', voiceFile,
            '--output_file', '-', // Output to stdout
        ];

        console.log(`🔊 Generating Piper TTS: "${text}" with voice ${voice}`);

        const piper = spawn(TTS_CONFIG.piperPath, args);
        const audioChunks = [];

        piper.stdout.on('data', (chunk) => {
            audioChunks.push(chunk);
        });

        piper.stderr.on('data', (data) => {
            console.error('Piper TTS error:', data.toString());
        });

        piper.on('close', (code) => {
            if (code === 0) {
                const audioBuffer = Buffer.concat(audioChunks);
                resolve(audioBuffer);
            } else {
                reject(new Error(`Piper TTS exited with code ${code}`));
            }
        });

        piper.on('error', (error) => {
            reject(error);
        });

        // Send text to Piper
        piper.stdin.write(text);
        piper.stdin.end();
    });
}

// Generate mock TTS audio (simple WAV header + silence)
function generateMockTTS(text, voice) {
    console.log(`🧪 Generating mock TTS for: "${text}" with voice ${voice}`);

    // Create a simple WAV file with silence
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

    // Audio data (silence)
    const audioData = Buffer.alloc(numSamples * 2);

    return Buffer.concat([header, audioData]);
}

// POST /api/tts/synthesize - Text to speech synthesis
router.post('/synthesize', async (req, res) => {
    const startTime = Date.now();

    try {
        const { text, voice = TTS_CONFIG.defaultVoice, language = 'sk-SK' } = req.body;

        if (!text || typeof text !== 'string') {
            return res.status(400).json({
                error: 'Invalid text',
                message: 'Text parameter is required and must be a string'
            });
        }

        if (text.length > 1000) {
            return res.status(400).json({
                error: 'Text too long',
                message: 'Text must be less than 1000 characters'
            });
        }

        console.log(`🔊 TTS synthesis request: "${text}" (voice: ${voice})`);

        // Check cache first
        const cacheKey = getCacheKey(text, voice);
        let audioBuffer = await getCachedAudio(cacheKey);

        if (!audioBuffer) {
            // Generate new audio
            try {
                if (TTS_CONFIG.piperPath) {
                    audioBuffer = await generatePiperTTS(text, voice);
                } else {
                    // Fallback to mock TTS
                    audioBuffer = generateMockTTS(text, voice);
                }

                // Cache the result
                await cacheAudio(cacheKey, audioBuffer);

            } catch (error) {
                console.error('❌ TTS generation failed:', error);

                // Fallback to mock TTS
                audioBuffer = generateMockTTS(text, voice);
            }
        }

        // Track metrics
        const duration = Date.now() - startTime;
        trackMetric('tts', 'synthesize', {
            duration,
            textLength: text.length,
            audioSize: audioBuffer.length,
            voice,
            cached: audioBuffer !== null
        });

        res.set({
            'Content-Type': 'audio/wav',
            'Content-Length': audioBuffer.length,
            'Cache-Control': 'public, max-age=3600'
        });

        res.send(audioBuffer);

    } catch (error) {
        console.error('❌ TTS synthesis error:', error);

        const duration = Date.now() - startTime;
        trackMetric('tts', 'error', { duration, error: error.message });

        res.status(500).json({
            error: 'TTS synthesis failed',
            message: error.message,
            duration: duration,
            timestamp: new Date().toISOString()
        });
    }
});

// GET /api/tts/voices - Available voices
router.get('/voices', (req, res) => {
    const availableVoices = [
        {
            id: 'sk-SK-female',
            name: 'Slovak Female',
            language: 'sk-SK',
            gender: 'female',
            description: 'Standard Slovak female voice',
            recommended: true
        },
        {
            id: 'sk-SK-male',
            name: 'Slovak Male',
            language: 'sk-SK',
            gender: 'male',
            description: 'Standard Slovak male voice',
            recommended: false
        },
        {
            id: 'en-US-female',
            name: 'English US Female',
            language: 'en-US',
            gender: 'female',
            description: 'Standard US English female voice',
            recommended: false
        },
        {
            id: 'en-US-male',
            name: 'English US Male',
            language: 'en-US',
            gender: 'male',
            description: 'Standard US English male voice',
            recommended: false
        }
    ];

    res.json({
        voices: availableVoices,
        default: TTS_CONFIG.defaultVoice,
        timestamp: new Date().toISOString()
    });
});

// GET /api/tts/status - Service status
router.get('/status', (req, res) => {
    const piperConfigured = !!TTS_CONFIG.piperPath;

    res.json({
        status: piperConfigured ? 'operational' : 'mock',
        configured: piperConfigured,
        piperPath: piperConfigured ? 'configured' : 'missing',
        mockMode: !piperConfigured,
        cacheEnabled: TTS_CONFIG.cacheEnabled,
        defaultVoice: TTS_CONFIG.defaultVoice,
        timestamp: new Date().toISOString()
    });
});

// Initialize cache directory on startup
ensureCacheDir();

module.exports = router;