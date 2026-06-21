import { startImageApi, stopImageApi, setBotInstance } from "./ImageApi.js"

export class ImageApiMain extends plugin {
  constructor() {
    super({
      name: "图片发送API",
      dsc: "提供HTTP API发送图片",
      event: "message",
      priority: 1000,
      rule: [
        {
          reg: "^#图片API状态$",
          fnc: "status",
        },
        {
          reg: "^#图片API重启$",
          fnc: "restart",
          permission: "master",
        },
      ],
    })
  }

  async onLoad() {
    setBotInstance(this.bot)
    startImageApi()
    logger.mark("[ImageApi] 图片发送API已启动")
  }

  async onUnload() {
    stopImageApi()
    logger.mark("[ImageApi] 图片发送API已停止")
  }

  async status() {
    await this.reply("图片发送API运行中\n端口: 5092\n接口:\nPOST /api/send-image\nGET /api/speakers")
  }

  async restart() {
    stopImageApi()
    startImageApi()
    await this.reply("图片发送API已重启")
  }
}