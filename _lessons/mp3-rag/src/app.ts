import { chat, speak, transcribe } from './api';
import { WAVEncoder } from './wavEncoder';
import {
    startRecordingVisualization,
    stopRecordingVisualization,
    startPlaybackVisualization,
    stopPlaybackVisualization,
    startIdleVisualization,
} from './waveform';
import { convertMP3ToWav } from './audioUtils';

// Types
type Message = {
    role: 'user' | 'assistant';
    content: string;
};

// UI Elements
const callBtn = document.getElementById("callBtn") as HTMLButtonElement;
const statusSpan = document.getElementById("status") as HTMLSpanElement;
const conversationHistoryDiv = document.getElementById("conversationHistory") as HTMLDivElement;
const latestTranscriptionDiv = document.getElementById("latestTranscription") as HTMLDivElement;

// State

// Add this variable to track when speech started
let speechStartTime: number | null = null;
let accumulatedBuffer: Float32Array = new Float32Array(0);
let isRecording = false;
let conversationHistory: Message[] = [];
let latestTranscription: string = "";
let isTranscribing = false;
let isProcessing = false; // New flag to prevent concurrent interactions
let audioContext: AudioContext | null = null;
let stream: MediaStream | null = null;
let microphone: MediaStreamAudioSourceNode | null = null;
let audioProcessor: AudioWorkletNode | null = null;
let isSilent = true;
let assistantSpeaking = false;
let audioBuffer: AudioBuffer | null = null;

const INITIAL_TRANSCRIPTION_DELAY_MS = 1500;
const MIN_AUDIO_LENGTH_SECONDS = 0.5;
const TRANSCRIPTION_INTERVAL_MS = 1000;
const sampleRate = 44100;
const originalSampleRate = 44100;
const targetSampleRate = 16000;
const wavEncoder = new WAVEncoder({ originalSampleRate, targetSampleRate });

// Visualization state functions
const isRecordingFunc = () => isRecording;
const isSilentFunc = () => isSilent;
const assistantSpeakingFunc = () => assistantSpeaking;

callBtn.addEventListener("click", async () => {
    if (!isRecording) {
        await startRecording();
        callBtn.textContent = "Hang up";
    } else {
        stopRecording();
        callBtn.textContent = "Call";
    }
});

async function startRecording() {
    console.log("Starting recording");
    isRecording = true;

    try {
        // Initialize the AudioContext (creates a new context or resumes an existing one)
        await initAudioContext();
        if (!audioContext) throw new Error("Failed to initialize AudioContext");
        
        // Load the custom audio processing script (processor.js) into the AudioWorklet
        await audioContext.audioWorklet.addModule(new URL('./processor.js', import.meta.url));

        // Request access to the user's microphone
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        // Create an audio source node from the microphone stream
        microphone = audioContext.createMediaStreamSource(stream);

        // Create an AnalyserNode for real-time frequency analysis (used for visualization)
        const microphoneAnalyser = audioContext.createAnalyser();
        microphoneAnalyser.fftSize = 256; // Set size of Fast Fourier Transform
        // Connect the microphone source to the analyser
        microphone.connect(microphoneAnalyser);

        // Create an AudioWorkletNode for custom audio processing
        audioProcessor = new AudioWorkletNode(audioContext, 'audio-processor');
        // Connect the microphone source to the audio processor
        microphone.connect(audioProcessor);
        // Set up a message handler for processed audio data
        audioProcessor.port.onmessage = processAudio;
        
        // Start the visualization of the audio input
        startRecordingVisualization(
            microphoneAnalyser,     // AnalyserNode for frequency data
            isRecordingFunc,        // Function to check if recording is active
            isSilentFunc,           // Function to check if audio is silent
            assistantSpeakingFunc   // Function to check if AI is speaking
        );
    } catch (error) {
        console.error("Error setting up audio processing:", error);
        isRecording = false;
    }
}

