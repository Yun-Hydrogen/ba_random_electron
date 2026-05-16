/*
技术文档：vite.config.js
职责：Vite + Electron 构建配置入口。

核心功能：
- 注册 Vue、Electron 主进程、预加载与渲染进程插件。
- 配置 @ 别名到 src/renderer。
- 开发态将 /api 代理到本地配置服务端口。
*/
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import electron from 'vite-plugin-electron/simple'
import renderer from 'vite-plugin-electron-renderer'
import path from 'path'

export default defineConfig({
  // Vite + Electron 主进程/预加载/渲染进程配置
  plugins: [
    vue(),
    electron({
      main: {
        entry: 'src/main/main.js',
      },
      preload: {
        input: 'src/preload/preload.js',
      },
    }),
    renderer()
  ],
  resolve: {
    // 渲染进程路径别名
    alias: {
      '@': path.resolve(__dirname, 'src/renderer')
    }
  },
  server: {
    port: 5173,
    proxy: {
      // 开发阶段将 /api 转发到本地配置服务
      '/api': {
        target: 'http://127.0.0.1:21219',
        changeOrigin: true
      }
    }
  }
})
