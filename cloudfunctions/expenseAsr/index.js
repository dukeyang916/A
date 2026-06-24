const cloud = require('wx-server-sdk')
const tencentcloud = require('tencentcloud-sdk-nodejs-asr')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const AsrClient = tencentcloud.asr.v20190614.Client

function buildClient() {
  return new AsrClient({
    credential: {
      secretId: process.env.TENCENTCLOUD_SECRET_ID,
      secretKey: process.env.TENCENTCLOUD_SECRET_KEY,
    },
    region: process.env.TENCENTCLOUD_REGION || 'ap-guangzhou',
    profile: {
      httpProfile: {
        endpoint: 'asr.tencentcloudapi.com',
      },
    },
  })
}

// event: { fileID: string } —— 客户端用 uni.getRecorderManager 录音后上传到云存储得到的文件 ID。
// 录音格式固定用 mp3（客户端录制时指定 format: 'mp3'），这里走"一句话识别"，适合几十秒内的短语音，
// 不适合长录音（长录音要换成录音文件识别极速版的异步接口）。
exports.main = async (event) => {
  const { fileID } = event
  if (!fileID) return { error: 'missing fileID' }

  const { fileContent } = await cloud.downloadFile({ fileID })
  const voiceBase64 = fileContent.toString('base64')

  const client = buildClient()
  const resp = await client.SentenceRecognition({
    ProjectId: 0,
    SubServiceType: 2,
    EngSerViceType: '16k_zh',
    SourceType: 1,
    VoiceFormat: 'mp3',
    Data: voiceBase64,
    DataLen: fileContent.length,
  })

  return { text: resp.Result || '' }
}
