/** 本地生成唯一 id，v1 本地存储场景够用；接云端后台时可换成服务端生成的 _id */
export function createId(prefix: string): string {
  const random = Math.random().toString(36).slice(2, 10)
  return `${prefix}_${Date.now().toString(36)}_${random}`
}
