// 微信小程序原生云开发 API 的最小类型声明：@dcloudio/types 只覆盖 uniCloud，不包含
// 原生 wx.cloud，这里只按项目里实际用到的方法补充，不追求覆盖全量 API。
interface WxCloudCallFunctionResult<T> {
  result: T
  requestID: string
}

interface WxCloudUploadFileResult {
  fileID: string
}

// 云数据库最小类型声明：客户端这边只会按 _id 直接 doc().get()/update() 整份覆盖写，
// where/add/count/command.push 这些只在云函数（纯 JS，不走类型检查）里用到，这里不声明。
interface WxDbDocSnapshot<T> {
  data: T
}

interface WxDbWriteResult {
  _id?: string
}

interface WxDbDocumentReference<T> {
  get(): Promise<WxDbDocSnapshot<T>>
  update(options: { data: Partial<T> & Record<string, unknown> }): Promise<WxDbWriteResult>
}

interface WxDbCollection<T> {
  doc(id: string): WxDbDocumentReference<T>
}

interface WxDatabase {
  collection<T = unknown>(name: string): WxDbCollection<T>
}

interface WxCloudStatic {
  init(options?: { env?: string; traceUser?: boolean }): void
  callFunction<T = unknown>(options: {
    name: string
    data?: Record<string, unknown>
  }): Promise<WxCloudCallFunctionResult<T>>
  uploadFile(options: { cloudPath: string; filePath: string }): Promise<WxCloudUploadFileResult>
  database(): WxDatabase
}

declare const wx: { cloud: WxCloudStatic }
