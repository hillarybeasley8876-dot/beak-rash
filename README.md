# 暴力鹈鹕 BEAK RASH

3D 鹈鹕骑自行车格斗竞速游戏，致敬《暴力摩托》(Road Rash)。玩家骑着鹈鹕阿鹕，和七种动物在开放公路上竞速，用翅膀和咸鱼互殴，放技能；撞废对手会触发升格慢动作；UI 走《女神异闻录5》的漫画风。名字来自 LLM 圈的老梗 "Generate an SVG of a pelican riding a bicycle"，这次是 3D 的。

A 3D pelican-on-a-bicycle combat racer in the spirit of Road Rash, with Persona 5–style UI and slow-motion knockouts.

- 在线试玩 / Play online: https://beak-rash.erapi0neer.xyz
- 技术：Vite 8 + TypeScript 7（strict）+ three.js 0.186。全部 3D 为程序化建模（没有外部模型），UI 用 DOM 实现，配乐用 WebAudio 程序化生成。

## 运行与打包

```sh
npm ci
npm run dev                       # http://localhost:5300
npm run typecheck
npm run build                     # dist/
node tools/single/build.mjs       # dist-single/暴力鹈鹕.html，单文件版，可直接发送
tools/package-desktop.sh          # desktop/build/暴力鹈鹕.app（Electron 桌面版）
tools/deploy-web.sh               # 发布到 Vercel 项目 beak-rash
```

## 目录

- `SPEC.md`：游戏设计总纲，包括玩法、手感数值、战斗与技能、KO 慢动作时间线、美术、UI、音频和梗。
- `src/`：按职责分目录，包括 sim（物理与手感）、world（赛道与环境）、actors（角色与自行车）、gameplay（战斗与比赛）、camera、fx、ui、audio、render、data。
- `src/core/`：核心契约、会话和模块加载。某个模块加载或初始化出错时，会自动换成该模块的 stub 占位实现。
- `briefs/`、`status/`、`reviews/`：每个模块的任务书、进度检查点和评审记录。
- `tools/`：检查、截图（Playwright）、打包和部署脚本。

## r4 更新（2026-10-26）

- **警察 2.0**：通缉星级 ★1–★3。柯基警官从 ★2 起会挥警棍，出手前有预警，可以刹车躲、侧闪、起跳，也能用平底锅弹反；
  它有血条，能被打到「柯基下班了」。★3 叫增援、设路障（只留一个缺口）。打铃可以「V我50」行贿，★3 时不收。
- **武器 2.0**：按住重击就是投掷，每把武器有特性：咸鱼回旋镖、法棍打落对手武器、平底锅完美格挡（当！）、大葱三连、
  雨伞滑翔、自拍杆闪光致盲、拖鞋追踪必中、机械键盘暴击。
- **空中特技 + STYLE 连段**：腾空时 Shift + 方向（转体）/ 刹车（后空翻）/ 跳（前空翻），Shift 单按是超人。
  漂移、擦肩、命中、弹反、特技、冲卡、穿鹅群都会串进 STYLE 连段，断开或超时结算成 SP 和小鱼干。
- **宿敌与围剿**：对手会记仇（存档里），积怨最深的会成为宿敌，开场亮宿敌卡，打倒它有 150 小鱼干赏金。
  你领先太多或连续击倒，身后的对手会结成围剿联盟，误伤自己人就「塑料友谊」散伙。对手也会扔武器、耍特技。
- **赛道突发事件**：鹈鹕海鲜鱼车侧翻、鹅群过马路、道路施工、路边水果摊。
- **地图**：新赛道「江南水乡」（青石板、白墙黛瓦、拱桥、河道，默认小雨）和「戈壁公路」（长直道、沙丘、风车、
  磕头机、终点沙尘暴）。每条赛道有天气变体（雨、雪、雾、黄昏），能反向骑，也能用种子生成随机路线。
  快速比赛里可以选天气、方向、路线；巡回赛变成 3 杯 × 5 站：第二杯换天气，第三杯是反向或随机路线。
- **彩蛋 9 个**（记录页「彩蛋 n/9」）和 71 个成就，大模型限定款自行车藏在 Konami 码后面。

r4 由主会话做设计、契约和验收，各单元的开发派给 MiniMax-M3.1 工人并行完成，每个任务有可执行的验收脚本
（`tools/r4/`）和任务书（`briefs/r4/`），进度检查点在 `status/r4/`。

## 状态

v1.0 于 2026-10-19 交付，包括桌面 .app、单文件 HTML 和网页版。整局验收第 2 轮的结果：美术 8、手感 8.3、性能 8、E2E 8。
r3 打磨轮（2026-10-25）补齐了 Windows 运行与打包；r4（2026-10-26）加入上面的新机制和地图。

美术和语音资源已经生成好，放在 `public/` 里。生成脚本 `tools/gen-image.mjs` 和 `tools/gen-tts.mjs` 调用的是公司内网 API，只在内网环境下能重新生成。
