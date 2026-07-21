# Pixiv to Linx

简体中文 | [English](./README.md)

Pixiv to Linx 是一个专为[少数派 Linx68](https://sspai.com/product/143) 设计的 Tampermonkey 用户脚本。它可以获取 Pixiv 作品原图，将图片处理为适合键盘屏幕的格式，并直接推送到设备。

## 功能

- 从 Pixiv 的 `i.pximg.net` 图片服务器下载作品原图。
- 无法直接访问原图时，自动使用 Pixiv.cat 文档介绍的 `i.pixiv.cat` 反向代理。
- 使用 Cropper.js，并将裁剪比例固定为键盘屏幕所需的 `142:428`。
- 先按原始像素尺寸导出裁剪结果，再以高质量缩放到准确的 `142x428`。
- 优先使用最高 JPEG 质量，仅在文件超过 512 KiB 时降低质量。
- 上传前检查输出是否为基线 JPEG。
- 通过 Tampermonkey 在本地保存 Linx 键盘地址。

## 使用要求

- 安装了 Tampermonkey 的浏览器。
- 可以访问 Pixiv 及其原图服务器。
- 浏览器所在网络能够访问[少数派 Linx68](https://sspai.com/product/143)。
- 键盘固件提供 `POST /image/upload` 接口，并接受 JPEG 原始字节。

## 安装

### 直接安装

1. 在浏览器中安装 Tampermonkey。
2. 打开 [Pixiv to Linx 用户脚本链接](https://github.com/gcnwm/Pixiv-to-Linx/raw/refs/heads/main/Pixiv-to-Linx.user.js)。
3. Tampermonkey 通常会自动识别 `.user.js` 文件并打开脚本安装页面。
4. 检查脚本请求的权限，然后点击 **安装**。

### 从 URL 导入

如果没有自动打开安装页面：

1. 复制以下链接：

   ```text
   https://github.com/gcnwm/Pixiv-to-Linx/raw/refs/heads/main/Pixiv-to-Linx.user.js
   ```

2. 打开 Tampermonkey 管理面板。
3. 打开 **实用工具**，找到 **从 URL 导入**。
4. 粘贴链接，导入用户脚本并确认安装。

由于每台键盘的 IP 地址或主机名可能不同，脚本需要使用 `@connect *`。脚本会在运行时验证用户配置的目标地址，只接受不含用户名、密码、路径、查询参数或锚点的 HTTP 或 HTTPS 地址。

## 配置

默认键盘地址为 `http://espressif.lan`，无需首次配置即可直接使用。如需连接其他设备，请打开该脚本的 Tampermonkey 菜单，然后选择 **设置键盘地址**。支持以下格式：

```text
192.168.5.204
192.168.5.204:8080
keyboard.local
http://keyboard.local
https://keyboard.example
```

规范化后的自定义地址会保存在 Tampermonkey 本地存储中，并覆盖默认地址。

## 使用方法

1. 打开一个 Pixiv 作品页面。
2. 点击页面右下角的 **推送到键盘**。
3. 移动图片或调整固定比例的裁剪区域。
4. 点击 **裁剪并推送**。
5. 等待裁剪窗口显示推送成功。

脚本会按照选定区域完成裁剪，以原始尺寸导出裁剪结果，再缩放到 `142x428`，编码并验证为基线 JPEG，最后将图片字节上传到：

```text
http(s)://<已配置的键盘地址>/image/upload
```

## 开发检查

运行以下命令检查 JavaScript 语法：

```powershell
node --check '.\Pixiv-to-Linx.user.js'
```

## 许可证

MIT。Copyright 2026 Zois。
