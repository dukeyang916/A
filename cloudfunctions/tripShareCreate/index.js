const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()

// 去掉容易看错的 0/O/1/I/L，邀请码靠人工念/输入传递
const CODE_CHARS = '23456789ABCDEFGHJKMNPQRSTUVWXYZ'

function randomCode() {
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]
  }
  return code
}

async function generateUniqueCode() {
  for (let i = 0; i < 5; i++) {
    const code = randomCode()
    const { total } = await db.collection('shared_trips').where({ shareCode: code }).count()
    if (total === 0) return code
  }
  throw new Error('邀请码生成失败，请重试')
}

// event: { tripId, trip, members, expenses } —— 把本地行程第一次上传到云端开启协作。
// 用 tripId 直接当云端文档 _id，之后 join/sync 都按这个 id 找文档，不用额外维护映射表。
// 已经开过的话直接把已有邀请码返回（幂等），不重复创建文档。
exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext()
  const { tripId, trip, members = [], expenses = [] } = event
  if (!tripId || !trip) return { error: 'missing tripId/trip' }

  const existing = await db
    .collection('shared_trips')
    .doc(tripId)
    .get()
    .catch(() => null)
  if (existing && existing.data) {
    return { shareCode: existing.data.shareCode, myOpenId: OPENID }
  }

  const shareCode = await generateUniqueCode()
  const now = Date.now()

  // 当前设备标了 isMe 的那个成员就是发起协作的人，记下 openId 方便以后识别"是不是我"
  const stampedMembers = members.map((m) => (m.isMe ? { ...m, openId: OPENID } : m))
  // trip 里也要带上 shareCode：客户端调用这个云函数时本地 trip 还没设 shareCode，
  // 云端存的这份如果不带，下次同步拉回本地会把刚设置的 shareCode 覆盖丢失
  const stampedTrip = { ...trip, shareCode, updatedAt: now }

  await db.collection('shared_trips').add({
    data: {
      _id: tripId,
      shareCode,
      ownerOpenId: OPENID,
      memberOpenIds: [OPENID],
      trip: stampedTrip,
      members: stampedMembers,
      expenses,
      updatedAt: now,
    },
  })

  return { shareCode, myOpenId: OPENID }
}
