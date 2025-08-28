// recorder.js
export async function recordCompressedAudio(durationSec = 2) {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({audio: true});
    
    // 尝试使用支持的最优MIME类型
    const mimeTypes = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/ogg;codecs=opus',
      'audio/mp4'  // Safari支持
    ];
    
    let mimeType = '';
    for (const type of mimeTypes) {
      if (MediaRecorder.isTypeSupported(type)) {
        mimeType = type;
        break;
      }
    }
    
    if (!mimeType) {
      throw new Error('No supported MIME type found for MediaRecorder');
    }
    
    console.log('Using MIME type:', mimeType);
    
    // 配置MediaRecorder
    const options = {
      mimeType: mimeType,
      audioBitsPerSecond: 8000  // 尝试接近8kbps的比特率
    };
    
    const recorder = new MediaRecorder(stream, options);
    const chunks = [];
    recorder.ondataavailable = e => chunks.push(e.data);
    
    return new Promise((resolve, reject) => {
      recorder.onstop = () => {
        // 获取录制的音频blob
        const blob = new Blob(chunks, {type: mimeType});
        console.log('Recorded blob size:', blob.size, 'bytes');
        resolve(blob);
      };
      
      recorder.onerror = (e) => {
        reject(e.error);
      };
      
      recorder.start();
      
      // 停止录制
      setTimeout(() => {
        try {
          recorder.stop();
          stream.getTracks().forEach(t => t.stop());
        } catch (e) {
          reject(e);
        }
      }, durationSec * 1000);
    });
  } catch (error) {
    console.error('Error recording audio:', error);
    throw error;
  }
}

// 保留原来的WAV录制功能以备不时之需
export async function recordWAV(durationSec = 2) {
  const stream = await navigator.mediaDevices.getUserMedia({audio:true});
  const ctx = new AudioContext({sampleRate: 48000});
  const source = ctx.createMediaStreamSource(stream);
  const dest = ctx.createMediaStreamDestination();
  source.connect(dest);

  const recorder = new MediaRecorder(dest.stream);
  const chunks = [];
  recorder.ondataavailable = e => chunks.push(e.data);
  return new Promise((resolve, reject) => {
    recorder.onstop = () => {
      const blob = new Blob(chunks, {type:'audio/wav'});
      resolve(blob);
    };
    recorder.start();
    setTimeout(() => {
      recorder.stop();
      stream.getTracks().forEach(t=>t.stop());
      ctx.close();
    }, durationSec*1000);
  });
}