async function processAudio(event: MessageEvent) {
    const { audioChunk, eventType } = event.data;

    if (eventType) {
        console.log("Received event:", eventType);
        isSilent = eventType === 'silenceStart';
        if (eventType === 'silenceEnd' && assistantSpeaking) {
            // Reset when silence ends after assistant speech
            assistantSpeaking = false;
            accumulatedBuffer = new Float32Array(0);
        }
        if (eventType === 'silenceEnd' && !assistantSpeaking) {
            // Mark the start of user speech
            speechStartTime = Date.now();
        }
    }

    if (audioChunk) {
        // Calculate silence percentage for the current audio chunk
        const silencePercentage = calculateSilencePercentage(audioChunk);
        if (silencePercentage < 95) {
            // Add non-silent audio to the buffer
            accumulatedBuffer = concatFloat32Arrays([accumulatedBuffer, audioChunk]);
        }
    }

    try {
        if (!assistantSpeaking && shouldTranscribe()) {
            // Check if the accumulated buffer is mostly non-silent
            const bufferSilencePercentage = calculateSilencePercentage(accumulatedBuffer);
            if (bufferSilencePercentage < 90) {
                await performTranscription();
            }
        }

        if (!isProcessing && isSilent && latestTranscription && !assistantSpeaking) {
            // Process transcription when silence is detected and we're not already processing
            isProcessing = true;
            try {
                await interact();
            } finally {
                isProcessing = false;
                latestTranscription = ""; // Reset transcription after processing
            }
        }
    } catch (error) {
        console.error("Error in processAudio:", error);
        isProcessing = false;
    }
}

function calculateSilencePercentage(audioChunk: Float32Array): number {
    const silenceThreshold = 0.01; // Adjust this value as needed
    let silenceSamples = 0;

    for (let i = 0; i < audioChunk.length; i++) {
        if (Math.abs(audioChunk[i]) < silenceThreshold) {
            silenceSamples++;
        }
    }

    return (silenceSamples / audioChunk.length) * 100;
}

async function interact() {
    console.log("User said:", latestTranscription);
    if (latestTranscription.trim()) {
        // update final transcription one more time
        await performTranscription();

        const notAttachedToConversation = mp3Files.filter(file => !file.attachedToConversation);
        const mp3Transcriptions = notAttachedToConversation
            .map(file => `\nTranscript of witness interview ${file.name}: \n${file.transcription}`)
            .join('\n#####');

        conversationHistory.push({ role: 'user', content: latestTranscription + mp3Transcriptions });
        notAttachedToConversation.forEach(file => file.attachedToConversation = true);
        latestTranscription = ""; // Clear the latest transcription
        latestTranscriptionDiv.textContent = "..."; // Update UI
        updateConversationHistory();

        try {
            const response = await chat(conversationHistory);
            conversationHistory.push({ role: 'assistant', content: response });
            updateConversationHistory();

            await answer(response);
        } catch (error) {
            console.error("Chat API error:", error);
        }
    }

    accumulatedBuffer = new Float32Array(0); // Clear the accumulated buffer
}

function stopRecording() {
    console.log("Stopping recording");
    isRecording = false;

    // Stop the media stream
    if (stream) {
        stream.getTracks().forEach((track) => track.stop());
        stream = null;
    }

    // Disconnect and nullify the microphone node
    if (microphone) {
        microphone.disconnect();
        microphone = null;
    }

    // Disconnect and nullify the audio processor
    if (audioProcessor) {
        audioProcessor.port.onmessage = null; // Remove event listeners
        audioProcessor.disconnect();
        audioProcessor = null;
    }

    // Close the AudioContext if you don't need it anymore
    if (audioContext && audioContext.state !== 'closed') {
        audioContext.close();
        audioContext = null;
    }

    // Stop visualizations
    stopRecordingVisualization();
    stopPlaybackVisualization();
    startIdleVisualization(isRecordingFunc, isSilentFunc, assistantSpeakingFunc);
}

async function answer(responseText: string) {
    assistantSpeaking = true;
    isSilent = true;

    if (!audioContext) throw new Error("Failed to initialize AudioContext");

    const audio = await speak(responseText);
    console.log("Audio:", audio);
    const audioSource = audioContext.createMediaElementSource(audio);

    const playbackAnalyser = audioContext.createAnalyser();
    playbackAnalyser.fftSize = 256;
    const playbackDataArray = new Uint8Array(playbackAnalyser.frequencyBinCount);

    audioSource.connect(playbackAnalyser);
    playbackAnalyser.connect(audioContext.destination);

    startPlaybackVisualization(playbackAnalyser, playbackDataArray);

    audio.playbackRate = 1.05;
    audio.play();
    audio.onended = () => {
        assistantSpeaking = false;
        stopPlaybackVisualization();
    };
}

