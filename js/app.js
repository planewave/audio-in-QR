// app.js
import { recordWAV, recordCompressedAudio } from './recorder.js';
import { renderQR } from './qrcode-renderer.js';

const recordBtn = document.querySelector('#recordBtn');
const qrImg = document.querySelector('#qrImg');

// Debug cross-origin isolation status
console.log('Cross-origin isolated:', window.crossOriginIsolated);
console.log('SharedArrayBuffer available:', typeof SharedArrayBuffer !== 'undefined');

// Check if we have the required features for FFmpeg
const isSupported = window.crossOriginIsolated && typeof SharedArrayBuffer !== 'undefined';

// Show browser compatibility warning if needed
if (!isSupported) {
    console.warn('Cross-origin isolation is not enabled or SharedArrayBuffer is not available.');
    
    document.addEventListener('DOMContentLoaded', () => {
        // Check if we can use the direct recording approach
        const canUseDirectRecording = checkDirectRecordingSupport();
        
        const warning = document.createElement('div');
        warning.className = 'warning';
        if (canUseDirectRecording) {
            warning.innerHTML = `
                <p><strong>Browser Compatibility:</strong> 
                Using direct recording mode for better browser compatibility.</p>
            `;
        } else {
            warning.innerHTML = `
                <p><strong>Browser Compatibility Warning:</strong> 
                This application works best with Chrome, Firefox, or Edge.</p>
                <p>You may experience issues with Safari or other browsers.</p>
            `;
        }
        document.querySelector('.container').insertBefore(warning, document.querySelector('.description').nextSibling);
    });
}

function checkDirectRecordingSupport() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        return false;
    }
    
    const mimeTypes = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/ogg;codecs=opus',
        'audio/mp4'
    ];
    
    return mimeTypes.some(type => MediaRecorder.isTypeSupported(type));
}

function arrayBufferToBase64(ab) {
  const u8 = new Uint8Array(ab);
  let s = '';
  u8.forEach(b => s += String.fromCharCode(b));
  return btoa(s);
}

// 尝试使用FFmpeg进行高级处理，如果失败则回退到直接录制
async function processAudioWithFFmpeg(wavBlob) {
    // Destructure the createFFmpeg from the global FFmpeg object provided by the script tag
    const { createFFmpeg, fetchFile } = FFmpeg;
    
    // Create FFmpeg instance with error handling
    let ffmpeg;
    try {
        ffmpeg = createFFmpeg({ log: true });
    } catch (e) {
        console.error('Failed to create FFmpeg instance:', e);
        throw e;
    }
    
    // Load FFmpeg if not loaded
    if (!ffmpeg.isLoaded()) {
        await ffmpeg.load();
    }

    // Run conversion with silence removal and trim filters
    const wavName = 'in.wav';
    const outName = 'out.mp4';
    ffmpeg.FS('writeFile', wavName, await fetchFile(wavBlob));
    await ffmpeg.run(
      '-i', wavName,
      '-af', 'silenceremove=start_periods=1:start_threshold=-50dB,atrim=duration=1.45',
      '-c:a', 'libopus',
      '-b:a', '8k',
      '-ac', '1',
      '-ar', '8000',
      '-application', 'voip',
      '-packet_loss', '20',
      '-compression_level', '10',
      '-frame_duration', '60',
      outName
    );
    const data = ffmpeg.FS('readFile', outName);
    const opusMP4Blob = new Blob([data.buffer], { type: 'audio/mp4' });
    return opusMP4Blob;
}

// 直接处理录制的音频以适应QR码大小限制
async function processDirectRecording(blob) {
    // 获取音频大小
    const ab = await blob.arrayBuffer();
    console.log(`Direct recording size: ${ab.byteLength} bytes`);
    
    // 如果太大，尝试一些基本的处理
    if (ab.byteLength > 2215) {
        console.warn(`Audio is too large (${ab.byteLength} bytes). Attempting basic processing.`);
        // 这里可以添加一些基本的处理，比如降低采样率等
        // 但由于是直接录制的压缩格式，我们能做的有限
    }
    
    return blob;
}

recordBtn.onclick = async () => {
  recordBtn.disabled = true;
  qrImg.src = '';

  try {
    // 1. Record Audio for a fixed duration
    recordBtn.textContent = 'Recording...';
    const duration = 2.5;
    
    let processedBlob;
    
    // 如果支持FFmpeg且跨域隔离可用，使用高级处理
    if (isSupported) {
        try {
            recordBtn.textContent = 'Recording with advanced processing...';
            const wavBlob = await recordWAV(duration);
            recordBtn.textContent = 'Processing with FFmpeg...';
            processedBlob = await processAudioWithFFmpeg(wavBlob);
        } catch (e) {
            console.error('FFmpeg processing failed, falling back to direct recording:', e);
            recordBtn.textContent = 'Recording with basic processing...';
            processedBlob = await recordCompressedAudio(duration);
            processedBlob = await processDirectRecording(processedBlob);
        }
    } else {
        // 否则使用直接录制方法
        recordBtn.textContent = 'Recording...';
        const directBlob = await recordCompressedAudio(duration);
        processedBlob = await processDirectRecording(directBlob);
    }

    // 获取处理后的音频数据
    const ab = await processedBlob.arrayBuffer();
    console.log(`Final audio size: ${ab.byteLength} bytes`);

    // 检查大小限制
    if (ab.byteLength > 2215) {
        alert(`Error: Final audio is too long (${ab.byteLength} bytes). Try speaking closer to the mic or for a shorter duration.`);
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
