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

/** 把本地行程第一次上传到云端开启协作，返回邀请码；已经开过的话云函数会原样把已有邀请码返回 */
export function createShare(trip: Trip, members: Member[], expenses: Expense[]): Promise<string> {
  return callCloudFunction<{ shareCode: string }>(
    'tripShareCreate',
    { tripId: trip._id, trip, members, expenses },
    NOT_SUPPORTED_ERROR
  ).then((res) => res.shareCode)
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
 * 把本地最新状态整份覆盖写回云端。memberOpenIds 直接从当前 members 里有 openId 的那些人
 * 派生，不单独维护：谁被移出了 members，谁的云端读写权限就自然跟着收回。
 * 失败静默吞掉——这只是本地写入成功之后的"顺便同步一下"，不该让本地操作显示失败，
 * 下次任意一端 pull 或者下次再 push 时会用最新数据覆盖一次。
 */
export function pushShare(tripId: string, trip: Trip, members: Member[], expenses: Expense[]): Promise<void> {
  if (!isCloudReady()) return Promise.resolve()
  const memberOpenIds = members.filter((m) => m.openId).map((m) => m.openId as string)
  return wx.cloud
    .database()
    .collection<SharedTripDoc & { memberOpenIds: string[] }>(COLLECTION)
    .doc(tripId)
    .update({
      data: { trip, members, expenses, memberOpenIds, updatedAt: Date.now() },
    })
    .then(() => undefined)
    .catch(() => undefined)
}
