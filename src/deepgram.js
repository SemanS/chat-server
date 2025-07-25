const express = require('express');
const multer = require('multer');
const { createClient } = require('@deepgram/sdk');
const { trackMetric } = require('./metrics');
const router = express.Router();

// Initialize Deepgram client (only if API key is available)
let deepgram = null;
if (process.env.DEEPGRAM_API_KEY && process.env.DEEPGRAM_API_KEY !== 'mock') {
    deepgram = createClient(process.env.DEEPGRAM_API_KEY);
}

// Configure multer for audio file uploads
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 50 * 1024 * 1024, // 50MB limit
        fieldSize: 50 * 1024 * 1024
    },
    fileFilter: (req, file, cb) => {
        // Accept audio files
        if (file.mimetype.startsWith('audio/') ||
            file.mimetype === 'application/octet-stream' ||
            file.originalname.endsWith('.webm') ||
            file.originalname.endsWith('.wav') ||
            file.originalname.endsWith('.mp3')) {
            cb(null, true);
        } else {
            cb(new Error('Only audio files are allowed'), false);
        }
    }
});

// POST /api/deepgram/transcribe - Audio transcription
router.post('/transcribe', upload.single('audio'), async (req, res) => {
    const startTime = Date.now();

    try {
        console.log('🎤 Deepgram transcription request received');

        if (!req.file) {
            return res.status(400).json({
                error: 'No audio file provided',
                message: 'Please upload an audio file'
            });
        }

        console.log(`📁 Audio file: ${req.file.originalname}, size: ${req.file.size} bytes, type: ${req.file.mimetype}`);

        // Check if we're in mock mode
        if (!deepgram) {
            console.log('🧪 Using mock Deepgram response');

            // Simulate processing time
            await new Promise(resolve => setTimeout(resolve, 500));

            const mockTranscript = "Toto je mock transkripcia pre testovanie. Skutočný Deepgram API kľúč nie je nastavený.";

            // Track metrics
            const duration = Date.now() - startTime;
            trackMetric('deepgram', 'transcribe', { duration, mock: true });

            return res.json({
                transcript: mockTranscript,
                confidence: 0.95,
                language: 'sk-SK',
                duration: duration,
                mock: true,
                timestamp: new Date().toISOString()
            });
        }

        // Real Deepgram API call
        const audioBuffer = req.file.buffer;

        // Configure transcription options
        const options = {
            model: 'nova-2',
            language: req.body.language || 'sk-SK',
            smart_format: true,
            punctuate: true,
            diarize: false,
            utterances: false,
            detect_language: false
        };

        console.log(`🔄 Sending ${audioBuffer.length} bytes to Deepgram with options:`, options);

        // Call Deepgram API
        const { result, error } = await deepgram.listen.prerecorded.transcribeFile(
            audioBuffer,
            options
        );

        if (error) {
            console.error('❌ Deepgram API error:', error);
            return res.status(500).json({
                error: 'Deepgram transcription failed',
                message: error.message,
                timestamp: new Date().toISOString()
            });
        }

        // Extract transcript from result
        const transcript = result?.results?.channels?.[0]?.alternatives?.[0]?.transcript || '';
        const confidence = result?.results?.channels?.[0]?.alternatives?.[0]?.confidence || 0;

        console.log(`📝 Deepgram transcript: "${transcript}" (confidence: ${confidence})`);

        // Track metrics
        const duration = Date.now() - startTime;
        trackMetric('deepgram', 'transcribe', {
            duration,
            audioSize: audioBuffer.length,
            confidence,
            transcriptLength: transcript.length
        });

        res.json({
            transcript: transcript,
            confidence: confidence,
            language: options.language,
            duration: duration,
            audioSize: audioBuffer.length,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ Deepgram transcription error:', error);

        const duration = Date.now() - startTime;
        trackMetric('deepgram', 'error', { duration, error: error.message });

        res.status(500).json({
            error: 'Transcription failed',
            message: error.message,
            duration: duration,
            timestamp: new Date().toISOString()
        });
    }
});

// GET /api/deepgram/languages - Supported languages
router.get('/languages', (req, res) => {
    const supportedLanguages = [
        { code: 'sk-SK', name: 'Slovak', native: 'Slovenčina' },
        { code: 'en-US', name: 'English (US)', native: 'English' },
        { code: 'en-GB', name: 'English (UK)', native: 'English' },
        { code: 'cs-CZ', name: 'Czech', native: 'Čeština' },
        { code: 'de-DE', name: 'German', native: 'Deutsch' },
        { code: 'fr-FR', name: 'French', native: 'Français' },
        { code: 'es-ES', name: 'Spanish', native: 'Español' },
        { code: 'it-IT', name: 'Italian', native: 'Italiano' },
        { code: 'pl-PL', name: 'Polish', native: 'Polski' },
        { code: 'hu-HU', name: 'Hungarian', native: 'Magyar' }
    ];

    res.json({
        languages: supportedLanguages,
        default: 'sk-SK',
        timestamp: new Date().toISOString()
    });
});

// GET /api/deepgram/models - Available models
router.get('/models', (req, res) => {
    const availableModels = [
        {
            name: 'nova-2',
            description: 'Latest and most accurate model',
            languages: ['sk-SK', 'en-US', 'en-GB', 'cs-CZ', 'de-DE', 'fr-FR', 'es-ES'],
            recommended: true
        },
        {
            name: 'nova',
            description: 'Previous generation model',
            languages: ['sk-SK', 'en-US', 'en-GB', 'cs-CZ', 'de-DE'],
            recommended: false
        },
        {
            name: 'base',
            description: 'Basic model for simple transcription',
            languages: ['en-US', 'en-GB'],
            recommended: false
        }
    ];

    res.json({
        models: availableModels,
        default: 'nova-2',
        timestamp: new Date().toISOString()
    });
});

// GET /api/deepgram/status - Service status
router.get('/status', (req, res) => {
    const isConfigured = process.env.DEEPGRAM_API_KEY && process.env.DEEPGRAM_API_KEY !== 'mock';

    res.json({
        status: isConfigured ? 'operational' : 'mock',
        configured: isConfigured,
        apiKey: isConfigured ? 'configured' : 'missing',
        mockMode: !isConfigured,
        timestamp: new Date().toISOString()
    });
});

module.exports = router;