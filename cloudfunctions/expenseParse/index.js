const tencentcloud = require('tencentcloud-sdk-nodejs-hunyuan')

const HunyuanClient = tencentcloud.hunyuan.v20230901.Client

function buildClient() {
  return new HunyuanClient({
    credential: {
      secretId: process.env.TENCENTCLOUD_SECRET_ID,
      secretKey: process.env.TENCENTCLOUD_SECRET_KEY,
    },
    region: process.env.TENCENTCLOUD_REGION || 'ap-guangzhou',
    profile: {
      httpProfile: {
        endpoint: 'hunyuan.tencentcloudapi.com',
      },
    },
  })
}

function buildPrompt(text, members, categories) {
  const memberList = members.map((m) => `${m.id}:${m.name}${m.isMe ? '(我)' : ''}`).join('、')
  const categoryList = categories.map((c) => c.value).join('、')
  return [
    '你是一个记账助手，把一句话记账描述解析成结构化 JSON，只输出 JSON，不要任何解释文字、不要 markdown 代码块。',
    `JSON 字段：amount(数字，单位元)、category(只能是这些值之一：${categoryList})、note(简短备注，字符串)、payerMemberId(从下面成员里选一个 id，不确定就填 null)。`,
    `成员列表：${memberList}`,
    `用户输入：${text}`,
    '示例输出：{"amount":35,"category":"transport","note":"打车","payerMemberId":"member_xxx"}',
  ].join('\n')
}

function safeParseJson(content) {
  const cleaned = content.replace(/```json|```/g, '').trim()
  try {
    return JSON.parse(cleaned)
  } catch {
    return null
  }
}

// event: { text, members: {id,name,isMe}[], categories: {value,label}[] }
// 语音识别出的文本、拍照 OCR 出的小票原文、聊天框直接输入的文字，都走这一个函数统一解析，
// 三种录入方式只是"怎么拿到 text"的方式不同，理解 text 的逻辑只写一份。
exports.main = async (event) => {
  const { text, members = [], categories = [] } = event
  if (!text) return { error: 'missing text' }

  const client = buildClient()
  const resp = await client.ChatCompletions({
    Model: 'hunyuan-lite',
    Stream: false,
    Messages: [{ Role: 'user', Content: buildPrompt(text, members, categories) }],
  })

  const content = resp.Choices?.[0]?.Message?.Content || ''
  const parsed = safeParseJson(content)
  if (!parsed) return { error: 'parse failed', raw: content }

  const validCategory = categories.some((c) => c.value === parsed.category)
  const validPayer = members.some((m) => m.id === parsed.payerMemberId)

  return {
    amount: typeof parsed.amount === 'number' && parsed.amount > 0 ? parsed.amount : undefined,
    category: validCategory ? parsed.category : 'other',
    note: typeof parsed.note === 'string' ? parsed.note : undefined,
    payerMemberId: validPayer ? parsed.payerMemberId : undefined,
  }
}
