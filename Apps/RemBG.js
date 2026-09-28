import config from "../Model/config.js"
import fs from "node:fs/promises"

const path = `plugins/TRSS-Plugin/RemBG/`
const errorTips =
  "请查看安装使用教程：\nhttps://git.trss.me/TRSS-Plugin\n并将报错通过联系方式反馈给开发者"
let model
let Running
const maxInputSize = 8 * 1024 * 1024
const maxInputDimension = 1800

export class RemBG extends plugin {
  constructor() {
    super({
      name: "图片背景去除",
      dsc: "图片背景去除",
      event: "message",
      priority: 10,
      rule: [
        {
          reg: "^#?(动漫)?(图片)?(去除?背景|背景去除?)$",
          fnc: "DetectImage",
        },
      ],
    })
  }

  async DetectImage(e) {
    if (!(await Bot.fsStat(path)) && !config.RemBG.api) {
      logger.warn(`[图片背景去除] ${path} 不存在，请检查是否正确安装`)
      return false
    }

    if (this.e.msg.match(/普通|真人|通用|u2net/i)) {
      model = "main.sh i"
    } else {
      model = "anime.sh"
    }

    let reply
    if (this.e.getReply) {
      reply = await this.e.getReply()
    } else if (this.e.source) {
      if (this.e.group?.getChatHistory)
        reply = (await this.e.group.getChatHistory(this.e.source.seq, 1)).pop()
      else if (this.e.friend?.getChatHistory)
        reply = (await this.e.friend.getChatHistory(this.e.source.time, 1)).pop()
    }
    if (reply?.message)
      for (const i of reply.message)
        if (i.type == "image" || i.type == "file") {
          this.e.img = [i.url]
          break
        }

    if (!this.e.img) {
      this.setContext("RemBG")
      await this.reply("请发送图片", true)
    } else {
      this.RemBG()
    }
  }

  async RemBG(e) {
    if (!this.e.img) {
      return false
    }

    this.finish("RemBG")
    if (Running) {
      await this.reply("正在生成，请稍等……", true)
      return false
    }
    Running = true
    await this.reply("开始生成，请稍等……", true)

    let url
    if (config.RemBG.api) {
      url = `${config.RemBG.api}?user_id=${this.e.user_id}&bot_id=${this.e.self_id}&url=${encodeURIComponent(this.e.img[0])}`
    } else {
      let ret = await Bot.download(this.e.img[0], `${path}input.png`)
      if (!ret) {
        await this.reply("下载图片错误", true)
        await this.reply(errorTips)
        Running = false
        return true
      }

      logger.mark(`[图片背景去除] 图片保存成功：${logger.blue(this.e.img[0])}`)
      ret = await Bot.exec(`command -v convert >/dev/null 2>&1 && convert '${path}input.png' -auto-orient -resize '${maxInputDimension}x${maxInputDimension}>' '${path}input.tmp.png' && mv '${path}input.tmp.png' '${path}input.png' || true`)
      if (ret.error)
        logger.warn(`[图片背景去除] 图片压缩跳过：${ret.error}`)

      try {
        const stat = await Bot.fsStat(`${path}input.png`)
        if (stat?.size > maxInputSize) {
          await this.reply(`图片过大（${(stat.size / 1024 / 1024).toFixed(1)}MB），为避免内存爆掉，请换一张小于 8MB 的图`, true)
          Running = false
          return true
        }
      } catch {}

      await fs.rm(`${path}output.png`, { force: true })
      const cmd = `bash '${path}'${model} input.png output.png`
      ret = await Bot.exec(cmd)

      if (ret.error) {
        logger.error(`图片背景去除错误：${logger.red(ret.error)}`)
        await this.reply(`图片背景去除失败：${String(ret.error).split("\n").slice(-6).join("\n")}`, true)
        Running = false
        return true
      }
      try {
        const outStat = await Bot.fsStat(`${path}output.png`)
        if (!outStat?.size) {
          await this.reply("图片背景去除失败：没有生成有效图片", true)
          Running = false
          return true
        }
      } catch {
        await this.reply("图片背景去除失败：输出文件不存在", true)
        Running = false
        return true
      }

      url = `file://${process.cwd()}/${path}output.png`
    }

    logger.mark(`[图片背景去除] 发送图片：${logger.blue(url)}`)
    Running = false
    await this.reply(segment.image(url), true)
  }
}
