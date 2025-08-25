// recorder.js
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
