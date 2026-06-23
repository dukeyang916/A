// v1 本地优先存储：用小程序自带的 Storage API，不依赖任何后端。
// 好处是用户拿到代码后在微信开发者工具里就能直接跑起来，不用先去配置云空间。
// 后续做 v1.x 多人协作时，把这一层换成 uniCloud 调用即可，repo 层对外的接口不用变。

const NAMESPACE = 'trip_split_v1'

function readCollection<T>(key: string): T[] {
  const raw = uni.getStorageSync(`${NAMESPACE}:${key}`)
  return Array.isArray(raw) ? (raw as T[]) : []
}

function writeCollection<T>(key: string, items: T[]): void {
  uni.setStorageSync(`${NAMESPACE}:${key}`, items)
}

export const storage = {
  readCollection,
  writeCollection,
}
