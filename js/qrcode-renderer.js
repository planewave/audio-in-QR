// qrcode-renderer.js
import * as QRCode from 'https://esm.sh/qrcode@1.5.3';

export async function renderQR(data) {
  const opts = {
    errorCorrectionLevel: 'L',
    type: 'image/png',
    quality: 1,
    margin: 1,
    width: 512,
    version: 40
  };
  const url = await QRCode.toDataURL(data, opts);
  return url;
}