// 微信小程序原生云开发 API 的最小类型声明：@dcloudio/types 只覆盖 uniCloud，不包含
// 原生 wx.cloud，这里只按项目里实际用到的方法补充，不追求覆盖全量 API。
interface WxCloudCallFunctionResult<T> {
  result: T
  requestID: string
}

interface WxCloudUploadFileResult {
  fileID: string
}

interface WxCloudStatic {
  init(options?: { env?: string; traceUser?: boolean }): void
  callFunction<T = unknown>(options: {
    name: string
    data?: Record<string, unknown>
  }): Promise<WxCloudCallFunctionResult<T>>
  uploadFile(options: { cloudPath: string; filePath: string }): Promise<WxCloudUploadFileResult>
}

declare const wx: { cloud: WxCloudStatic }
