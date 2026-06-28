<center>
<img src='/public/image/BlueRandom.png'>

# Blue Random | 蔚蓝点名
</center>

------

## 项目简介 ✨
蔚蓝点名 是一款基于 Electron + Vue 3 的随机点名工具，灵感来源于 **《蔚蓝档案(Blue Archive)》** 的 ~~九蓝一金~~ 学生招募。

## 功能特性 🎯
- 🪟 悬浮按钮快速抽取
- 👥 1-10抽自定义配置
- ✉️ ~~不那么~~仿《蔚蓝档案》的抽奖动画
- 📋 快捷名单与权重管理
- 🔁 允许/禁止重复抽取开关
- ⚙️ RizUI风格的配置面板（？）~~仿照Rizline设计的UI风格~~

## 快速开箱 📦
- 前往 [Github Actions](https://github.com/Yun-Hydrogen/ba_random_electron/actions) 下载 最新构建，或在 [Github Releases](https://github.com/Yun-Hydrogen/ba_random_electron/releases) 获取手正式版。
- 解压后运行可执行文件，在托盘区域找到 Blue Random 的托盘图标并右键，点击 `配置` 将跳转到 Web 配置界面。
- 导入学生名单，并调整偏好设置。
- 开始尽情享受~~抽卡~~吧!

## 项目目录结构 📁
- `public/`  静态资源（图片、音效）
- `src/main/`  Electron 主进程
- `src/preload/`  预加载与 IPC 桥接
- `src/renderer/`  前端渲染与页面
- 构建完成后，在 `dist/` 目录中可找到 zip 产物与打包目录

## 贡献 🤝
欢迎提交 Issue 和 PR！
- **Bug 或建议**：请先在 Issue 中描述复现步骤与期望行为
- **新功能**：建议先开 Issue 讨论方向与实现
- **代码提交**：保持风格一致，必要时补充截图/录屏



## 说明 🧠
- **本项目大部分由 AI 生成与改写。作者对 Electron 与 Vue 开发几乎不熟悉，如有不完善之处，欢迎指正与贡献改进。**
- **本项目采用了部分第三方美术资源，项目作者并没有获得授权，如造成侵权请联系删除。**

## UIAccess 增强置顶 ✅
- UIAccess 置顶增强为可选功能，默认关闭，可根据需要启动。
- 启用该功能可能触发安全软件告警，项目作者对其使用方式与后果不承担责任。

## 许可证 📄
- 除项目 **/public/** 下的图片和音乐资源，项目使用 **AGPLv3** 许可证。
- 项目 **/public/** 下的图片和音乐资源由各自版权方所有，使用时请注意授权和范围。
- Uiaccess.dll 来自 [RunUIAccess](https://github.com/shc0743/RunUIAccess) ，使用 MIT 协议 [License](/THIRD_PARTY_NOTICES/RunUIAccess-MIT.txt)

## 感谢 💕
- 《蔚蓝档案(Blue Archive)》游戏提供的灵感：
[国服 《蔚蓝档案》](https://bluearchive-cn.com/)  
[国际服 Blue Archive](https://bluearchive.nexon.com/home)

- 抽取背景音乐 **KARUT** 的 **《Connected Sky》**。

- [RunUIAccess](https://github.com/shc0743/RunUIAccess)