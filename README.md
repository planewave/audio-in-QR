# QR audio clip

A prototype implementation that embeds and plays short audio clips through QR codes.  
一个将短音频嵌入 QR 码并播放的原型实现。

## Overview / 概述

This is a unique project that stores and plays short audio clips via QR codes. Despite being an interesting concept, there aren't many similar implementations available.  
这是一个独特的项目，通过 QR 码存储和播放短音频。尽管这是个有趣的想法，但目前还没有发现类似的实现。

Currently, a QR code can store approximately 1.4 seconds of audio using this method.  
目前使用该方法，一个 QR 码可以存储约 1.4 秒的音频。

## Features / 特点

- Offline playback - all audio data is stored in the QR code  
    离线播放 - 所有音频数据都存储在 QR 码中
- iOS Shortcut support ([Download](https://www.icloud.com/shortcuts/d9a68dcfe49a485dbd736846b6b84f10))  
    支持 iOS 快捷指令（[下载链接](https://www.icloud.com/shortcuts/d9a68dcfe49a485dbd736846b6b84f10)）
- Android support via Tasker  (not provided)
    支持通过 Tasker 在 Android 上使用 （未提供）

![QR Code](resource/audioQR_sample.png)

You can test it in your browser and create your own QR audio clip [here](https://planewave.github.io/audio-in-QR/).
你也可以使用浏览器在[这里](https://audio-in-qr.vercel.app/)测试, 将你的录音存入 QR 码中.

## Development / 开发

1. Prepare an audio clip (~1.4 second), a sample audio can be found in the resource folder 
     准备一段音频（约 1.4 秒）

2. Compress using FFmpeg with Opus codec:  
     使用 FFmpeg 和 Opus 编码压缩：
```bash
ffmpeg -i input.wav -c:a libopus -b:a 8k -ac 1 -ar 8000 output.mp4
```

3. Convert to QR code using `qr_gen.py`, (requires `qrcode` library)  
     使用`qr_gen.py`转换为 QR 码, (需要安装 `qrcode` 库)

4. Scan and play using iOS Shortcut 
     使用 iOS 快捷指令扫描并播放

![](resource/shortcut.jpeg)

## Technical Details / 技术细节

- Uses QR code version 40 (max ~3KB data capacity)  
    使用 QR 码版本40（最大约 3KB 数据容量）
- Base64 encoding for compatibility  
    使用 Base64 编码以确保兼容性
- Opus audio codec in MP4 container for iOS 17+ compatibility  
    使用 MP4 容器的 Opus 音频编码以兼容 iOS 17+

## Future Improvements / 未来改进

- Custom app could use binary QR codes to save 33% space  
    专用应用可以使用二进制 QR 码来节省33%空间
- Potential for 3-second audio with binary QR codes and optimized compression  
    通过二进制 QR 码和优化压缩，有潜力实现3秒音频

## Credits / 致谢

Sample audio from freesound.org  
示例音频来自 freesound.org

Web app is developed with Gemini CLI
Web 应用使用 Gemini CLI 开发
