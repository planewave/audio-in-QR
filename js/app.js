// app.js
import { recordWAV } from './recorder.js';
import { renderQR } from './qrcode-renderer.js';

const recordBtn = document.querySelector('#recordBtn');
const qrImg = document.querySelector('#qrImg');
const durationSlider = document.querySelector('#durationSlider');
const durationLabel = document.querySelector('#durationLabel');

// Destructure the createFFmpeg from the global FFmpeg object provided by the script tag
const { createFFmpeg, fetchFile } = FFmpeg;
const ffmpeg = createFFmpeg({ log: true });

function arrayBufferToBase64(ab) {
  const u8 = new Uint8Array(ab);
  let s = '';
  u8.forEach(b => s += String.fromCharCode(b));
  return btoa(s);
}

durationSlider.oninput = () => {
    durationLabel.textContent = `${durationSlider.value} s`;
    recordBtn.textContent = `🎤 Record ${durationSlider.value} s`;
};

recordBtn.onclick = async () => {
  recordBtn.disabled = true;
  qrImg.src = '';

  try {
    // 1. Record Audio
    recordBtn.textContent = 'Recording...';
    const duration = parseFloat(durationSlider.value);
    const wavBlob = await recordWAV(duration);

    // 2. Load FFmpeg if not loaded
    if (!ffmpeg.isLoaded()) {
        recordBtn.textContent = 'Loading FFMpeg Core...';
        await ffmpeg.load();
    }

    // 3. Run conversion
    recordBtn.textContent = 'Compressing...';
    const wavName = 'in.wav';
    const outName = 'out.mp4';
    ffmpeg.FS('writeFile', wavName, await fetchFile(wavBlob));
    await ffmpeg.run(
        '-i', wavName,
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
        alert('Error: Audio data is too long to fit in a QR code. Try reducing the duration.');
        recordBtn.textContent = `🎤 Record ${durationSlider.value} s`;
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
    recordBtn.textContent = `🎤 Record ${durationSlider.value} s`;
    recordBtn.disabled = false;
  }
};