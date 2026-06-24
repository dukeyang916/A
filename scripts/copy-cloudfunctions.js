// uni-app 的 mp-weixin 编译流程不会自动把根目录的 cloudfunctions/ 拷进产物目录，
// 但微信开发者工具部署云函数时认的是产物目录下的 cloudfunctions/（project.config.json 里的 cloudfunctionRoot），
// 所以编译后手动补一份过去，否则开发者工具里看不到任何云函数可以部署。
const fs = require('fs')
const path = require('path')

const target = process.argv[2]
if (target !== 'dev' && target !== 'build') {
  console.error('Usage: node scripts/copy-cloudfunctions.js <dev|build>')
  process.exit(1)
}

const src = path.resolve(__dirname, '..', 'cloudfunctions')
const dest = path.resolve(__dirname, '..', 'dist', target, 'mp-weixin', 'cloudfunctions')

if (!fs.existsSync(path.dirname(dest))) {
  console.error(`跳过拷贝云函数：${path.dirname(dest)} 不存在（mp-weixin 还没编译出来）`)
  process.exit(0)
}

fs.cpSync(src, dest, { recursive: true })
console.log(`已将 cloudfunctions/ 拷贝到 ${dest}`)
