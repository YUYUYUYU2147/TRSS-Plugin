import config from "../Model/config.js"
import fs from "node:fs/promises"

const path = `plugins/TRSS-Plugin/Real-ESRGAN/`
const errorTips =
  "请查看安装使用教程：\nhttps://git.trss.me/TRSS-Plugin\n并将报错通过联系方式反馈给开发者"
let model
let Running

export class RealESRGAN extends plugin {
  constructor() {
    super({
      name: "图片修复",
      dsc: "图片修复",
      event: "message",
      priority: 10,
      rule: [
        {
          reg: "^#?(动漫|普通|真人|通用)?图片修复$",
          fnc: "DetectImage",
        },
      ],
    })
  }

  async DetectImage(e) {
    if (!(await Bot.fsStat(path)) && !config.RealESRGAN.api) {
      logger.warn(`[图片修复] ${path} 不存在，请检查是否正确安装`)
      return false
    }

    if (this.e.msg.match(/普通|真人|通用/i)) {
      model = "RealESRGAN_x4plus"
    } else {
      model = "RealESRGAN_x4plus_anime_6B"
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
      this.setContext("RealESRGAN")
      await this.reply("请发送图片", true)
    } else {
      this.RealESRGAN()
    }
  }

  async RealESRGAN(e) {
    if (!this.e.img) {
      return false
    }

    this.finish("RealESRGAN")
    if (Running) {
      await this.reply("正在生成，请稍等……", true)
      return false
    }
    Running = true
    await this.reply("开始生成，请稍等……", true)

    let url
    if (config.RealESRGAN.api) {
      url = `${config.RealESRGAN.api}?user_id=${this.e.user_id}&bot_id=${this.e.self_id}&fp32=True&tile=100&model_name=${model}&input=${encodeURIComponent(this.e.img[0])}`
    } else {
      let ret = await Bot.download(this.e.img[0], `${path}input.${config.RealESRGAN.format}`)
      if (!ret) {
        await this.reply("下载图片错误", true)
        await this.reply(errorTips)
        Running = false
        return true
      }

      logger.mark(`[图片修复] 图片保存成功：${logger.blue(this.e.img[0])}`)

      await fs.rm(`${path}results/input_out.${config.RealESRGAN.format}`, { force: true })
      await fs.rm(`${path}realesrgan.log`, { force: true })

      const cmd = `bash main.sh --fp32 --tile 50 -n ${model} -i input.${config.RealESRGAN.format} > realesrgan.log 2>&1`
      ret = await Bot.exec(cmd, { cwd: path, timeout: 15 * 60 * 1000, maxBuffer: 10 * 1024 * 1024 })

      if (ret.error) {
        logger.error(`图片修复错误：${logger.red(ret.error)}`)
        let log = ""
        try {
          log = await fs.readFile(`${path}realesrgan.log`, "utf-8")
        } catch (_) {}
        await this.reply(`图片修复错误：${String(log || ret.error).split("\n").slice(-8).join("\n")}`, true)
        Running = false
        return true
      }

      try {
        const stat = await Bot.fsStat(`${path}results/input_out.${config.RealESRGAN.format}`)
        if (!stat?.size) {
          await this.reply("图片修复错误：没有生成有效图片，可能图片太大或进程被系统杀掉", true)
          Running = false
          return true
        }
      } catch (_) {
        await this.reply("图片修复错误：输出文件不存在，可能图片太大或进程被系统杀掉", true)
        Running = false
        return true
      }

      url = `file://${process.cwd()}/${path}results/input_out.${config.RealESRGAN.format}`
    }

    logger.mark(`[图片修复] 发送图片：${logger.blue(url)}`)
    Running = false
    await this.reply(segment.image(url), true)
  }
}
