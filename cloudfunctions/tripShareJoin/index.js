const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()
const _ = db.command

function createMemberId() {
  return `member_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

// event: { shareCode, memberName, avatarColor }
// 加入即创建一个新成员并把当前用户的 openId 加进 memberOpenIds，之后这个用户的设备就能
// 直接用 wx.cloud 数据库的安全规则（auth.openid in memberOpenIds）读写这份行程，
// 不用每次都过云函数。已经加入过的话直接把当前快照返回，不重复创建成员。
exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext()
  const { shareCode, memberName, avatarColor } = event
  if (!shareCode) return { error: 'missing shareCode' }

  const { data } = await db.collection('shared_trips').where({ shareCode }).get()
  const doc = data[0]
  if (!doc) return { error: '邀请码不存在或已失效' }

  if (doc.memberOpenIds.includes(OPENID)) {
    const myMember = doc.members.find((m) => m.openId === OPENID)
    return {
      tripId: doc._id,
      trip: doc.trip,
      members: doc.members,
      expenses: doc.expenses,
      myMemberId: myMember ? myMember._id : undefined,
    }
  }

  if (!memberName || !memberName.trim()) return { error: 'missing memberName' }

  const now = Date.now()
  const newMember = {
    _id: createMemberId(),
    tripId: doc._id,
    name: memberName.trim(),
    avatarColor: avatarColor || '#4D96FF',
    isMe: false,
    openId: OPENID,
    createdAt: now,
  }

  await db
    .collection('shared_trips')
    .doc(doc._id)
    .update({
      data: {
        // push 的参数要传数组，传裸值在云数据库的更新指令里语义不保证等价于"插入这一个值"
        members: _.push([newMember]),
        memberOpenIds: _.push([OPENID]),
        updatedAt: now,
      },
    })

  return {
    tripId: doc._id,
    trip: doc.trip,
    members: [...doc.members, newMember],
    expenses: doc.expenses,
    myMemberId: newMember._id,
  }
}
