const cloud = require('wx-server-sdk')
const tencentcloud = require('tencentcloud-sdk-nodejs-ocr')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const OcrClient = tencentcloud.ocr.v20181119.Client

function buildClient() {
  return new OcrClient({
    credential: {
      secretId: process.env.TENCENTCLOUD_SECRET_ID,
      secretKey: process.env.TENCENTCLOUD_SECRET_KEY,
    },
    region: process.env.TENCENTCLOUD_REGION || 'ap-guangzhou',
    profile: {
      httpProfile: {
        endpoint: 'ocr.tencentcloudapi.com',
      },
    },
  })
}

// 小票上没有统一格式，这里只兜底猜一个金额，最终类目/备注交给 expenseParse 用大模型去理解
// rawText，不在这里强行结构化解析。
function guessAmount(rawText) {
  const matches = rawText.match(/(?:合计|总计|实付|金额|total)[^\d]{0,4}(\d+\.?\d{0,2})/i)
  if (matches) return Number.parseFloat(matches[1])
  const numbers = (rawText.match(/\d+\.\d{2}/g) || []).map(Number.parseFloat)
  if (numbers.length === 0) return undefined
  return Math.max(...numbers)
}

// event: { fileID: string } —— fileID 是客户端 wx.cloud.uploadFile 上传后拿到的云存储文件 ID
exports.main = async (event) => {
  const { fileID } = event
  if (!fileID) return { error: 'missing fileID' }

  const { fileContent } = await cloud.downloadFile({ fileID })
  const imageBase64 = fileContent.toString('base64')

  const client = buildClient()
  // 用通用印刷体识别做兜底方案：不依赖额外开通的票据专用 OCR 产品，任何开通了 OCR 的
  // 账号都能用。如果后续在腾讯云控制台开通了更精准的票据识别（如智能结构化/混合票据
  // OCR），把这里换成对应 Action 即可，guessAmount 的兜底逻辑可以保留也可以去掉。
  const resp = await client.GeneralBasicOCR({ ImageBase64: imageBase64 })
  const rawText = (resp.TextDetections || []).map((t) => t.DetectedText).join('\n')

  return {
    rawText,
    amountGuess: guessAmount(rawText),
  }
}
