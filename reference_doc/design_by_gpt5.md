<img src="https://r2cdn.perplexity.ai/pplx-full-logo-primary-dark%402x.png" style="height:64px;margin-right:32px"/>

# 按照上面的原型, 我要设计一个 web app 来实现下面功能,

1. 用户录音 2秒 (可增加剪辑功能)
2. 音频压缩,
3. base64 编码
4. 生成 QR code (低容错级别) 并显示出来
最好纯前端实现, 服务器不存储处理任何数据.

你给出详细设计文档, 无须代码. 要让前端开发人员可以完全根据这个文档将该 web app 完成实现

可以以纯前端方式完成，核心由 MediaDevices 获取麦克风、Web Audio 采集与裁剪、WASM Opus 编码（8 kb/s、8 kHz、单声道）、base64 转码、并强制生成 Version 40 且低容错级别（L）的 QR 码组成，整条链路不落服务端，全在浏览器内存中处理与显示。为确保可装入 Version 40-L 的容量，同时维持“2 秒录音”的体验，采用“先采后裁、编码后验、必要时自动微裁至≈1.8–2.0 秒”的策略，以保证最终 base64 长度不超过 QR 容量限制。

## 目标与范围

- 目标：实现“录音 2 秒→可选剪辑→8 kb/s Opus 压缩→base64→Version 40-L QR 码显示/下载”，全流程仅在浏览器端进行，数据不上传服务器。
- 范围：桌面与移动浏览器，支持离线使用；提供录音、试听、裁剪、二维码生成/导出，和结果校验（解码校验可作为可选项）。


## 关键设计决策

- 编码方式：优先选用“WASM libopus（CBR 8 kb/s）+ Ogg（最小注释）容器”，因为前端可控、编码确定性高、容器开销可控；如需“与原型一致”的 MP4/Opus，则采用“WASM ffmpeg”方案但需接受包体与性能成本上升。
- 采样率与声道：统一重采样为 8 kHz、单声道，匹配 8 kb/s 低码率语音的最佳实践，并与目标容量匹配。
- 大小与容量控制：Version 40-L 二进制容量上限约 2953 字节（按“字节模式”），base64 膨胀约 4/3，故原始二进制预算≈2214 字节；2 秒×8 kb/s≈2000 比特/秒×2 秒=16000 比特≈2000 字节，加上容器头/索引开销需要极简优化与可能的微裁（如 1.9 秒）。
- 纯前端：使用 AudioWorklet/OfflineAudioContext、Web Workers 和 WASM；不写入 IndexedDB，默认仅内存；可加“导出/导入 JSON 包”便于用户本地保存与再现。


## 架构概览

- UI 层：录音控制（开始/停止/重录）、波形预览、裁剪（入点/出点）、编码参数显示、二维码画布与下载、告警/提示。
- 音频管线：getUserMedia → AudioWorklet 拉流缓冲 → OfflineAudioContext 统一重采样至 8 kHz/mono → PCM Int16/Float32 缓冲。
- 编码管线：Worker 内加载 libopus.wasm → CBR 8 kb/s、帧长 20 ms（或 60–120 ms 以降封装开销）编码 → Ogg 打包（缩减注释与 Vendor 字段）。
- 大小控制与校验：计算二进制长度→base64→校验长度是否≤QR Version 40-L 允许字符数→若超限则提示并自动微裁尾部再编码，直至通过或降码率（可选）。
- QR 生成：强制 Version=40、ECL=L、字节模式；渲染 Canvas/SVG，支持导出 PNG/SVG。
- 可选验证：内建 QR 解码（摄像头扫码或屏幕截图反解），校验能还原原始 base64 长度与 SHA-256。


## 浏览器兼容策略

