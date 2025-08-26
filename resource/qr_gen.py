import base64
import qrcode

MAX_AUDIO_SIZE = 2240

with open("output.mp4", "rb") as f:
    audio_data = f.read()

audio_size = len(audio_data)
if audio_size > MAX_AUDIO_SIZE:
    audio_data = audio_data[:MAX_AUDIO_SIZE]
    print(f"Warning: Audio data truncated to {MAX_AUDIO_SIZE} bytes")

audio_b64 = base64.b64encode(audio_data)

qr = qrcode.QRCode(
    version=20,
    error_correction=qrcode.constants.ERROR_CORRECT_L,
    box_size=2,
)
qr.add_data(audio_b64)
qr.make(fit=True)
img = qr.make_image()
img.save("audioQR_sample.png")