function shouldTranscribe(): boolean {
    const audioLengthSeconds = accumulatedBuffer.length / sampleRate;
    const timeSinceLastTranscription = Date.now() - lastTranscriptionTime;
    const timeSinceSpeechStart = speechStartTime ? Date.now() - speechStartTime : 0;

    return !isTranscribing && !isSilent &&
           timeSinceLastTranscription >= TRANSCRIPTION_INTERVAL_MS &&
           audioLengthSeconds >= MIN_AUDIO_LENGTH_SECONDS &&
           timeSinceSpeechStart >= INITIAL_TRANSCRIPTION_DELAY_MS;
}

async function performTranscription() {
    isTranscribing = true;
    const wavBlob = encodeWAV(accumulatedBuffer);
    console.log("Transcribing audio...");

    try {
        const newTranscription = await transcribe(wavBlob);
        latestTranscription = newTranscription;
        latestTranscriptionDiv.textContent = latestTranscription.trim();
    } catch (error) {
        console.error("Transcription error:", error);
    } finally {
        lastTranscriptionTime = Date.now();
        isTranscribing = false;
    }
}

async function performFileTranscription(wavBlob: Blob, fileName: string) {
    isTranscribing = true;
    console.log("Transcribing audio...");

    try {
        const newTranscription = await transcribe(wavBlob);
        // latestTranscription = `\nTranscript of witness interview ${fileName}: \n${newTranscription}`;
        // latestTranscriptionDiv.textContent = latestTranscription.trim();
        return newTranscription;
    } catch (error) {
        console.error("Transcription error:", error);
    } finally {
        lastTranscriptionTime = Date.now();
        isTranscribing = false;
    }
}


function updateConversationHistory() {
    conversationHistoryDiv.innerHTML = '';
    conversationHistory.forEach((message) => {
        const messageElement = document.createElement('div');
        messageElement.className = `mb-3 ${message.role === 'user' ? 'text-right' : 'text-left'}`;
        messageElement.innerHTML = `
            <span class="inline-block px-4 py-2 rounded-2xl ${
                message.role === 'user' 
                ? 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white' 
                : 'bg-gray-700/70 text-gray-100'
            } shadow-md">
                ${message.content}
            </span>
        `;
        conversationHistoryDiv.appendChild(messageElement);
    });
    conversationHistoryDiv.scrollTop = conversationHistoryDiv.scrollHeight;
}

function concatFloat32Arrays(arrays: Float32Array[]): Float32Array {
    let totalLength = arrays.reduce((sum, arr) => sum + arr.length, 0);
    const result = new Float32Array(totalLength);
    let offset = 0;
    for (const arr of arrays) {
      result.set(arr, offset);
      offset += arr.length;
    }
    return result;
}

function encodeWAV(samples: Float32Array): Blob {
    return wavEncoder.encodeWAV(samples);
}

let lastTranscriptionTime = 0;

async function initAudioContext() {
    if (!audioContext || audioContext.state === 'closed') {
        audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        if (audioContext.state === 'suspended') {
            await audioContext.resume();
        }
    }
}

// Start Idle Visualization on Page Load
document.addEventListener("DOMContentLoaded", () => {
    startIdleVisualization(isRecordingFunc, isSilentFunc, assistantSpeakingFunc);
    initializeDragAndDrop();
});

interface DragEvents {
  dragenter: DragEvent;
  dragover: DragEvent;
  dragleave: DragEvent;
  drop: DragEvent;
}

// Update the MP3File interface
interface MP3File {
    id: string;
    name: string;
    file: File;
    wavBlob?: Blob;
    transcription?: string;
    isProcessing?: boolean;
    attachedToConversation?: boolean;
}

// Add this to your state variables
let mp3Files: MP3File[] = [];

