/*
技术文档：src/renderer/router/index.js
职责：渲染进程路由定义。

核心功能：
- 声明 Floating / PickCount / PickResult / WebConfig 页面路由。
- 使用 HashHistory 兼容 Electron file:// 场景。
*/
import { createRouter, createWebHashHistory } from 'vue-router'

import Floating from '../views/Floating.vue'
import PickCount from '../views/PickCount.vue'
import PickResult from '../views/PickResult.vue'
import WebConfig from '../views/WebConfig.vue'

// 视图路由表
const routes = [
  { path: '/', component: Floating },
  { path: '/pick-count', component: PickCount },
  { path: '/pick-result', component: PickResult },
  { path: '/config', component: WebConfig }
]

// 使用 Hash 路由以兼容本地文件访问
const router = createRouter({
  history: createWebHashHistory(),
  routes
})

export default router
