/*
技术文档：src/renderer/main.js
职责：渲染进程入口。

核心功能：
- 创建 Vue 应用并挂载路由。
- 劫持 console 输出并转发到主进程日志系统。
- 非 Electron 环境默认跳转到配置页面，便于浏览器调试。
*/
import { createApp } from 'vue'
import App from './App.vue'
import router from './router'

import './style.css'

// 将渲染进程日志转发到主进程日志面板
const logToMain = (level, text) => {
  if (window.logApi && typeof window.logApi.send === 'function') {
    window.logApi.send(level, text)
  }
}

// 统一拦截 console 输出，便于集中查看
['log', 'info', 'warn', 'error'].forEach((method) => {
  const original = console[method].bind(console)
  console[method] = (...args) => {
    const text = args.map(arg => {
      if (typeof arg === 'string') return arg
      try {
        return JSON.stringify(arg)
      } catch (_error) {
        return String(arg)
      }
    }).join(' ')
    logToMain(method === 'log' ? 'info' : method, text)
    original(...args)
  }
})

// 非 Electron 环境访问时，直接跳转到配置页面
const isElectron = window.floatingButtonApi !== undefined
  || window.pickCountApi !== undefined
  || window.pickResultApi !== undefined
  || navigator.userAgent.toLowerCase().indexOf('electron') > -1;
if (!isElectron && window.location.hash === '') {
  router.push('/config');
}

// 挂载应用
createApp(App).use(router).mount('#app')