// Update the createMP3FileElement function to show transcription status
function createMP3FileElement(mp3File: MP3File): HTMLDivElement {
    const fileElement = document.createElement('div');
    fileElement.className = 'mp3-file';
    fileElement.id = mp3File.id;
    
    // Update the HTML to include transcription status
    fileElement.innerHTML = `
        <svg class="mp3-file-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
        </svg>
        <span class="mp3-file-name" title="${mp3File.name}">${mp3File.name}</span>
        <span class="mp3-file-status ${mp3File.isProcessing ? 'processing' : ''}" title="${getStatusText(mp3File)}">
            ${getStatusIcon(mp3File)}
        </span>
    `;

    // Add click handler to process the file
    fileElement.addEventListener('click', async () => {
        if (mp3File.isProcessing) return; // Prevent multiple processing
        
        try {
            // Update processing state
            mp3File.isProcessing = true;
            updateMP3FileElement(mp3File);

            if (mp3File.wavBlob) {
                const transcription = await performFileTranscription(mp3File.wavBlob, mp3File.name);
                mp3File.transcription = transcription;
                //`\nTranscript of witness interview ${fileName}: \n${newTranscription}`;

                showNotification('Transcription complete!', 'success');
            }
        } catch (error) {
            console.error('Error processing file:', error);
            showNotification('Error processing file', 'error');
        } finally {
            mp3File.isProcessing = false;
            updateMP3FileElement(mp3File);
        }
    });

    return fileElement;
}

// Helper function to get status text
function getStatusText(mp3File: MP3File): string {
    if (mp3File.isProcessing) return 'Processing...';
    if (mp3File.transcription) return 'Click to view transcription';
    return 'Click to transcribe';
}

// Helper function to get status icon HTML
function getStatusIcon(mp3File: MP3File): string {
    if (mp3File.isProcessing) {
        return `<svg class="animate-spin h-4 w-4" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>`;
    }
    if (mp3File.transcription) {
        return `<svg class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
        </svg>`;
    }
    return `<svg class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
        <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" clip-rule="evenodd"/>
    </svg>`;
}

// Helper function to update MP3 file element
function updateMP3FileElement(mp3File: MP3File) {
    const element = document.getElementById(mp3File.id);
    if (element) {
        const statusElement = element.querySelector('.mp3-file-status');
        if (statusElement) {
            statusElement.className = `mp3-file-status ${mp3File.isProcessing ? 'processing' : ''}`;
            statusElement.setAttribute('title', getStatusText(mp3File));
            statusElement.innerHTML = getStatusIcon(mp3File);
        }
    }
}

// Update the file processing in initializeDragAndDrop
function initializeDragAndDrop() {
    const body = document.body;
    const mp3FilesContainer = document.getElementById('mp3FilesContainer');
    
    const preventDefault = (e: Event) => {
        e.preventDefault();
        e.stopPropagation();
    };

    // Handle drag events
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        body.addEventListener(eventName, preventDefault as EventListener);
    });

    // Visual feedback when dragging over
    body.addEventListener('dragenter', () => {
        body.classList.add('drag-active');
    });

    body.addEventListener('dragleave', (e) => {
        const rect = body.getBoundingClientRect();
        const x = e.clientX;
        const y = e.clientY;

        // Only remove class if actually leaving the body
        if (x <= rect.left || x >= rect.right || y <= rect.top || y >= rect.bottom) {
            body.classList.remove('drag-active');
        }
    });

    // Update the drop handler
    body.addEventListener('drop', async (e: DragEvent) => {
        body.classList.remove('drag-active');
        
        const files = e.dataTransfer?.files;
        if (!files || files.length === 0) return;

        const file = files[0];
        if (!file.type.includes('audio/mpeg') && !file.name.endsWith('.mp3')) {
            showNotification('Please drop an MP3 file', 'error');
            return;
        }

        try {
            if (!audioContext) {
                await initAudioContext();
            }
            
            if (!audioContext) {
                throw new Error('Failed to initialize AudioContext');
            }

            const mp3File: MP3File = {
                id: `mp3-${Date.now()}`,
                name: file.name,
                file: file
            };

            const wavBlob = await convertMP3ToWav(file, audioContext, wavEncoder);
            mp3File.wavBlob = wavBlob;
            mp3Files.push(mp3File);

            // Add the file icon to the container
            if (mp3FilesContainer) {
                mp3FilesContainer.appendChild(createMP3FileElement(mp3File));
            }

            showNotification('Audio file converted and ready!', 'success');

        } catch (error) {
            console.error('Error converting MP3 file:', error);
            showNotification('Error converting audio file', 'error');
        }
    });
}

// Helper function for notifications
function showNotification(message: string, type: 'success' | 'error') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.remove();
    }, 3000);
}