// v1 本地优先存储：用小程序自带的 Storage API，不依赖任何后端。
// 好处是用户拿到代码后在微信开发者工具里就能直接跑起来，不用先去配置云空间。
// v1.x 多人协作不是替换这一层，而是叠加：开启协作的行程在每次本地写入后额外同步一份到
// wx.cloud 数据库（见 services/cloudShare.ts），未开启协作的行程行为完全不变。

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
