# v1.1 云能力配置指南

v1.1 的语音记账 / 拍照识别小票 / 对话式记账，依赖微信云开发 + 腾讯云三个 AI 服务（ASR、OCR、混元大模型）。这些都需要手动开通和配置，仓库代码里不包含任何密钥，跳过本文档直接编译运行的话，这三个 AI 入口会报错提示未配置。

## 1. 开通微信云开发

1. 用小程序管理员账号登录[微信开发者工具](https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html)，打开本项目编译后的小程序目录（`npm run dev:mp-weixin` 产出的 `dist/dev/mp-weixin`）。
2. 工具顶部菜单「云开发」→ 首次使用会引导开通，选按量计费或有免费额度的套餐都可以。
3. 开通后，云开发控制台顶部能看到环境 ID（形如 `xxx-1a2b3c4d5e`），把它填进 `src/constants/cloud.ts` 的 `CLOUD_ENV_ID`。

## 2. 开通腾讯云 AI 服务

云函数里调的是腾讯云的服务，跟微信云开发是两个独立的腾讯系产品，要分别开通：

1. 登录[腾讯云控制台](https://console.cloud.tencent.com)（可以和小程序主体账号一致，也可以是公司主账号）。
2. 在控制台顶部搜索框分别搜索并开通：
   - 语音识别（ASR）—— 用到一句话识别 `SentenceRecognition`
   - 文字识别（OCR）—— 用到通用印刷体识别 `GeneralBasicOCR`
   - 混元大模型 —— 用到 `hunyuan-lite` 模型
3. 在[访问管理 CAM 的 API 密钥页](https://console.cloud.tencent.com/cam/capi)创建一个密钥，得到 `SecretId` / `SecretKey`。建议新建一个只授权上述三个服务的子账号密钥，不要直接用主账号密钥。

## 3. 给云函数配置密钥

`cloudfunctions/` 下三个函数（`expenseAsr`、`expenseOcr`、`expenseParse`）都通过环境变量读取密钥，不要把密钥写进代码：

1. 微信开发者工具「云开发」控制台 → 云函数 → 选中某个函数 → 配置 → 环境变量，添加：
   - `TENCENTCLOUD_SECRET_ID`
   - `TENCENTCLOUD_SECRET_KEY`
   - `TENCENTCLOUD_REGION`（建议填 `ap-guangzhou`，三个腾讯云服务在这个区域都能用；不填代码里也有这个默认值）
2. 三个函数要分别配置一遍，环境变量是按函数独立生效的。

## 4. 上传部署云函数

1. 微信开发者工具里右键 `cloudfunctions/expenseAsr`（以及另外两个目录）→「上传并部署：云端安装依赖」。
2. 等云端按每个函数自己的 `package.json` 装完依赖即可，不需要本地先 `npm install` 这几个云函数目录。
3. 三个函数都部署一遍。后续这几个函数代码有更新，重新执行这一步同步即可。

## 5. 真机调试注意事项

- 语音记账首次使用会触发系统麦克风权限弹窗，拍照记账会触发相机权限弹窗，对应 `src/manifest.json` 里 `scope.record` / `scope.camera` 的描述文案。
- 微信开发者工具的模拟器不支持真实录音，语音记账要用真机扫码预览调试。
- 如果某个 AI 入口报错"AI 录入功能仅支持微信小程序"，要么是在 H5/App 端预览（这个功能本身就是小程序专属），要么是 `CLOUD_ENV_ID` 还没填。

## 6. 成本提示

- `hunyuan-lite` 是混元里成本最低的模型，三种录入方式共用同一个解析云函数，调用量基本等于"记账次数"，量级不大。
- ASR、OCR 通常都有每月免费额度，超出部分按量计费，具体额度和单价以腾讯云当时的计费页面为准，本文不保证长期准确，开通时注意确认一下。
- 收据 OCR 用的是通用印刷体识别（兜底方案，任何开通了 OCR 的账号都能用，识别准确度一般）。如果后续想换成更精准的票据专用识别，去 OCR 控制台开通对应产品，把 `cloudfunctions/expenseOcr/index.js` 里的 `GeneralBasicOCR` 换成对应 Action 即可，`guessAmount` 的本地兜底逻辑可以保留也可以去掉。
