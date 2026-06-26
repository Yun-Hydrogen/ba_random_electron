<template>
  <div class="tab-page">
    <!-- 服务配置 -->
    <div class="card">
      <div class="card-title">服务配置</div>
      <div v-if="showDesc" class="card-desc">Web 配置服务端口与配置文件管理</div>
      <div v-else class="card-desc-skeleton"></div>
      <div class="cfg-row">
        <label>配置端口</label>
        <input type="number" :value="webConfig.port" @input="$emit('update:webConfig',{...webConfig,port:parseInt($event.target.value)||21219})" min="1" max="65535" class="cfg-input" />
      </div>
      <div class="cfg-row">
        <label>配置文件</label>
        <div class="cfg-btn-group">
          <button class="cfg-sm-btn" @click="$emit('open-config-file')">打开文件</button>
          <button class="cfg-sm-btn" @click="$emit('open-config-dir')">打开目录</button>
        </div>
      </div>
    </div>

    <!-- Windows 系统 -->
    <div v-if="appInfo.isWindows" class="card">
      <div class="card-title">Windows 系统</div>
      <div v-if="showDesc" class="card-desc">管理员权限与 UIAccess 置顶增强</div>
      <div v-else class="card-desc-skeleton"></div>
      <div class="cfg-row">
        <label>管理员置顶</label>
        <label class="switch">
          <input type="checkbox" :checked="webConfig.adminTopmostEnabled" @change="$emit('update:webConfig',{...webConfig,adminTopmostEnabled:$event.target.checked})" />
          <span class="switch-track"></span>
        </label>
      </div>
      <div v-if="appInfo.isAdmin" class="cfg-row">
        <label>UIAccess 置顶</label>
        <label class="switch">
          <input type="checkbox" :checked="webConfig.uiAccessEnabled" @change="$emit('update:webConfig',{...webConfig,uiAccessEnabled:$event.target.checked})" />
          <span class="switch-track"></span>
        </label>
      </div>
      <div v-if="!appInfo.uiAccessDllExists && webConfig.uiAccessEnabled" class="cfg-hint warn">⚠ 未检测到 uiaccess.dll</div>
      <div class="cfg-row">
        <label>管理员重启</label>
        <button class="cfg-sm-btn" @click="$emit('admin-elevate')">以管理员身份重启</button>
      </div>
      <div class="cfg-row">
        <label>重启应用</label>
        <button class="cfg-sm-btn" @click="$emit('restart')">立即重启</button>
      </div>
    </div>

    <!-- 开机启动 -->
    <div v-if="appInfo.isWindows" class="card">
      <div class="card-title">开机启动</div>
      <div v-if="showDesc" class="card-desc">创建 Windows 计划任务，登录时以管理员权限自动启动</div>
      <div v-else class="card-desc-skeleton"></div>
      <div class="cfg-row">
        <label>EXE 路径</label>
        <input type="text" :value="webConfig.adminAutoStartPath" @input="$emit('update:webConfig',{...webConfig,adminAutoStartPath:$event.target.value})" class="cfg-input-wide" placeholder="程序路径" />
      </div>
      <div class="cfg-row">
        <label>任务名称</label>
        <input type="text" :value="webConfig.adminAutoStartTaskName" @input="$emit('update:webConfig',{...webConfig,adminAutoStartTaskName:$event.target.value})" class="cfg-input-wide" />
      </div>
      <div class="cfg-row">
        <label></label>
        <button class="cfg-sm-btn" @click="$emit('create-startup-task')">创建 / 更新计划任务</button>
      </div>
    </div>

    <!-- 更新检查 -->
    <div class="card">
      <div class="card-title">更新检查</div>
      <div v-if="showDesc" class="card-desc">从 GitHub Releases 获取最新版本信息</div>
      <div v-else class="card-desc-skeleton"></div>
      <div class="cfg-row">
        <label>检查更新</label>
        <button class="cfg-sm-btn" :disabled="updateLoading" @click="$emit('check-update')">{{ updateLoading ? '检查中…' : '立即检查' }}</button>
      </div>
      <div v-if="updateStatus" class="cfg-hint" :class="updateStatus">{{ updateTitle }}</div>
      <div v-if="updateDetail" class="update-detail-text">{{ updateDetail }}</div>
    </div>

    <!-- 关于 -->
    <div class="card">
      <div class="card-title">关于</div>
      <div class="font-credit">
        界面字体：南西新圆体 | 
        <a href="https://opensource.org/license/IPA" target="_blank" rel="noopener">IPA Font License</a>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'

