import config from "../Model/config.js"
import fs from 'fs/promises'

let Character
try {
  Character = (await import("../../miao-plugin/models/index.js")).Character
} catch (err) {}

const GenshinVoicePath = "plugins/TRSS-Plugin/GenshinVoice/"
const ChatWaifuPath = "plugins/TRSS-Plugin/ChatWaifu/"
const vitsApiBase = "http://127.0.0.1:5091"

const GenshinVoiceSpeakers = [
  "派蒙", "凯亚", "安柏", "丽莎", "琴", "香菱", "枫原万叶", "迪卢克", "温迪", "可莉",
  "早柚", "托马", "芭芭拉", "优菈", "云堇", "钟离", "魈", "凝光", "雷电将军", "北斗",
  "甘雨", "七七", "刻晴", "神里绫华", "戴因斯雷布", "雷泽", "神里绫人", "罗莎莉亚",
  "阿贝多", "八重神子", "宵宫", "荒泷一斗", "九条裟罗", "夜兰", "珊瑚宫心海", "五郎",
  "散兵", "女士", "达达利亚", "莫娜", "班尼特", "申鹤", "行秋", "烟绯", "久岐忍",
  "辛焱", "砂糖", "胡桃", "重云", "菲谢尔", "诺艾尔", "迪奥娜", "鹿野院平藏",
]
const ChatWaifuSpeakers = [
  "綾地寧々", "在原七海", "小茸", "唐乐吟",
  "綾地寧々J", "因幡めぐるJ", "朝武芳乃J", "常陸茉子J", "ムラサメJ", "鞍馬小春J", "在原七海J",
  "綾地寧々H", "因幡めぐるH", "朝武芳乃H", "常陸茉子H", "ムラサメH", "鞍馬小春H", "在原七海H",
]

async function apiTts(speaker, text) {
  const synthRes = await fetch(`${vitsApiBase}/api/synthesize`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ speaker, text })
  })
  if (!synthRes.ok) throw new Error(`API合成失败: ${synthRes.status}`)
  const synthData = await synthRes.json()
  if (!synthData.ok) throw new Error(`API合成错误: ${synthData.message || '未知'}`)

  const audioUrl = `${vitsApiBase}${synthData.data.audioUrl}`
  const audioRes = await fetch(audioUrl)
  if (!audioRes.ok) throw new Error(`获取音频失败: ${audioRes.status}`)
  const rawBuf = Buffer.from(await audioRes.arrayBuffer())

  const tmpIn = `/tmp/voice-${Date.now()}-raw.wav`
  const tmpOut = `/tmp/voice-${Date.now()}.wav`
  await fs.writeFile(tmpIn, rawBuf)
  await Bot.exec(`ffmpeg -y -i "${tmpIn}" -acodec pcm_s16le -ar 24000 -ac 1 "${tmpOut}"`, { timeout: 10000 })
  await fs.unlink(tmpIn).catch(() => {})
  const buf = await fs.readFile(tmpOut)
  await fs.unlink(tmpOut).catch(() => {})
  return `base64://${buf.toString('base64')}`
}

let Running

export class Voice extends plugin {
  constructor() {
    super({
      name: "语音合成",
      dsc: "语音合成",
      event: "message",
      priority: 10,
      rule: [
        { reg: "^[^说]+说.+", fnc: "Voice", log: false },
        { reg: "#?语音(合成)?(角色)?列表$", fnc: "VoiceList" },
      ],
    })
  }

  async Voice() {
    const msg = this.e.msg.split("说")
    let speaker = msg.shift()
    const text = msg.join("说").replace("'", "").trim()

    if (GenshinVoiceSpeakers.indexOf(speaker) == -1) {
      if (Character) {
        const role = Character.get(speaker)
        if (role?.name) speaker = role.name
      }
      if (GenshinVoiceSpeakers.indexOf(speaker) == -1) {
        logger.debug(`[语音合成] 不存在该角色：${logger.yellow(speaker)}`)
        return false
      }
    }

    logger.mark(`[语音合成] ${logger.blue(speaker)} 说 ${logger.cyan(text)}`)

    if (Running) {
      await this.reply("正在生成，请稍等……", true)
      return false
    }
    Running = true

    try {
      const url = await apiTts(speaker, text)
      await this.reply(segment.record(url))
      logger.mark(`[语音合成] 发送成功`)
    } catch (err) {
      logger.error(`[语音合成] 失败：${logger.red(err.message)}`)
      await this.reply(`语音合成失败：${err.message}`, true)
    } finally {
      Running = false
    }
  }

  async VoiceList() {
    await this.reply(
      await Bot.makeForwardArray([
        "TRSS-Plugin 语音合成角色列表",
        "https://git.trss.me/TRSS-Plugin",
        GenshinVoiceSpeakers.join("\n"),
        ChatWaifuSpeakers.join("\n"),
      ]),
    )
  }
}
