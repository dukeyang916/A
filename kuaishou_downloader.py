#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
快手视频批量下载工具（解析无水印直链）

用法示例：
    # 从文件批量下载（每行一个分享链接或分享文案）
    python3 kuaishou_downloader.py -i links.txt -o downloads

    # 直接传入一个或多个链接
    python3 kuaishou_downloader.py "https://v.kuaishou.com/xxxxxx"

    # 只解析直链、不下载
    python3 kuaishou_downloader.py -i links.txt --parse-only

说明：
    脚本从快手分享文案中提取短链，跟随重定向得到 photoId，再请求 H5 接口
    解析出视频源地址。快手 H5 接口返回的 photoUrl / mainMvUrls 通常是无水印源，
    水印一般是客户端播放时叠加的，因此下载源文件即为无水印版本。

    快手接口会不定期变动。若解析失败，可用 --debug 查看详细日志排查。
"""

from __future__ import annotations

import argparse
import concurrent.futures
import json
import os
import re
import sys
import urllib.error
import urllib.request
from dataclasses import dataclass, field
from http.cookiejar import CookieJar
from typing import Optional

# ------------------------------------------------------------------ 常量 ----

# 移动端 UA。快手 H5 接口对移动端 UA 更友好。
UA_MOBILE = (
    "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) "
    "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 "
    "Mobile/15E148 Safari/604.1"
)
UA_DESKTOP = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
)

# 从任意分享文案中抓取快手链接
LINK_RE = re.compile(
    r"https?://"
    r"(?:v\.kuaishou\.com|www\.kuaishou\.com|kuaishou\.com|"
    r"v\.m\.chenzhongtech\.com|c\.kuaishou\.com|gifshow\.com)"
    r"/[^\s，。、）)】\]\"'<>]+",
    re.IGNORECASE,
)

# 从最终 URL / HTML 中提取 photoId 的几种形态
PHOTO_ID_PATTERNS = [
    re.compile(r"/photo/([\w-]+)"),
    re.compile(r"/short-video/([\w-]+)"),
    re.compile(r"photoId=([\w-]+)"),
    re.compile(r"/fw/photo/([\w-]+)"),
]

DEBUG = False


def log(*args: object) -> None:
    print(*args, file=sys.stderr, flush=True)


def dlog(*args: object) -> None:
    if DEBUG:
        log("[debug]", *args)


# --------------------------------------------------------------- HTTP 封装 ----

def build_opener() -> urllib.request.OpenerDirector:
    """带 cookie 的 opener，自动跟随重定向。"""
    return urllib.request.build_opener(
        urllib.request.HTTPCookieProcessor(CookieJar())
    )


def http_get(
    url: str,
    *,
    mobile: bool = True,
    referer: Optional[str] = None,
    opener: Optional[urllib.request.OpenerDirector] = None,
    timeout: int = 20,
) -> tuple[int, str, str]:
    """返回 (状态码, 最终URL, 文本)。失败抛异常。"""
    opener = opener or build_opener()
    headers = {
        "User-Agent": UA_MOBILE if mobile else UA_DESKTOP,
        "Accept": "text/html,application/json,*/*",
        "Accept-Language": "zh-CN,zh;q=0.9",
    }
    if referer:
        headers["Referer"] = referer
    req = urllib.request.Request(url, headers=headers)
    with opener.open(req, timeout=timeout) as resp:
        raw = resp.read()
        charset = resp.headers.get_content_charset() or "utf-8"
        text = raw.decode(charset, errors="replace")
        return resp.status, resp.geturl(), text


def http_post_json(
    url: str,
    payload: dict,
    *,
    referer: Optional[str] = None,
    opener: Optional[urllib.request.OpenerDirector] = None,
    timeout: int = 20,
) -> dict:
    opener = opener or build_opener()
    data = json.dumps(payload).encode("utf-8")
    headers = {
        "User-Agent": UA_MOBILE,
        "Content-Type": "application/json",
        "Accept": "application/json, text/plain, */*",
        "Accept-Language": "zh-CN,zh;q=0.9",
        "Origin": "https://v.m.chenzhongtech.com",
    }
    if referer:
        headers["Referer"] = referer
    req = urllib.request.Request(url, data=data, headers=headers, method="POST")
    with opener.open(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode("utf-8", errors="replace"))


# ------------------------------------------------------------ 解析核心逻辑 ----

@dataclass
class VideoInfo:
    source: str                      # 原始输入
    photo_id: Optional[str] = None
    video_url: Optional[str] = None  # 无水印直链
    cover_url: Optional[str] = None
    caption: str = ""
    author: str = ""
    error: str = ""
    extra: dict = field(default_factory=dict)

    @property
    def ok(self) -> bool:
        return bool(self.video_url)


def extract_links(text: str) -> list[str]:
    """从一段文本中提取所有快手链接。"""
    return LINK_RE.findall(text)


def resolve_photo_id(url: str, opener) -> tuple[Optional[str], str, str]:
    """跟随重定向，返回 (photo_id, final_url, html)。"""
    html = ""
    try:
        _, final_url, html = http_get(url, mobile=True, opener=opener)
    except urllib.error.HTTPError as e:
        # 即使 4xx/5xx，重定向后的 URL 也可能带 photoId
        final_url = getattr(e, "url", url) or url
        dlog("HTTPError while resolving:", e)
    except Exception as e:  # noqa: BLE001
        final_url = url
        dlog("error while resolving:", e)
    dlog("final url:", final_url)

    for pat in PHOTO_ID_PATTERNS:
        m = pat.search(final_url)
        if m:
            return m.group(1), final_url, html
    for pat in PHOTO_ID_PATTERNS:
        m = pat.search(html)
        if m:
            return m.group(1), final_url, html
    m = re.search(r'"photoId"\s*:\s*"([\w-]+)"', html)
    if m:
        return m.group(1), final_url, html
    return None, final_url, html


def _pick(d: dict, *keys: str) -> Optional[str]:
    for k in keys:
        v = d.get(k)
        if isinstance(v, str) and v.startswith("http"):
            return v
    return None


def parse_from_html(html: str, info: VideoInfo) -> bool:
    """从 H5 页面内嵌 JSON / 标签中解析视频直链。"""
    # 1) window.__APOLLO_STATE__ / __INITIAL_STATE__
    for marker in ("__APOLLO_STATE__", "__INITIAL_STATE__", "window.INIT_STATE"):
        m = re.search(re.escape(marker) + r"\s*=\s*(\{.*?\})\s*[;<]", html, re.S)
        if not m:
            continue
        try:
            state = json.loads(m.group(1))
        except json.JSONDecodeError:
            continue
        if _walk_json_for_video(state, info):
            return True

    # 2) 直接在 HTML 里找视频 URL 字段
    for key in ("srcNoMark", "photoUrl", "mainMvUrl", "srcUrl"):
        m = re.search(r'"' + key + r'"\s*:\s*"([^"]+)"', html)
        if m:
            info.video_url = m.group(1).replace("\\u002F", "/").replace("\\/", "/")
            return True

    # 3) og:video / <video src>
    m = re.search(r'property=["\']og:video["\']\s+content=["\']([^"\']+)', html)
    if m:
        info.video_url = m.group(1)
        return True
    m = re.search(r"<video[^>]+src=[\"']([^\"']+)", html)
    if m:
        info.video_url = m.group(1)
        return True
    return False


def _walk_json_for_video(obj: object, info: VideoInfo) -> bool:
    """在任意嵌套 JSON 中寻找无水印视频地址与元信息。"""
    found = False
    if isinstance(obj, dict):
        url = _pick(obj, "srcNoMark", "photoUrl", "mainMvUrl", "srcUrl", "playUrl")
        if url and not info.video_url:
            info.video_url = url
            found = True
        cover = _pick(obj, "coverUrl", "webpCoverUrl", "poster")
        if cover and not info.cover_url:
            info.cover_url = cover
        cap = obj.get("caption") or obj.get("photoCaption")
        if isinstance(cap, str) and cap and not info.caption:
            info.caption = cap
        name = obj.get("userName") or obj.get("name")
        if isinstance(name, str) and name and not info.author:
            info.author = name
        for v in obj.values():
            found = _walk_json_for_video(v, info) or found
    elif isinstance(obj, list):
        for v in obj:
            found = _walk_json_for_video(v, info) or found
    return found


def parse_via_h5_api(photo_id: str, referer: str, opener) -> Optional[VideoInfo]:
    """调用快手 H5 GraphQL 接口解析（无水印源）。"""
    query = (
        "query visionVideoDetail($photoId: String, $type: String, $page: String, "
        "$webPageArea: String) {\n"
        "  visionVideoDetail(photoId: $photoId, type: $type, page: $page, "
        "webPageArea: $webPageArea) {\n"
        "    status\n    type\n"
        "    author { id name headerUrl }\n"
        "    photo { id caption photoUrl coverUrl mainMvUrls { url } }\n"
        "  }\n}"
    )
    payload = {
        "operationName": "visionVideoDetail",
        "variables": {"photoId": photo_id, "page": "detail"},
        "query": query,
    }
    endpoints = [
        "https://v.m.chenzhongtech.com/graphql",
        "https://www.kuaishou.com/graphql",
    ]
    info = VideoInfo(source=referer, photo_id=photo_id)
    for ep in endpoints:
        try:
            data = http_post_json(ep, payload, referer=referer, opener=opener)
            dlog("graphql resp keys:", list(data.keys()))
            detail = (data.get("data", {}) or {}).get("visionVideoDetail", {}) or {}
            photo = detail.get("photo") or {}
            mv = photo.get("mainMvUrls") or []
            url = None
            if mv and isinstance(mv, list):
                url = mv[0].get("url")
            url = url or photo.get("photoUrl")
            if url:
                info.video_url = url
                info.cover_url = photo.get("coverUrl")
                info.caption = photo.get("caption", "")
                info.author = (detail.get("author") or {}).get("name", "")
                return info
        except Exception as e:  # noqa: BLE001
            dlog("graphql endpoint failed", ep, e)
            continue
    return None


def parse_one(raw: str, opener=None) -> VideoInfo:
    """解析单条输入（分享文案或链接）为 VideoInfo。"""
    opener = opener or build_opener()
    links = extract_links(raw)
    if not links:
        return VideoInfo(source=raw, error="未在文本中找到快手链接")
    url = links[0]
    info = VideoInfo(source=url)

    photo_id, final_url, html = resolve_photo_id(url, opener)
    info.photo_id = photo_id
    info.extra["final_url"] = final_url

    # 策略 1：解析首个响应的 HTML（重定向后已拿到）
    if html and parse_from_html(html, info):
        dlog("parsed from initial html")
        return info

    # 策略 2：再抓一次最终页面并解析
    try:
        _, _, page = http_get(final_url, mobile=True, opener=opener, referer=url)
        if parse_from_html(page, info):
            dlog("parsed from final html")
            return info
    except Exception as e:  # noqa: BLE001
        dlog("html parse failed:", e)

    # 策略 3：H5 GraphQL 接口
    if photo_id:
        api_info = parse_via_h5_api(photo_id, referer=final_url, opener=opener)
        if api_info and api_info.ok:
            api_info.source = url
            return api_info

    if not info.ok:
        info.error = "解析失败：未提取到视频直链（快手接口可能已变动，可加 --debug 排查）"
    return info


# --------------------------------------------------------------- 下载逻辑 ----

def sanitize_filename(name: str, maxlen: int = 60) -> str:
    name = re.sub(r"[\\/:*?\"<>|\n\r\t]", "_", name).strip()
    name = re.sub(r"\s+", " ", name)
    return (name[:maxlen] or "kuaishou_video").strip()


def download_video(info: VideoInfo, out_dir: str, opener=None) -> Optional[str]:
    """下载无水印视频，返回保存路径。"""
    opener = opener or build_opener()
    os.makedirs(out_dir, exist_ok=True)

    base = sanitize_filename(info.caption or info.photo_id or "kuaishou_video")
    if info.photo_id and info.photo_id not in base:
        base = f"{base}_{info.photo_id}"
    path = os.path.join(out_dir, base + ".mp4")

    if os.path.exists(path) and os.path.getsize(path) > 0:
        log(f"  ↷ 已存在，跳过：{os.path.basename(path)}")
        return path

    headers = {"User-Agent": UA_MOBILE, "Referer": "https://v.m.chenzhongtech.com/"}
    req = urllib.request.Request(info.video_url, headers=headers)
    tmp = path + ".part"
    try:
        with opener.open(req, timeout=60) as resp:
            total = int(resp.headers.get("Content-Length", 0))
            done = 0
            with open(tmp, "wb") as f:
                while True:
                    chunk = resp.read(1 << 16)
                    if not chunk:
                        break
                    f.write(chunk)
                    done += len(chunk)
                    if total:
                        pct = done * 100 // total
                        print(
                            f"\r  ↓ {os.path.basename(path)}  {pct:3d}% "
                            f"({done // 1024}KB/{total // 1024}KB)",
                            end="", file=sys.stderr, flush=True,
                        )
        print("", file=sys.stderr)
        os.replace(tmp, path)
        return path
    except Exception as e:  # noqa: BLE001
        if os.path.exists(tmp):
            os.remove(tmp)
        info.error = f"下载失败：{e}"
        return None


# ----------------------------------------------------------------- 主流程 ----

def read_inputs(args: argparse.Namespace) -> list[str]:
    items: list[str] = []
    if args.input:
        if not os.path.exists(args.input):
            log(f"错误：找不到文件 {os.path.abspath(args.input)}")
            log("请先在当前目录创建该文件，每行粘贴一条快手分享链接/文案，例如：")
            log("  3.65 复制打开快手，看看【某某的作品】https://v.kuaishou.com/xxxxxx")
            sys.exit(1)
        with open(args.input, "r", encoding="utf-8-sig") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#"):
                    items.append(line)
    items.extend(args.links)
    return items


def process(raw: str, args: argparse.Namespace) -> VideoInfo:
    opener = build_opener()
    info = parse_one(raw, opener=opener)
    if not info.ok:
        return info
    if not args.parse_only:
        download_video(info, args.output, opener=opener)
    return info


def main(argv: Optional[list[str]] = None) -> int:
    global DEBUG
    parser = argparse.ArgumentParser(
        description="快手视频批量下载工具（解析无水印直链）",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument("links", nargs="*", help="一个或多个快手链接/分享文案")
    parser.add_argument("-i", "--input", help="包含链接的文本文件，每行一条")
    parser.add_argument("-o", "--output", default="downloads", help="下载目录（默认 downloads）")
    parser.add_argument("-j", "--jobs", type=int, default=3, help="并发数（默认 3）")
    parser.add_argument("--parse-only", action="store_true", help="只解析直链，不下载")
    parser.add_argument("--debug", action="store_true", help="打印调试日志")
    args = parser.parse_args(argv)
    DEBUG = args.debug

    inputs = read_inputs(args)
    if not inputs:
        parser.error("请通过参数或 -i 文件提供至少一个链接")

    log(f"共 {len(inputs)} 条待处理，输出目录：{os.path.abspath(args.output)}\n")

    results: list[VideoInfo] = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=max(1, args.jobs)) as ex:
        future_map = {ex.submit(process, raw, args): raw for raw in inputs}
        for i, fut in enumerate(concurrent.futures.as_completed(future_map), 1):
            info = fut.result()
            results.append(info)
            tag = "✔" if info.ok else "✘"
            title = info.caption or info.photo_id or info.source
            log(f"[{i}/{len(inputs)}] {tag} {title[:50]}")
            if info.error:
                log(f"        {info.error}")
            elif args.parse_only and info.video_url:
                log(f"        直链: {info.video_url}")

    ok = sum(1 for r in results if r.ok)
    log(f"\n完成：成功 {ok} / {len(results)}，失败 {len(results) - ok}")
    return 0 if ok else 1


if __name__ == "__main__":
    try:
        sys.exit(main())
    except KeyboardInterrupt:
        log("\n已取消")
        sys.exit(130)
