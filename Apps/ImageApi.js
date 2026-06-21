import { createServer } from "http"
import { parse } from "url"
import { StringDecoder } from "string_decoder"
import fs from "fs/promises"
import path from "path"

const PORT = 5092
const BOT_UIN = 2984785736

let botInstance = null

export function setBotInstance(bot) {
  botInstance = bot
}

async function handleRequest(req, res) {
  const parsedUrl = parse(req.url, true)
  const path = parsedUrl.pathname
  const method = req.method

  if (method === "POST" && path === "/api/send-image") {
    const decoder = new StringDecoder("utf-8")
    let buffer = ""
    req.on("data", (data) => {
      buffer += decoder.write(data)
    })
    req.on("end", async () => {
      try {
        const data = JSON.parse(buffer)
        const { image, group_id, user_id, type = "base64" } = data

        if (!image) {
          res.writeHead(400, { "Content-Type": "application/json" })
          res.end(JSON.stringify({ ok: false, message: "缺少 image 参数" }))
          return
        }

        if (!botInstance) {
          res.writeHead(500, { "Content-Type": "application/json" })
          res.end(JSON.stringify({ ok: false, message: "Bot 实例未初始化" }))
          return
        }

        let imageUrl
        if (type === "base64") {
          if (!image.startsWith("base64://")) {
            imageUrl = `base64://${image}`
          } else {
            imageUrl = image
          }
        } else if (type === "url") {
          imageUrl = image
        } else if (type === "file") {
          const filePath = path.resolve(image)
          const buffer = await fs.readFile(filePath)
          imageUrl = `base64://${buffer.toString("base64")}`
        } else {
          res.writeHead(400, { "Content-Type": "application/json" })
          res.end(JSON.stringify({ ok: false, message: "不支持的 type 类型" }))
          return
        }

        const targetGroup = group_id || parsedUrl.query.group_id
        const targetUser = user_id || parsedUrl.query.user_id

        if (targetGroup) {
          await botInstance.pickGroup(targetGroup).sendMsg([{ type: "image", data: { file: imageUrl } }])
        } else if (targetUser) {
          await botInstance.pickFriend(targetUser).sendMsg([{ type: "image", data: { file: imageUrl } }])
        } else {
          res.writeHead(400, { "Content-Type": "application/json" })
          res.end(JSON.stringify({ ok: false, message: "缺少 group_id 或 user_id" }))
          return
        }

        res.writeHead(200, { "Content-Type": "application/json" })
        res.end(JSON.stringify({ ok: true, message: "发送成功" }))
      } catch (err) {
        res.writeHead(500, { "Content-Type": "application/json" })
        res.end(JSON.stringify({ ok: false, message: err.message }))
      }
    })
  } else if (method === "GET" && path === "/api/speakers") {
    res.writeHead(200, { "Content-Type": "application/json" })
    res.end(JSON.stringify({ ok: true, data: "Image API running" }))
  } else {
    res.writeHead(404, { "Content-Type": "application/json" })
    res.end(JSON.stringify({ ok: false, message: "Not found" }))
  }
}

const server = createServer(handleRequest)

export function startImageApi() {
  server.listen(PORT, "0.0.0.0", () => {
    console.log(`[ImageApi] HTTP API running on http://0.0.0.0:${PORT}`)
  })
}

export function stopImageApi() {
  server.close()
}