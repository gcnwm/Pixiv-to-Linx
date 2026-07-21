// ==UserScript==
// @name         Pixiv to Linx
// @namespace    local.keyboard.image.push
// @version      1.1.2
// @description  Crop a Pixiv original to 142x428 JPEG and push it to an SSPAI Linx68 keyboard.
// @author       Zois
// @copyright    2026, Zois
// @license      MIT
// @match        https://www.pixiv.net/*
// @icon         https://www.pixiv.net/favicon.ico
// @require      https://cdn.jsdelivr.net/npm/cropperjs@1.6.2/dist/cropper.min.js
// @resource     cropperCSS https://cdn.jsdelivr.net/npm/cropperjs@1.6.2/dist/cropper.min.css
// @connect      www.pixiv.net
// @connect      i.pximg.net
// @connect      i.pixiv.cat
// @connect      *
// @grant        GM_xmlhttpRequest
// @grant        GM_getResourceText
// @grant        GM_addStyle
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @run-at       document-idle
// ==/UserScript==

(function () {
    'use strict';

    const OUTPUT_WIDTH = 142;
    const OUTPUT_HEIGHT = 428;
    const MAX_BYTES = 512 * 1024;
    const KEYBOARD_ORIGIN_KEY = 'keyboardOrigin';
    const DEFAULT_KEYBOARD_ORIGIN = 'http://espressif.lan';
    const UPLOAD_PATH = '/image/upload';
    const ROOT_ID = 'pixiv-keyboard-push-root';

    let cropper = null;
    let sourceObjectUrl = null;
    let outputBlob = null;
    let outputQuality = null;
    let busy = false;

    GM_addStyle(GM_getResourceText('cropperCSS'));
    GM_addStyle(`
        #${ROOT_ID}, #${ROOT_ID} * { box-sizing: border-box; }
        #${ROOT_ID} .pkp-launch {
            position: fixed; right: 2px; bottom: 2px; z-index: 2147483646;
            min-height: 28px; margin: 0; padding: 3px 9px;
            border: 2px solid #111; border-radius: 4px;
            background: #fff; color: #111; opacity: .72;
            font: 600 13px/18px system-ui, sans-serif; cursor: pointer;
        }
        #${ROOT_ID} .pkp-launch:hover,
        #${ROOT_ID} .pkp-launch:focus-visible { opacity: 1; }
        #${ROOT_ID} .pkp-launch:disabled { cursor: wait; opacity: .55; }
        #${ROOT_ID} .pkp-overlay {
            position: fixed; inset: 0; z-index: 2147483647;
            display: none; align-items: center; justify-content: center;
            padding: 20px; background: rgba(0, 0, 0, .72);
            font-family: system-ui, sans-serif;
        }
        #${ROOT_ID} .pkp-overlay[data-open="true"] { display: flex; }
        #${ROOT_ID} .pkp-dialog {
            display: flex; flex-direction: column; width: min(920px, 96vw);
            max-height: 94vh; overflow: hidden; border: 1px solid #3b3b43;
            border-radius: 14px; background: #17171b; color: #f5f5f5;
            box-shadow: 0 24px 70px rgba(0, 0, 0, .6);
        }
        #${ROOT_ID} .pkp-header,
        #${ROOT_ID} .pkp-actions {
            display: flex; align-items: center; gap: 10px; padding: 12px 14px;
        }
        #${ROOT_ID} .pkp-header { justify-content: space-between; border-bottom: 1px solid #33333a; }
        #${ROOT_ID} .pkp-title { margin: 0; font-size: 17px; }
        #${ROOT_ID} .pkp-close {
            width: 32px; height: 32px; border: 0; border-radius: 8px;
            background: transparent; color: #ddd; font-size: 24px; cursor: pointer;
        }
        #${ROOT_ID} .pkp-close:hover { background: #2d2d34; }
        #${ROOT_ID} .pkp-workspace {
            min-height: 260px; height: min(650px, 70vh); padding: 12px;
            background: #0e0e11;
        }
        #${ROOT_ID} .pkp-image { display: block; max-width: 100%; }
        #${ROOT_ID} .pkp-actions { flex-wrap: wrap; border-top: 1px solid #33333a; }
        #${ROOT_ID} .pkp-status {
            flex: 1 1 300px; min-width: 0; color: #bbb; font-size: 13px;
        }
        #${ROOT_ID} .pkp-status[data-kind="error"] { color: #ff847c; }
        #${ROOT_ID} .pkp-status[data-kind="success"] { color: #70d68a; }
        #${ROOT_ID} .pkp-button {
            min-height: 36px; padding: 7px 14px; border: 0; border-radius: 9px;
            background: #3b3b44; color: #fff; font-weight: 650; cursor: pointer;
        }
        #${ROOT_ID} .pkp-button:hover:not(:disabled) { background: #4a4a55; }
        #${ROOT_ID} .pkp-button.pkp-primary { background: #0096fa; }
        #${ROOT_ID} .pkp-button.pkp-primary:hover:not(:disabled) { background: #19a4ff; }
        #${ROOT_ID} .pkp-button:disabled { cursor: wait; opacity: .5; }
        #${ROOT_ID} .cropper-view-box,
        #${ROOT_ID} .cropper-face { border-radius: 2px; }
    `);

    const root = document.createElement('div');
    root.id = ROOT_ID;
    root.innerHTML = `
        <button type="button" class="pkp-launch" title="裁剪当前 Pixiv 作品并推送到键盘">推送到键盘</button>
        <div class="pkp-overlay" role="dialog" aria-modal="true" aria-label="裁剪并推送图片">
            <section class="pkp-dialog">
                <header class="pkp-header">
                    <h2 class="pkp-title">裁剪为 ${OUTPUT_WIDTH} × ${OUTPUT_HEIGHT}</h2>
                    <button type="button" class="pkp-close" aria-label="关闭">×</button>
                </header>
                <div class="pkp-workspace">
                    <img class="pkp-image" alt="待裁剪的 Pixiv 图片">
                </div>
                <footer class="pkp-actions">
                    <span class="pkp-status" aria-live="polite">拖动图片或裁剪框来选择显示区域。</span>
                    <button type="button" class="pkp-button pkp-reset">重置</button>
                    <button type="button" class="pkp-button pkp-primary pkp-push">裁剪并推送</button>
                </footer>
            </section>
        </div>
    `;
    document.body.appendChild(root);

    const launchButton = root.querySelector('.pkp-launch');
    const overlay = root.querySelector('.pkp-overlay');
    const closeButton = root.querySelector('.pkp-close');
    const resetButton = root.querySelector('.pkp-reset');
    const pushButton = root.querySelector('.pkp-push');
    const statusText = root.querySelector('.pkp-status');
    const image = root.querySelector('.pkp-image');

    function getArtworkId() {
        return location.pathname.match(/\/artworks\/(\d+)/)?.[1] ?? null;
    }

    function setStatus(message, kind = 'info') {
        statusText.textContent = message;
        statusText.dataset.kind = kind;
    }

    function setBusy(nextBusy, launchLabel = '推送到键盘') {
        busy = nextBusy;
        launchButton.disabled = nextBusy;
        pushButton.disabled = nextBusy;
        resetButton.disabled = nextBusy;
        closeButton.disabled = nextBusy;
        launchButton.textContent = nextBusy ? launchLabel : '推送到键盘';
    }

    function normalizeKeyboardOrigin(value) {
        const trimmedValue = String(value ?? '').trim();
        if (!trimmedValue) throw new Error('键盘地址不能为空。');

        const candidate = /^[a-z][a-z\d+.-]*:\/\//i.test(trimmedValue)
            ? trimmedValue
            : `http://${trimmedValue}`;
        let url;
        try {
            url = new URL(candidate);
        } catch {
            throw new Error('键盘地址格式无效。');
        }

        if (!['http:', 'https:'].includes(url.protocol)) {
            throw new Error('键盘地址仅支持 HTTP 或 HTTPS。');
        }
        if (!url.hostname) throw new Error('键盘地址缺少主机名或 IP。');
        if (url.username || url.password) throw new Error('键盘地址不能包含用户名或密码。');
        if (url.pathname !== '/' || url.search || url.hash) {
            throw new Error('只需输入键盘地址和可选端口，不要包含路径、查询或锚点。');
        }
        return url.origin;
    }

    function getStoredKeyboardOrigin() {
        const storedOrigin = GM_getValue(KEYBOARD_ORIGIN_KEY, DEFAULT_KEYBOARD_ORIGIN);
        if (!storedOrigin) return null;
        try {
            return normalizeKeyboardOrigin(storedOrigin);
        } catch {
            return null;
        }
    }

    function promptForKeyboardOrigin() {
        let initialValue = GM_getValue(KEYBOARD_ORIGIN_KEY, DEFAULT_KEYBOARD_ORIGIN);
        while (true) {
            const value = window.prompt(
                '请输入键盘地址，例如 192.168.5.204、192.168.5.204:8080 或 http://keyboard.local',
                initialValue,
            );
            if (value === null) return null;

            try {
                const origin = normalizeKeyboardOrigin(value);
                GM_setValue(KEYBOARD_ORIGIN_KEY, origin);
                return origin;
            } catch (error) {
                window.alert(error.message || String(error));
                initialValue = value;
            }
        }
    }

    function request(options) {
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                timeout: 45000,
                ...options,
                onload: resolve,
                onerror: () => reject(new Error('网络请求失败，请检查网络和 Tampermonkey 的域名授权。')),
                ontimeout: () => reject(new Error('网络请求超时。')),
                onabort: () => reject(new Error('网络请求已取消。')),
            });
        });
    }

    function responseContentType(rawHeaders) {
        return rawHeaders?.match(/^content-type:\s*([^;\r\n]+)/im)?.[1] || 'application/octet-stream';
    }

    async function getOriginalUrl(artworkId) {
        const response = await request({
            method: 'GET',
            url: `https://www.pixiv.net/ajax/illust/${artworkId}/pages?lang=en`,
            headers: {
                Accept: 'application/json',
                Referer: `https://www.pixiv.net/artworks/${artworkId}`,
            },
            responseType: 'text',
        });
        if (response.status < 200 || response.status >= 300) {
            throw new Error(`Pixiv 获取原图地址失败（HTTP ${response.status || '未知'}）。`);
        }

        let payload;
        try {
            payload = JSON.parse(response.responseText);
        } catch {
            throw new Error('Pixiv 返回了无法解析的作品数据。');
        }
        const originalUrl = payload?.body?.[0]?.urls?.original;
        if (payload.error || !originalUrl) {
            throw new Error(payload.message || 'Pixiv 没有返回这张作品的原图地址。');
        }
        return originalUrl;
    }

    async function downloadArtwork(url) {
        const response = await request({
            method: 'GET',
            url,
            headers: {
                Referer: 'https://www.pixiv.net/',
                Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
            },
            responseType: 'arraybuffer',
        });

        if (response.status < 200 || response.status >= 300 || !response.response?.byteLength) {
            throw new Error(`Pixiv 原图下载失败（HTTP ${response.status || '未知'}）。`);
        }

        return new Blob([response.response], { type: responseContentType(response.responseHeaders) });
    }

    async function fetchArtwork(artworkId) {
        const originalUrl = await getOriginalUrl(artworkId);
        try {
            // Pixiv's original host is fastest when the Referer is preserved.
            return await downloadArtwork(originalUrl);
        } catch (directError) {
            // Use Pixiv.cat's documented reverse proxy only when direct access fails.
            try {
                const fallbackUrl = new URL(originalUrl);
                if (fallbackUrl.hostname !== 'i.pximg.net') throw directError;
                fallbackUrl.hostname = 'i.pixiv.cat';
                return await downloadArtwork(fallbackUrl.toString());
            } catch {
                throw new Error(`${directError.message} 备用代理也无法获取图片。`);
            }
        }
    }

    function loadImage(blob) {
        return new Promise((resolve, reject) => {
            if (sourceObjectUrl) URL.revokeObjectURL(sourceObjectUrl);
            sourceObjectUrl = URL.createObjectURL(blob);
            image.onload = resolve;
            image.onerror = () => reject(new Error('浏览器无法解码 Pixiv 返回的图片。'));
            image.src = sourceObjectUrl;
        });
    }

    async function openCropper() {
        const artworkId = getArtworkId();
        if (!artworkId) {
            alert('请先打开 Pixiv 作品页面（例如 /artworks/70960479）。');
            return;
        }

        setBusy(true, '正在获取…');
        try {
            const blob = await fetchArtwork(artworkId);
            await loadImage(blob);
            overlay.dataset.open = 'true';
            document.documentElement.style.overflow = 'hidden';

            cropper?.destroy();
            cropper = new Cropper(image, {
                aspectRatio: OUTPUT_WIDTH / OUTPUT_HEIGHT,
                viewMode: 1,
                dragMode: 'move',
                autoCropArea: 0.9,
                responsive: true,
                restore: false,
                background: false,
                guides: true,
                center: true,
                highlight: false,
                toggleDragModeOnDblclick: false,
                ready() {
                    setStatus(`作品 ${artworkId} 已载入。拖动并缩放后推送。`);
                },
            });
        } catch (error) {
            alert(error.message || String(error));
        } finally {
            setBusy(false);
        }
    }

    function closeCropper() {
        if (busy) return;
        overlay.dataset.open = 'false';
        document.documentElement.style.overflow = '';
        cropper?.destroy();
        cropper = null;
        image.removeAttribute('src');
        if (sourceObjectUrl) URL.revokeObjectURL(sourceObjectUrl);
        sourceObjectUrl = null;
        outputBlob = null;
        outputQuality = null;
        setStatus('拖动图片或裁剪框来选择显示区域。');
    }

    function canvasToJpeg(canvas, quality) {
        return new Promise((resolve, reject) => {
            canvas.toBlob(
                (blob) => blob ? resolve(blob) : reject(new Error('JPEG 编码失败。')),
                'image/jpeg',
                quality,
            );
        });
    }

    function findJpegFrameMarker(bytes) {
        if (bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
        for (let offset = 2; offset + 3 < bytes.length;) {
            if (bytes[offset] !== 0xff) {
                offset += 1;
                continue;
            }
            while (bytes[offset] === 0xff) offset += 1;
            const marker = bytes[offset++];
            if (marker === 0xd9 || marker === 0xda) break;
            if (marker >= 0xd0 && marker <= 0xd7) continue;
            const length = (bytes[offset] << 8) | bytes[offset + 1];
            if (length < 2) return null;
            if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
                return marker;
            }
            offset += length;
        }
        return null;
    }

    async function validateOutput(blob) {
        if (blob.type !== 'image/jpeg') throw new Error('输出格式不是 JPEG。');
        if (blob.size > MAX_BYTES) throw new Error(`输出仍超过 512 KB（${formatBytes(blob.size)}）。`);

        const bytes = new Uint8Array(await blob.arrayBuffer());
        const frameMarker = findJpegFrameMarker(bytes);
        if (frameMarker !== 0xc0) {
            throw new Error(frameMarker === 0xc2
                ? '浏览器生成了渐进式 JPEG，而设备仅接受基线 JPEG。'
                : '无法确认输出为基线 JPEG。');
        }
    }

    async function createOutput() {
        if (!cropper) throw new Error('裁剪器尚未就绪。');
        // Export the fixed-ratio crop at its natural pixel size first. Resizing
        // in a separate pass avoids asking Cropper.js to downsample during crop.
        const croppedCanvas = cropper.getCroppedCanvas({
            fillColor: '#ffffff',
            imageSmoothingEnabled: true,
            imageSmoothingQuality: 'high',
        });
        if (!croppedCanvas || !croppedCanvas.width || !croppedCanvas.height) {
            throw new Error('无法生成固定比例的裁剪结果。');
        }

        const canvas = document.createElement('canvas');
        canvas.width = OUTPUT_WIDTH;
        canvas.height = OUTPUT_HEIGHT;
        const context = canvas.getContext('2d');
        if (!context) throw new Error('浏览器无法创建图片缩放画布。');
        context.imageSmoothingEnabled = true;
        context.imageSmoothingQuality = 'high';
        context.drawImage(croppedCanvas, 0, 0, OUTPUT_WIDTH, OUTPUT_HEIGHT);

        const maximumQualityBlob = await canvasToJpeg(canvas, 1);
        if (maximumQualityBlob.size <= MAX_BYTES) {
            outputBlob = maximumQualityBlob;
            outputQuality = 1;
            await validateOutput(maximumQualityBlob);
            return maximumQualityBlob;
        }

        const minimumQuality = 0.40;
        const minimumQualityBlob = await canvasToJpeg(canvas, minimumQuality);
        if (minimumQualityBlob.size > MAX_BYTES) {
            throw new Error('无法将图片压缩到 512 KB 以下。');
        }

        let bestBlob = minimumQualityBlob;
        let bestQuality = minimumQuality;
        let low = minimumQuality;
        let high = 1;
        for (let attempt = 0; attempt < 7; attempt += 1) {
            const quality = Number(((low + high) / 2).toFixed(3));
            const blob = await canvasToJpeg(canvas, quality);
            if (blob.size <= MAX_BYTES) {
                bestBlob = blob;
                bestQuality = quality;
                low = quality;
            } else {
                high = quality;
            }
        }

        outputBlob = bestBlob;
        outputQuality = bestQuality;
        await validateOutput(bestBlob);
        return bestBlob;
    }

    function formatBytes(bytes) {
        return bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`;
    }

    async function upload(blob, keyboardOrigin) {
        const body = await blob.arrayBuffer();
        const uploadUrl = `${keyboardOrigin}${UPLOAD_PATH}`;
        let response;
        try {
            response = await request({
                method: 'POST',
                url: uploadUrl,
                headers: { 'Content-Type': 'image/jpeg' },
                data: body,
                responseType: 'text',
            });
        } catch (error) {
            throw new Error(`无法连接键盘 ${new URL(keyboardOrigin).host}：${error.message || String(error)}`);
        }

        if (response.status < 200 || response.status >= 300) {
            const detail = String(response.responseText || response.response || '').trim();
            throw new Error(`键盘 ${new URL(keyboardOrigin).host} 拒绝了图片（HTTP ${response.status || '未知'}）${detail ? `：${detail}` : ''}`);
        }
        return response;
    }

    async function cropAndPush() {
        if (busy) return;
        const keyboardOrigin = getStoredKeyboardOrigin() || promptForKeyboardOrigin();
        if (!keyboardOrigin) {
            setStatus('未设置键盘地址，未执行推送。', 'error');
            return;
        }
        setBusy(true);
        setStatus('正在裁剪并编码 JPEG…');
        try {
            const blob = await createOutput();
            setStatus(`正在向 ${new URL(keyboardOrigin).host} 推送 ${OUTPUT_WIDTH}×${OUTPUT_HEIGHT}、${formatBytes(blob.size)}、质量 ${outputQuality}…`);
            await upload(blob, keyboardOrigin);
            setStatus(`推送成功：${OUTPUT_WIDTH}×${OUTPUT_HEIGHT} JPEG，${formatBytes(blob.size)}。`, 'success');
        } catch (error) {
            setStatus(error.message || String(error), 'error');
        } finally {
            setBusy(false);
        }
    }

    GM_registerMenuCommand('设置键盘地址', () => {
        const origin = promptForKeyboardOrigin();
        if (origin) window.alert(`键盘地址已保存：${origin}`);
    });

    launchButton.addEventListener('click', openCropper);
    closeButton.addEventListener('click', closeCropper);
    resetButton.addEventListener('click', () => cropper?.reset());
    pushButton.addEventListener('click', cropAndPush);
    overlay.addEventListener('click', (event) => {
        if (event.target === overlay) closeCropper();
    });
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && overlay.dataset.open === 'true') closeCropper();
    });
})();
