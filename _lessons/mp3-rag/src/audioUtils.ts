import { WAVEncoder } from './wavEncoder';

export async function convertMP3ToWav(file: File, audioContext: AudioContext, wavEncoder: WAVEncoder): Promise<Blob> {
    // First convert MP3 to AudioBuffer
    const audioBuffer = await new Promise<AudioBuffer>((resolve, reject) => {
        const reader = new FileReader();
        
        reader.onload = async (e) => {
            try {
                const arrayBuffer = e.target?.result as ArrayBuffer;
                const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
                resolve(audioBuffer);
            } catch (error) {
                console.error('Error decoding MP3 file:', error);
                reject(error);
            }
        };
        
        reader.onerror = (error) => reject(error);
        reader.readAsArrayBuffer(file);
    });

    // Convert AudioBuffer to Float32Array (mono)
    const numberOfChannels = audioBuffer.numberOfChannels;
    const length = audioBuffer.length;
    const sampleRate = audioBuffer.sampleRate;
    
    // Convert to mono by averaging all channels
    const monoData = new Float32Array(length);
    for (let i = 0; i < length; i++) {
        let sum = 0;
        for (let channel = 0; channel < numberOfChannels; channel++) {
            sum += audioBuffer.getChannelData(channel)[i];
        }
        monoData[i] = sum / numberOfChannels;
    }

    // Use WAVEncoder to convert to WAV
    return wavEncoder.encodeWAV(monoData);
} 