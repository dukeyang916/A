import type { Expense, Member, Trip } from '@/types/models'
import { callCloudFunction, isCloudReady } from './cloud'

const NOT_SUPPORTED_ERROR = '多人协作功能仅支持微信小程序，且需要先完成云开发配置'

const COLLECTION = 'shared_trips'

interface SharedTripDoc {
  trip: Trip
  members: Member[]
  expenses: Expense[]
  updatedAt: number
}

export interface ShareSnapshot {
  trip: Trip
  members: Member[]
  expenses: Expense[]
  updatedAt: number
}

export interface CreateShareResult {
  shareCode: string
  /** 当前设备这个人的 openId，调用方要把它存到本地"我"这个成员上，否则下次本地 push 算不出
   *  正确的 memberOpenIds（其实 push 已经不传这个字段了，但 members 里仍该带上 openId 才准确） */
  myOpenId: string
}

/** 把本地行程第一次上传到云端开启协作，返回邀请码；已经开过的话云函数会原样把已有邀请码返回 */
export function createShare(trip: Trip, members: Member[], expenses: Expense[]): Promise<CreateShareResult> {
  return callCloudFunction<CreateShareResult>(
    'tripShareCreate',
    { tripId: trip._id, trip, members, expenses },
    NOT_SUPPORTED_ERROR
  )
}

export interface JoinShareResult {
  tripId: string
  trip: Trip
  members: Member[]
  expenses: Expense[]
  /** 新创建的"我"这个成员的 id；已经加入过时云函数会原样返回当时那个成员的 id */
  myMemberId?: string
}

export function joinShare(
  shareCode: string,
  memberName: string,
  avatarColor: string
): Promise<JoinShareResult> {
  return callCloudFunction<JoinShareResult>(
    'tripShareJoin',
    { shareCode: shareCode.trim().toUpperCase(), memberName, avatarColor },
    NOT_SUPPORTED_ERROR
  )
}

/** 拉取云端最新快照；云开发未配置/网络异常/文档不存在时返回 null，调用方按"这次同步不了，本地数据照常用"处理 */
export function pullShare(tripId: string): Promise<ShareSnapshot | null> {
  if (!isCloudReady()) return Promise.resolve(null)
  return wx.cloud
    .database()
    .collection<SharedTripDoc>(COLLECTION)
    .doc(tripId)
    .get()
    .then((res) => res.data)
    .catch(() => null)
}

/**
 * 把本地最新状态整份覆盖写回云端。不碰 memberOpenIds 字段：它只由云函数维护
 * （tripShareCreate 建文档时种下创建者，tripShareJoin 每次加入时 push 新人），
 * 客户端这边的 members 在本机刚邀请/还没来得及拉取协作者的最新名单时可能是不完整的，
 * 如果连带把 memberOpenIds 也覆盖上去，会把刚加入还没同步到本机的协作者从权限名单里
 * 抹掉，导致安全规则把所有人（包括自己）都挡在外面，且没有任何报错提示。
 * 失败静默吞掉——这只是本地写入成功之后的"顺便同步一下"，不该让本地操作显示失败，
 * 下次任意一端 pull 或者下次再 push 时会用最新数据覆盖一次。
 */
export function pushShare(tripId: string, trip: Trip, members: Member[], expenses: Expense[]): Promise<void> {
  if (!isCloudReady()) return Promise.resolve()
  return wx.cloud
    .database()
    .collection<SharedTripDoc>(COLLECTION)
    .doc(tripId)
    .update({
      data: { trip, members, expenses, updatedAt: Date.now() },
    })
    .then(() => undefined)
    .catch(() => undefined)
}
