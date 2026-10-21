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

## 状态

v1.0 于 2026-10-19 交付，包括桌面 .app、单文件 HTML 和网页版。整局验收第 2 轮的结果：美术 8、手感 8.3、性能 8、E2E 8。

美术和语音资源已经生成好，放在 `public/` 里。生成脚本 `tools/gen-image.mjs` 和 `tools/gen-tts.mjs` 调用的是公司内网 API，只在内网环境下能重新生成。