- 录音：首选 MediaDevices.getUserMedia（audio: true）。MediaRecorder 的音频封装/码率可变，不利于严格容量控制，因此仅用来回放/预览，正式编码走 WebAudio+WASM。
- iOS/Safari 特例：系统硬件采样率常为 44.1/48 kHz，需统一 OfflineAudioContext 重采样到 8 kHz。若 AudioWorklet 不可用，退化为 ScriptProcessor（虽已废弃但仍可作为兜底）。
- WASM 初始化：懒加载、并行预载；提供“加载中”状态与错误提示；首次加载完成后保留实例以加速二次编码。


## 功能规格

- 录音
    - 默认录音长度：2.000 秒（允许提前停止/重录）。
    - 指示录音进度与电平峰值，录音结束后立即生成波形缩略图（用于裁剪）。
    - 权限处理：显式提示用途；未授权时提供“无麦克风模拟输入”模式用于开发调试。
- 剪辑
    - 交互：拖动入点/出点；支持按 10 ms 精度吸附（与 Opus 帧对齐）。
    - 结束后输出精确 8 kHz/mono PCM 缓冲；若用户不调整，默认全选 2 s。
- 压缩
    - 编码器：libopus.wasm，CBR 8 kb/s，VBR 关闭；帧时长 20 ms（可配置 60/120 ms 减少容器/打包开销）。
    - 声道：mono；应用高通滤波/带限以减少低频浪费（可选，默认开）。
    - 容器：Ogg（最小化注释头，仅必要字段，无用户评论），或切换为 MP4（需 mp4box.js/ffmpeg.wasm，非默认）。
- base64 编码
    - 将最终二进制文件（容器+帧）编码为标准 base64（非 URL-safe）；不添加 data: 前缀，避免额外字符。
    - 提供 SHA-256 校验（十六进制字符串）用于后续验证。
- QR 生成
    - 版本：强制 Version 40；容错：L（低容错级别）；掩码自动选择；边距 4 modules。
    - 输入：base64 字符串；模式：字节模式；渲染：Canvas 和可选 SVG。
    - 输出：屏幕展示、下载 PNG/SVG；显示“字符长度/模块尺寸/预计扫描距离”提示。
- 体积与超限处理
    - 预算：Version 40-L 二进制容量≈2953 字节；base64 膨胀≈4/3；可用二进制预算≈2214 字节。
    - 流程：编码完成→得到 Uint8Array 长度→转 base64→若长度>2953 则按“逐步策略”处理：

1) 减少 Opus 帧时长合包（如 60→120 ms）以降低容器/打包开销；
2) 将结尾裁剪 50–100 ms 并重编码；
3) 若仍超限，允许将码率降至 7 kb/s 或 6 kb/s，或提示用户缩短至 1.8–1.9 s。
    - UI 反馈：在“生成”按钮旁显示“通过/超限”指示，列出采取的自动调整步骤与最终参数。


## 模块划分与接口

- DeviceService
    - 功能：请求/释放麦克风；产出 MediaStream。
    - 接口：requestMic(): Promise<MediaStream>；stop().
- CaptureService
    - 功能：将 MediaStream 连接 AudioWorklet，拉取 PCM；计时到 2.0 s 自动停止。
    - 输出：Float32Array/Int16Array PCM（高于 8 kHz 的设备采样率）。
    - 接口：start(stream, durationMs), onProgress(cb), onComplete(cb).
- ResampleService
    - 功能：OfflineAudioContext 渲染到 8000 Hz、mono；可选 Kaiser/Sinc 重采样器作为兜底。
    - 接口：resampleTo8k(pcm, srcRate) → {pcm8k: Int16Array, samples, durationMs}.
- EncodeService
    - 功能：Worker 内加载 libopus.wasm；以 CBR 8 kb/s、帧 20–120 ms 输出 Ogg/Opus。
    - 接口：init(), encode({pcm8k, frameMs, bitrateKbps}) → Uint8Array（容器文件）。
    - 约束：尽量将 Opus comment header 清空，仅保留最小字段。
- SizeGuard
    - 功能：计算 base64 长度与 QR 容量比较；执行微裁与重编码策略。
    - 接口：fitForQR({bytes, policy}) → {ok, base64, adjustments[]}.
