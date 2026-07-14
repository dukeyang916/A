# 快手视频批量下载工具

批量解析快手（Kuaishou）分享链接，下载**无水印**视频。纯 Python 标准库实现，无需安装任何第三方依赖。

## 原理

1. 从分享文案中用正则提取快手短链（`v.kuaishou.com/...` 等）。
2. 跟随 HTTP 重定向，从最终 URL / 页面中解析出 `photoId`。
3. 依次尝试三种解析策略拿到视频**源地址**：
   - 解析 H5 页面内嵌的 `__APOLLO_STATE__` / `__INITIAL_STATE__` JSON；
   - 匹配页面中的 `photoUrl` / `srcNoMark` 等字段；
   - 调用快手 H5 GraphQL 接口 `visionVideoDetail`。
4. 并发下载视频源文件。

> 快手的水印通常是 App 端播放时叠加的，视频源文件本身不含水印，因此下载源地址即得到无水印版本。

## 环境要求

- Python 3.8+（推荐 3.10+）
- 无需 `pip install`，仅用标准库

## 用法

```bash
# 1) 直接传链接（可传多个）
python3 kuaishou_downloader.py "https://v.kuaishou.com/xxxxxx"

# 2) 从文件批量下载（每行一条，可直接粘贴整段分享文案）
python3 kuaishou_downloader.py -i links.txt -o downloads

# 3) 只解析直链，不下载（打印每条视频的真实地址）
python3 kuaishou_downloader.py -i links.txt --parse-only

# 4) 调整并发数
python3 kuaishou_downloader.py -i links.txt -j 5

# 5) 解析失败时排查
python3 kuaishou_downloader.py "分享文案..." --debug
```

### 参数说明

| 参数 | 说明 | 默认值 |
| --- | --- | --- |
| `links` | 一个或多个链接 / 分享文案（位置参数） | — |
| `-i, --input` | 链接文件，每行一条，`#` 开头为注释 | — |
| `-o, --output` | 下载目录 | `downloads` |
| `-j, --jobs` | 并发下载数 | `3` |
| `--parse-only` | 只解析直链不下载 | 关闭 |
| `--debug` | 打印调试日志 | 关闭 |

### 输入文件示例

见 `links.example.txt`，可复制为 `links.txt` 后填入自己的链接：

```text
# 每行一条，支持直接粘贴分享文案
3.65 复制打开快手，看看【作者的作品】https://v.kuaishou.com/yyyyyy
https://v.kuaishou.com/xxxxxx
```

## 输出

- 视频保存为 `下载目录/<视频标题>_<photoId>.mp4`；
- 已存在的文件会自动跳过（断点续传友好）；
- 结束时打印成功 / 失败统计。

## 常见问题

- **解析失败**：快手接口会不定期调整，加 `--debug` 查看中间结果；多数情况是 `photoId` 未取到或接口返回结构变化，可按日志更新解析逻辑。
- **下载 403**：脚本已带 `Referer` 与移动端 UA；若仍被拒，可能是直链带时效签名过期，重新解析即可。
- **风控 / 需要登录**：部分私密或受限作品无法通过公开接口解析。

## 免责声明

本工具仅供学习与个人备份用途。请遵守快手平台的用户协议及相关法律法规，尊重原作者版权，切勿用于商业用途或侵犯他人权益。