const showDesc = ref(false)
onMounted(() => requestAnimationFrame(() => { showDesc.value = true }))

defineProps({
  webConfig: Object,
  appInfo: Object,
  updateLoading: Boolean,
  updateStatus: String,
  updateTitle: String,
  updateDetail: String
})
defineEmits(['update:webConfig','open-config-file','open-config-dir','admin-elevate','restart','create-startup-task','check-update'])
</script>

<style scoped>
/* === 主题色 #aa88dd === */
.tab-page { --accent: #aa88dd; animation: slide-in .3s cubic-bezier(.25,0,.25,1); }
::-webkit-scrollbar { width:6px; height:6px; }
::-webkit-scrollbar-track { background:transparent; }
::-webkit-scrollbar-thumb { background:rgba(170,136,221,0.35); border-radius:3px; }
::-webkit-scrollbar-thumb:hover { background:rgba(170,136,221,0.55); }
::-webkit-scrollbar-button { display:none; }
::-webkit-scrollbar-corner { background:transparent; }
@keyframes slide-in { from{opacity:0;transform:translateX(24px)} to{opacity:1;transform:translateX(0)} }

/* 卡片 */
.card { padding:14px 16px; margin-bottom:12px; border-radius:14px; background:#f8fafc; border:1px solid #e8ecf2; }
.card-title { font-size:14px; font-weight:700; color:#334; margin-bottom:4px; }
.card-desc { font-size:12px; color:#99a; margin-bottom:12px; line-height:1.5; }
.card-desc-skeleton { height:36px; margin-bottom:12px; border-radius:6px; background:linear-gradient(90deg,#e8ecf2 25%,#f0f2f5 50%,#e8ecf2 75%); background-size:200% 100%; animation:shimmer 1.5s infinite; }
@keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }

/* 配置行 */
.cfg-row { display:flex; align-items:center; justify-content:space-between; padding:10px 0; border-bottom:1px solid #f5f5f5; }
.cfg-row label:first-child { font-size:14px; color:#444; }
.cfg-input { width:80px; padding:4px 8px; border:1px solid #ddd; border-radius:6px; font-size:13px; text-align:center; }
.cfg-input-wide { flex:1; max-width:260px; padding:5px 10px; border:1px solid #d0d6dc; border-radius:8px; font-size:12px; font-family:inherit; outline:none; transition:border-color .2s; }
.cfg-input-wide:focus { border-color:var(--accent); }
.cfg-btn-group { display:flex; gap:6px; }
.cfg-sm-btn { padding:5px 14px; border:1px solid #d0d6dc; border-radius:999px; background:#fff; font-size:12px; cursor:pointer; font-family:inherit; color:#556; transition:all .2s; }
.cfg-sm-btn:hover { border-color:var(--accent); background:#f5f0fa; color:var(--accent); }
.cfg-sm-btn:disabled { opacity:.5; cursor:not-allowed; }
.cfg-hint { font-size:12px; color:#888; margin-top:4px; }
.cfg-hint.warn { color:#e80; }
.cfg-hint.update { color:#4a8; }
.cfg-hint.error { color:#d44; }
.update-detail-text { font-size:12px; color:#888; white-space:pre-wrap; margin-top:4px; }

/* Switch */
.switch { position:relative; display:inline-block; width:44px; height:24px; cursor:pointer; }
.switch input { opacity:0; width:0; height:0; }
.switch-track { position:absolute; inset:0; border-radius:12px; background:#ccc; transition:.2s; }
.switch-track::after { content:''; position:absolute; top:2px; left:2px; width:20px; height:20px; border-radius:50%; background:#fff; transition:.2s; }
.switch input:checked+.switch-track { background:var(--accent); }
.switch input:checked+.switch-track::after { transform:translateX(20px); }

/* 其他 */
.font-credit { font-size:12px; color:#99a; }
.font-credit a { color:var(--accent); }
</style>
