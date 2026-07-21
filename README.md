# Pixiv to Linx

[简体中文](./README.zh-CN.md) | English

Pixiv to Linx is a Tampermonkey userscript designed for the [SSPAI Linx68](https://sspai.com/product/143). It fetches the original image from a Pixiv artwork, prepares it for the keyboard display, and pushes it directly to the device.

## Features

- Downloads the original image from Pixiv's `i.pximg.net` image server.
- Falls back to the documented `i.pixiv.cat` reverse proxy when direct access fails.
- Uses Cropper.js with the keyboard display's fixed `142:428` aspect ratio.
- Exports the crop at its natural resolution before resizing it to exactly `142x428`.
- Encodes at maximum JPEG quality first and reduces quality only when the result exceeds 512 KiB.
- Verifies that the output is a baseline JPEG before upload.
- Stores the Linx keyboard address locally through Tampermonkey.

## Requirements

- A browser with Tampermonkey installed.
- Access to Pixiv and the original image server.
- An [SSPAI Linx68](https://sspai.com/product/143) reachable from the browser's network.
- Keyboard firmware exposing `POST /image/upload` and accepting raw JPEG bytes.

## Installation

### Direct Install

1. Install Tampermonkey in your browser.
2. Open the [Pixiv to Linx userscript link](https://github.com/gcnwm/Pixiv-to-Linx/raw/refs/heads/main/Pixiv-to-Linx.user.js).
3. Tampermonkey should intercept the `.user.js` file automatically and display its installation screen.
4. Review the requested permissions and select **Install**.

### Import From URL

If the installation screen does not open automatically:

1. Copy this URL:

   ```text
   https://github.com/gcnwm/Pixiv-to-Linx/raw/refs/heads/main/Pixiv-to-Linx.user.js
   ```

2. Open the Tampermonkey dashboard.
3. Open **Utilities** and find **Import from URL**.
4. Paste the URL, import the userscript, and confirm installation.

The script uses `@connect *` because each keyboard may have a different IP address or hostname. The configured destination is validated at runtime and must be an HTTP or HTTPS origin without credentials, paths, queries, or fragments.

## Configuration

The default keyboard address is `http://espressif.lan`, so it can be used immediately without first-use configuration. To use another device address, open the Tampermonkey menu for the script and select **设置键盘地址**. Supported forms include:

```text
192.168.5.204
192.168.5.204:8080
keyboard.local
http://keyboard.local
https://keyboard.example
```

The normalized custom address is stored with Tampermonkey's local value storage and overrides the default.

## Usage

1. Open a Pixiv artwork page.
2. Select **推送到键盘** at the bottom-right of the page.
3. Move or resize the fixed-ratio crop area.
4. Select **裁剪并推送**.
5. Wait for the success status in the crop dialog.

The script crops at the selected ratio, exports the natural crop, resizes it to `142x428`, encodes it as a baseline JPEG, and uploads the bytes to:

```text
http(s)://<configured-keyboard-address>/image/upload
```

## Development Check

Run the JavaScript syntax check with:

```powershell
node --check '.\Pixiv-to-Linx.user.js'
```

## License

MIT. Copyright 2026 Zois.
