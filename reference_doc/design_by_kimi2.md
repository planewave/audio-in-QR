Web App 设计文档  
项目代号：QR-AudioClip  
目标：纯前端实现“录音→压缩→Base64→QR”完整链路，零服务器依赖，单页即可运行。

================================================================
1. 技术总览
----------------------------------------------------------------
- 浏览器要求：Chrome ≥ 94 / Edge ≥ 94 / Firefox ≥ 93（需支持 WebCodecs、WebAssembly、MediaRecorder、Web Audio API、Web Crypto）。  
- 技术栈：Vanilla ES2022（无框架）、FFmpeg.wasm（v0.12.x）、qrcode.js（v1.5.x）、IndexedDB（可选缓存）。  
- 架构：  
  1. 录音 → 原始 PCM（WAV）  
  2. 浏览器端 FFmpeg.wasm 压缩（libopus 8 kbps 8 kHz mono）  
  3. 转 Base64（URL-safe 版本，无 padding）  
  4. 用 qrcode.js 生成 Version 40-L QR → 画布渲染  
- 零后端：所有计算在 Web Worker 中完成，主线程保持 60 fps 以上。

================================================================
2. 目录结构
----------------------------------------------------------------
/qr-audio-clip  
├─ index.html            单页壳 + 界面  
├─ css/                  样式（可选 Tailwind CDN）  
├─ js/  
│  ├─ app.js             主流程 & 事件绑定  
│  ├─ recorder.js        录音封装  
│  ├─ ffmpeg-worker.js   FFmpeg.wasm 线程  
│  └─ qrcode-renderer.js QR 绘制与下载  
└─ assets/               图标、favicon

================================================================
3. 数据流
----------------------------------------------------------------
用户 → 麦克风 → MediaRecorder(WAV) → FFmpeg.wasm(Opus in MP4) → ArrayBuffer → Base64 → QR → Canvas → 下载 PNG/SVG

================================================================
4. 关键 API 与限制
----------------------------------------------------------------
- 录音时长：固定 2 秒（UI 中可微调 1.8-2.2 s，滑条输入）。  
- 最大输入字节：2215 字节（压缩后）；超过则提示“音频过长”。  
- QR 参数：Version 40, ErrorCorrectionLevel L, Mode Byte, Mask auto。  
- 兼容性回退：若不支持 WebCodecs/FFmpeg.wasm → 提示“请换 Chrome/Edge”。

================================================================
5. 详细实现
----------------------------------------------------------------
5.1 权限与录音  
```js
// recorder.js
export async function recordWAV(durationSec = 2) {
  const stream = await navigator.mediaDevices.getUserMedia({audio:true});
  const ctx = new AudioContext({sampleRate: 48000});
  const source = ctx.createMediaStreamSource(stream);
  const dest = ctx.createMediaStreamDestination();
  source.connect(dest);

  const recorder = new MediaRecorder(dest.stream, {mimeType:'audio/wav'});
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
```

5.2 浏览器端压缩（FFmpeg.wasm）  
```js
// ffmpeg-worker.js
importScripts('https://unpkg.com/@ffmpeg/ffmpeg@0.12.7/dist/umd/ffmpeg.js');
let ffmpeg;
self.onmessage = async ({data: {wavBlob, duration}}) => {
  if (!ffmpeg) {
    ffmpeg = FFmpeg.createFFmpeg({log:false});
    await ffmpeg.load();
  }
  const wavName = 'in.wav';
  const outName = 'out.mp4';
  ffmpeg.FS('writeFile', wavName, new Uint8Array(await wavBlob.arrayBuffer()));
  await ffmpeg.run(
    '-i', wavName,
    '-c:a', 'libopus',
    '-b:a', '8k',
    '-ac', '1',
    '-ar', '8000',
    '-application', 'voip',
    outName
  );
  const data = ffmpeg.FS('readFile', outName);
  const opusMP4Blob = new Blob([data.buffer], {type:'audio/mp4'});
  const ab = await opusMP4Blob.arrayBuffer();
  if (ab.byteLength > 2215) {
    self.postMessage({error:'TOO_LARGE'});
    return;
  }
  self.postMessage({ab});
};
```

