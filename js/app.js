// app.js
import { recordWAV } from './recorder.js';
import { renderQR } from './qrcode-renderer.js';

const recordBtn = document.querySelector('#recordBtn');
const qrImg = document.querySelector('#qrImg');

// Debug cross-origin isolation status
console.log('Cross-origin isolated:', window.crossOriginIsolated);
console.log('SharedArrayBuffer available:', typeof SharedArrayBuffer !== 'undefined');

// Destructure the createFFmpeg from the global FFmpeg object provided by the script tag
const { createFFmpeg, fetchFile } = FFmpeg;
const ffmpeg = createFFmpeg({ log: true });

function arrayBufferToBase64(ab) {
  const u8 = new Uint8Array(ab);
  let s = '';
  u8.forEach(b => s += String.fromCharCode(b));
  return btoa(s);
}

recordBtn.onclick = async () => {
  recordBtn.disabled = true;
  qrImg.src = '';

  try {
    // 1. Record Audio for a fixed duration
    recordBtn.textContent = 'Recording...';
    const duration = 1.6;
    const wavBlob = await recordWAV(duration);

    // 2. Load FFmpeg if not loaded
    if (!ffmpeg.isLoaded()) {
        recordBtn.textContent = 'Loading FFMpeg Core...';
        await ffmpeg.load();
    }

    // 3. Run conversion with silence removal and trim filters
    recordBtn.textContent = 'Analyzing & Compressing...';
    const wavName = 'in.wav';
    const outName = 'out.mp4';
    ffmpeg.FS('writeFile', wavName, await fetchFile(wavBlob));
    await ffmpeg.run(
        '-i', wavName,
        '-af', 'silenceremove=start_periods=1:start_threshold=-50dB,atrim=duration=1.15',
        '-c:a', 'libopus',
        '-b:a', '8k',
        '-ac', '1',
        '-ar', '8000',
        outName
    );
    const data = ffmpeg.FS('readFile', outName);
    const opusMP4Blob = new Blob([data.buffer], { type: 'audio/mp4' });
    const ab = await opusMP4Blob.arrayBuffer();

    if (ab.byteLength > 2215) {
        alert(`Error: Final audio is still too long (${ab.byteLength} bytes). Try speaking closer to the mic.`);
        recordBtn.disabled = false;
        return;
    }

    // 4. Generate QR Code
    recordBtn.textContent = 'Generating QR Code...';
    const b64 = arrayBufferToBase64(ab);
    const qrUrl = await renderQR(b64);
    qrImg.src = qrUrl;

  } catch (error) {
    console.error(error);
    alert(`An error occurred: ${error.message}. Check the console for details.`);
  } finally {
    recordBtn.textContent = '🎤 Record Audio';
    recordBtn.disabled = false;
  }
};