- Base64Service
    - 功能：将 Uint8Array 转标准 base64（避免 btoa 对非 ASCII 的问题）；提供反解。
    - 接口：toBase64(Uint8Array) → string；fromBase64(string) → Uint8Array。
- QRService
    - 功能：生成 Version 40、ECL L 的 QR；输出 Canvas/SVG。
    - 接口：render({text, version:40, ecl:'L', moduleSizePx, marginModules}) → {canvas, svg}.
- HashService（可选）
    - 功能：crypto.subtle.digest('SHA-256') 输出十六进制；用于内嵌校验显示与可选写入 QR 附加区（不建议写入，节省空间）。
- ValidationService（可选）
    - 功能：内置 QR 解码验证：对屏幕上的 QR 截图/摄像头扫描后解码，比较 base64 长度与哈希。


## 端到端流程

1) 初始化：并行加载 UI、AudioWorklet 脚本与 libopus.wasm；显示“就绪”。
2) 录音：点击“开始录音”，getUserMedia 授权通过后开始计时；2.0 s 达到或点击“停止”即结束；显示波形与试听。
3) 剪辑：默认全选 2.0 s，用户可微调起止点；输出规范化 8 kHz/mono PCM。
4) 编码：CBR 8 kb/s、帧 20 ms；得到 Ogg/Opus 二进制。
5) 体积校验：转 base64，若≤2953 字符则通过；若超，执行自动调整（帧聚合→微裁→降码率），直到通过或提示无法满足。
6) 生成 QR：固定 Version 40、ECL L，渲染 Canvas/SVG；提供下载与“再试一个”。
7) 可选校验：解码屏幕上的 QR，比较 SHA-256 与长度；通过后显示“可恢复”。

## 容量与参数建议

- 目标参数：8 kb/s、8 kHz、mono、Opus CBR；帧长优先 60–120 ms（合包帧可显著降低封装开销），在清晰度与时延不敏感的 2 s 录音条件下可接受。
- 容量预算：
    - Version 40-L 最大约 2953 字节（字节模式）。
    - base64 膨胀约 4/3，故二进制预算≈2214 字节。
    - 语音负载：2 s×8 kb/s≈2000 字节。
    - 容器/索引/注释与页开销：尽量压缩到 ≤150–200 字节；若超过，自动微裁 50–200 ms。
- 超限回退序：帧聚合（60/120 ms）→尾部微裁→降码率至 7 kb/s→提示用户将时长改为 1.8–1.9 s。


## 性能与体验

- 首次 WASM 加载：并行与懒加载，显示进度条；目标 1–2 秒可用（CDN 与 gzip/br 优化）。
- 编码耗时：2 s 音频在现代设备上 50–150 ms；在低端机 300–600 ms；UI 加“处理中…”。
- QR 渲染：Version 40 模块多，建议提供“模块像素尺寸”自适应与放大镜预览；导出 PNG 1024–2048 px。


## 错误与边界情况

- 无麦克风权限/设备：展示引导与“导入示例音频”以演示流程。
- iOS WebView 限制：如 AudioWorklet 不可用，退化实现；无法稳定工作时给出“请在 Safari/Chrome 外部浏览器打开”。
- 编码失败：捕获 WASM 异常，建议“重试/重载 WASM/降码率”的三选项。
- 超限：展示清晰的原因与具体“自动调整”步骤（如：已裁剪 120 ms、帧聚合 120 ms、降码率至 7 kb/s）。


## 安全与隐私

- 全程本地处理；不持久化存储；录音权限仅用于当前会话。
- 提供“一键清除内存数据”按钮（释放 AudioContext、清空 Worker 缓冲）。
- 明确提示不会上传任何音频或识别数据。


## 可访问性与国际化

- 控件支持键盘操作、ARIA 标签与状态播报（录音中/已停止/处理中/超限）。
- 颜色对比度合规；为二维码提供“下载大图”与“放大预览”提升弱视可用性。
- 文案抽离，支持中英双语。


