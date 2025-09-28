// recorder.js
export async function recordWAV(durationSec = 2) {
  const stream = await navigator.mediaDevices.getUserMedia({audio:true});
  
  // Use proper options for cross-origin context
  const audioContextOptions = {
    sampleRate: 48000,
    // Add these options for better cross-origin compatibility
    latencyHint: 'interactive',
  };
  
  // Check if we're in a secure context that may require specific options
  if (window.crossOriginIsolated) {
    audioContextOptions.suspend = false; // Don't auto-suspend in isolated context
  }
  
  const ctx = new (window.AudioContext || window.webkitAudioContext)(audioContextOptions);
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
      // Properly close the audio context
      if (ctx.state !== 'closed') {
        ctx.close();
      }
    }, durationSec*1000);
  });
}