5.3 Base64 转换  
```js
// app.js
function arrayBufferToBase64Url(ab) {
  const u8 = new Uint8Array(ab);
  let s = '';
  u8.forEach(b => s += String.fromCharCode(b));
  return btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,'');
}
```

5.4 QR 生成  
```js
// qrcode-renderer.js
import QRC from 'https://unpkg.com/qrcode@1.5.3/build/qrcode.esm.js';
export async function renderQR(data) {
  const opts = {
    errorCorrectionLevel: 'L',
    type: 'image/png',
    quality: 1,
    margin: 1,
    width: 512,
    version: 40
  };
  const url = await QRC.toDataURL(data, opts);
  return url;
}
```

5.5 主流程  
```js
// app.js
const btn = document.querySelector('#record');
btn.onclick = async () => {
  btn.disabled = true;
  const wavBlob = await recordWAV(2);
  const worker = new Worker('./js/ffmpeg-worker.js', {type:'module'});
  worker.postMessage({wavBlob, duration:2});
  worker.onmessage = async ({data}) => {
    if (data.error) return alert('音频过长，请降低时长');
    const b64 = arrayBufferToBase64Url(data.ab);
    const qrUrl = await renderQR(b64);
    document.querySelector('#qr').src = qrUrl;
    btn.disabled = false;
    worker.terminate();
  };
};
```

================================================================
6. UI/UX 设计
----------------------------------------------------------------
- 布局：  
  ─ 顶部标题“QR Audio Clip”  
  ─ 中间大按钮“🎤 Record 2 s”  
  ─ 下方进度环（录音/转码时旋转）  
  ─ 再下方显示 QR 图像，可点击下载 PNG  
  ─ 滑条“Duration” 1.8-2.2 s（默认 2.0，实时更新字节预估）  
- 颜色：使用系统配色（prefers-color-scheme）。  
- 响应式：max-width 600 px，移动端适配（touch 区域 ≥ 48 px）。

================================================================
7. 性能与体验优化
----------------------------------------------------------------
- FFmpeg.wasm 首次加载约 2 MB gzip，使用 `import('ffmpeg-worker.js')` 懒加载。  
- 转码在 Worker 中，主线程保持 60 fps；显示转码进度条（ffmpeg 的 `logger`）。  
- 录音时使用 `AudioWorklet` 可实时显示波形（可选）。  
- 若浏览器内存 < 1 GB，提示“可能卡顿”。  

================================================================
8. 测试用例
----------------------------------------------------------------
1. 允许麦克风 → 录音 2 s → 转码 → QR 生成 < 3 s。  
2. 录音 2.3 s → 压缩后 > 2215 B → 弹出“音频过长”。  
3. 离线使用：断网后刷新页面，仍能录音压缩（FFmpeg.wasm 已缓存）。  
4. iOS Safari 16 以上：检查 WebAssembly 支持。  

================================================================
9. 部署
----------------------------------------------------------------
- 任何静态托管均可（GitHub Pages / Vercel / Netlify）。  
- 设置 `Cross-Origin-Embedder-Policy: require-corp` 以便加载 FFmpeg.wasm。  
- Service Worker（可选）缓存所有资源，PWA 支持。

================================================================
10. 未来扩展
----------------------------------------------------------------
- 让用户上传现有音频剪辑。  
- 提供“反向扫描”功能：扫描 QR → 播放音频。  
- 可选 Opus → WebM（更兼容）。  
- 语音增强（WebRTC-VAD 自动裁剪静音）。  

================================================================
交付物
----------------------------------------------------------------
开发人员只需将上述目录结构、代码片段及依赖 CDN URL 组合为单页即可运行。无需构建步骤，可直接双击 index.html 本地测试。