// 核心领域模型。字段命名和粒度要为 v2(目的地消费统计) / v3(行程公开变现)
// 预留，即使 v1 不做对应 UI，存储时也按这个结构落地，避免日后迁移数据。

/** 支出分类：固定枚举，不用自由文本，方便未来做聚合统计 */
export type ExpenseCategory =
  | 'transport' // 交通
  | 'lodging' // 住宿
  | 'food' // 餐饮
  | 'ticket' // 门票/娱乐
  | 'shopping' // 购物
  | 'other' // 其他

/** 分账方式 */
export type SplitMethod =
  | 'equal' // 均摊
  | 'percentage' // 按比例
  | 'shares' // 按份数(权重)
  | 'amount' // 自定义金额

/** 录入来源：用于统计各录入方式的使用占比，指导后续迭代优先级 */
export type ExpenseSource = 'manual' | 'voice' | 'photo' | 'ai_chat'

export interface Destination {
  /** 城市/地区展示名，如"成都" */
  name: string
  /** 标准城市编码，预留给地图/统计类目对齐用，v1 可为空 */
  code?: string
}

export interface Trip {
  _id: string
  name: string
  destination: Destination
  /** ISO 日期字符串 YYYY-MM-DD */
  startDate: string
  endDate: string
  coverImage?: string
  /** v1 固定 'CNY'，先不做多币种 */
  currency: string
  creatorId: string
  /** 是否允许行程数据被匿名聚合/公开展示，默认 false，v1 不开放设置入口 */
  isPublic: boolean
  isArchived: boolean
  createdAt: number
  updatedAt: number
}

export interface Member {
  _id: string
  tripId: string
  name: string
  /** 头像：v1 用随机色块+取名字首字符，不接微信好友头像 */
  avatarColor: string
  /** 是否是创建本行程、当前操作设备上的"我" */
  isMe: boolean
  createdAt: number
}

/** 某一笔支出中，某个成员分摊到的金额 */
export interface ExpenseSplit {
  memberId: string
  /**
   * 输入值：均摊时不需要；按比例时是百分比(0-100)；
   * 按份数时是份数(如 1/2/3)；自定义金额时是金额本身。
   */
  inputValue?: number
  /** 计算后该成员实际分摊的金额，结算时直接用这个，不重复计算 */
  amount: number
}

export interface Expense {
  _id: string
  tripId: string
  amount: number
  payerId: string
  category: ExpenseCategory
  note?: string
  splitMethod: SplitMethod
  splits: ExpenseSplit[]
  source: ExpenseSource
  /** 消费实际发生时间，可能早于记录时间 */
  occurredAt: number
  createdAt: number
  updatedAt: number
}

export interface Balance {
  memberId: string
  /** 正数 = 应收，负数 = 应付，0 = 已平 */
  net: number
}

export interface Transfer {
  fromMemberId: string
  toMemberId: string
  amount: number
}

export interface SettlementResult {
  balances: Balance[]
  transfers: Transfer[]
}