## 配置项与默认值

- 录音时长：默认 2.0 s（范围 1.0–3.0 s，超过 2.0 s 可能导致超限）。
- 编码：bitrate=8 kb/s，sampleRate=8000，channels=1，frameDurationMs=60（可 20/120 选项）。
- QR：version=40，errorCorrectionLevel='L'，moduleSize=6–10 px，margin=4 modules。
- 导出：PNG（透明背景可选）、SVG。


## 交互与页面结构

- 顶部进度条：权限→录音→剪辑→编码→二维码。
- 主区块：
    - 录音面板：大按钮、计时圈、电平条。
    - 波形与剪辑：波形、标尺、入/出点手柄、播放/暂停。
    - 参数与预算：显示“码率/采样率/帧长/容器开销估计/可用预算/已用预算”。
    - 结果区：二维码、下载按钮、“在另一设备上扫描测试”的小贴士。
- 辅助区：常见问题、浏览器支持、隐私说明。


## 测试计划

- 单元测试：
    - Resample 精度（8 kHz 长度与 RMS 误差）。
    - Base64 循环一致性（bytes → b64 → bytes）。
    - SizeGuard 策略（边界：恰好等于/略大于容量）。
- 集成测试：
    - 真实麦克风 2.0 s→通过；2.2 s→触发微裁；极静音/噪声场景编码稳定性。
    - iOS/Android/Windows/macOS 不同浏览器的权限、录音、编码耗时与 QR 渲染。
- 手动验证：
    - 扫码距离、屏幕亮度/对比度影响；纸面打印可读性（建议 3–4 cm 最小码边长）。


## 交付物与非功能性指标

- 包体控制：WASM 体积尽量 ≤2–5 MB（libopus 比 ffmpeg 小），首屏交互 <2 s。
- CPU/内存：编码过程峰值 CPU <50%（中端机），内存 <200 MB。
- 可靠性：编码失败率 <0.5%，扫码一次成功率 >95%（常见设备与光照）。


## 替代方案与权衡

- 方案 A（推荐）：libopus.wasm + 精简 Ogg → 体积小、性能高、可控性强。
- 方案 B（原型一致）：ffmpeg.wasm 生成 MP4/Opus → 兼容原命令，但初始加载重、CPU 压力大。
- 方案 C（超稳容量）：不使用容器，直接打包纯 Opus 帧并自定义最小头；编码与解码皆由前端完成，空间最省，但通用播放器不可直接播放。


## 验收标准

- 在默认 2.0 s、8 kb/s 参数下，绝大多数设备能生成长度≤2953 的 base64 字符串并顺利渲染 Version 40-L QR。
- 若超限，应用自动调整策略后仍能给出成功结果或明确提示需要“缩短至≥1.8–1.9 s”或“降低码率”。
- 全流程不与服务器交互，禁用网络时可完成全部操作与导出。

若需要，可在后续提供“接口契约文档（方法签名、参数/返回结构、错误码）”与“前端状态机图/时序图”，以便团队拆分开发与并行联调。
<span style="display:none">[^1][^2][^3][^4][^5][^6][^7][^8]</span>

<div style="text-align: center">⁂</div>

[^1]: https://developer.mozilla.org/en-US/docs/Web/API/MediaStream_Recording_API/Using_the_MediaStream_Recording_API

[^2]: https://www.reddit.com/r/webdev/comments/kdzstp/how_to_record_audio_input_and_output_via_a_website/

[^3]: https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API

[^4]: https://stackoverflow.com/questions/16240459/high-quality-audio-recording-in-web-browser

[^5]: https://picovoice.ai/blog/how-to-record-audio-from-a-web-browser/

[^6]: https://github.com/higuma/web-audio-recorder-js

[^7]: https://www.npmjs.com/package/react-audio-voice-recorder

[^8]: https://blog.addpipe.com/using-recorder-js-to-capture-wav-audio-in-your-html5-web-site/

