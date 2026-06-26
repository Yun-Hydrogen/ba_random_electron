<!--
  组件：TabRoster.vue
  所属：配置面板 - 名单管理 Tab
  父组件：ConfigPanel.vue（通过 props 传入数据，通过 emit 传出修改）

  功能概述：
    1. 名单导入 —— 支持手动输入（每行一个名字）或上传 txt/csv 文件
    2. 芯片预览 —— 右侧实时显示已添加的学生，点击可跳转到权重列表
    3. 权重管理 —— 每位学生独立滑条调节权重 0~5，自动计算概率百分比
    4. 单轮重复抽取开关 —— 控制同一轮次是否允许抽到同一人

  数据流：
    父组件 ConfigPanel 持有全局配置对象 draft
    本组件通过 props.studentList 和 props.allowRepeatDraw 接收数据
    修改时通过 emit('update:studentList', newList) 把新数据传回父组件
    父组件收到后更新 draft.studentList，再通过 props 流回本组件（单向数据流）

  注意事项：
    - 名单文本(textarea)和 studentList 数组之间需要双向同步，但要避免死循环
      用 syncingFromList 标志位区分"用户正在输入"和"外部数据变更"
    - 权重滑条 0~5 步长 0.1，重量滑条有轨道填充效果(rangeFill)
    - 芯片 tooltip 通过 emit('chip-hover'/'chip-leave') 通知父组件的全局 tooltip
    - LCP 优化：描述文字(card-desc)延迟一个动画帧渲染
-->

<template>
  <div class="tab-page">
    <!-- 名单导入 -->
    <div class="card">
      <div class="card-title">名单导入</div>
      <div v-if="showDesc" class="card-desc">导入 txt/csv 文件或粘贴名单于输入框中（每行一名同学）</div>
      <div v-else class="card-desc-skeleton"></div>
      <div class="import-capsule">
        <label class="upload-btn">
          <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17,8 12,3 7,8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
          导入文件
          <input type="file" accept=".txt,.csv" @change="handleFileUpload" style="display:none" />
        </label>
        <span class="import-hint">老师可以点击左侧按钮导入txt/csv名单哦~</span>
        <span class="count-badge"> 人数:{{ studentList.length }} </span>
      </div>
      <div class="roster-layout">
        <div class="roster-left">
          <textarea
            v-model="rawListText"
            class="roster-textarea"
            placeholder="每行一个姓名&#10;例如：&#10;早濑优香&#10;小鸟游星野&#10;空崎日奈"
            @input="syncTextToList"
          ></textarea>
        </div>
        <div class="roster-right">
          <div v-if="studentList.length === 0" class="chip-empty-hint">左侧输入姓名后<br>这里会显示学生芯片</div>
          <div v-else class="name-chip-grid">
            <span
              v-for="(s, i) in studentList"
              :key="i"
              class="name-chip"
              @click="scrollToStudent(i)"
              @mouseenter="$emit('chip-hover', $event, s)"
              @mouseleave="$emit('chip-leave')"
            >{{ s.name }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 权重管理 -->
    <div class="card">
      <div class="card-title">权重管理</div>
      <div v-if="showDesc" class="card-desc">调整每位同学的抽取权重（越高越容易被抽到）以及重复抽取规则</div>
      <div v-else class="card-desc-skeleton"></div>
      <div class="weight-head-row">
        <label class="inline-check">
          <input type="checkbox" :checked="allowRepeatDraw" @change="$emit('update:allowRepeatDraw', ($event.target).checked)" />
          单轮抽取中允许重复结果
        </label>
        <button class="roster-reset" @click="resetWeights">重置全部权重</button>
      </div>
      <div v-if="studentList.length === 0" class="empty-tip">
        <img src="/image/Arona_Empty.png" alt="Arona Empty" class="empty-arona-img" />
        <p>暂无名单，请先导入</p>
      </div>
      <div v-else class="student-table-wrap">
        <div class="roster-list">
          <div
            v-for="(s, i) in studentList"
            :key="i"
            class="roster-item"
            :ref="el => { if (el) studentRefs[i] = el }"
          >
            <span class="roster-name">{{ s.name }}</span>
            <div class="roster-weight">
              <input type="range" min="0" max="5" step="0.1" :value="s.weight" @input="setWeight(i, $event)" class="weight-slider" :style="rangeFill(s.weight,0,5)" />
              <span class="weight-val">{{ s.weight.toFixed(1) }}</span>
              <span class="weight-prob">{{ studentProb(s) }}</span>
            </div>
            <button class="roster-del" @click="removeStudent(i)">✕</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
/*
 *  组件逻辑概览（按代码顺序）：
 *  1. props / emit  —— 与父组件通信的接口
 *  2. 名单文本同步  —— textarea  ←→  studentList 数组 双向转换
 *  3. 文件导入      —— 读取用户选择的 txt/csv 文件
 *  4. 权重操作      —— 单个修改 / 删除学生 / 批量重置 / 概率计算
 *  5. 滑条轨道填充  —— 计算已滑动区域的渐变色
 *  6. 延迟渲染      —— LCP 优化：card-desc 晚一帧显示
 *  7. 数据监听      —— 外部数据变化时自动回填 textarea
 *  8. 芯片点击跳转  —— 点击芯片滚动到权重列表对应行并高亮
 */
import { ref, computed, watch, onMounted } from 'vue'

/*
 *  props：父组件传入的数据
 *  studentList    - 学生数组，每项 { name: string, weight: number }
 *  allowRepeatDraw - 是否允许同一轮抽到同一人
 */
const props = defineProps({
  studentList: { type: Array, required: true },
  allowRepeatDraw: { type: Boolean, default: true }
})

/*
 *  emit：向父组件发送数据变更事件
 *  update:studentList   - 学生数组发生变化（增/删/改权重）
 *  update:allowRepeatDraw - 重复抽取开关变化
 *  chip-hover / chip-leave - 鼠标悬停/离开芯片（父组件显示全局 tooltip）
 */
const emit = defineEmits(['update:studentList', 'update:allowRepeatDraw', 'chip-hover', 'chip-leave'])

// ================================================================
//  1. 名单文本同步：textarea 的原始文本 ←→ 结构化 studentList 数组
// ================================================================

// textarea 中显示的原始文本（每行一个名字）
const rawListText = ref('')

/*
 *  syncingFromList 标志位 —— 防止死循环的关键
 *  当用户在 textarea 中输入文字时，syncTextToList 会 emit 新的 studentList
 *  父组件收到后更新 props.studentList，触发 watch，watch 又会调用 syncListToText
 *  如果不加标志位，syncListToText 会覆盖用户正在编辑的文本，造成输入跳动
 *  解决：syncTextToList 开始时置 true，用 setTimeout(0) 在事件循环末尾重置
 *  watch 检测到 syncingFromList===true 时跳过，不执行 syncListToText
 */
let syncingFromList = false

/*
 *  把 textarea 文本解析成学生数组，并通知父组件
 *  解析规则：先按换行分割，每行再按逗号分割，去空白、去重
 *  保留已有学生的权重值（通过 name 匹配），新学生默认 weight=1.0
 */
function syncTextToList() {
  syncingFromList = true
  const names = rawListText.value.split(/[\r\n]+/).flatMap(l => l.split(',')).map(n => n.trim()).filter(Boolean)
  const unique = [...new Set(names)]
  const existing = new Map(props.studentList.map(s => [s.name, s.weight]))
  emit('update:studentList', unique.map(name => ({ name, weight: existing.get(name) ?? 1.0 })))
  setTimeout(() => { syncingFromList = false }, 0)
}

/*
 *  把学生数组转回 textarea 文本（每行一个名字）
 *  调用时机：外部数据变化时（watch 触发）、删除学生后
 */
function syncListToText() {
  rawListText.value = props.studentList.map(s => s.name).join('\n')
}

// ================================================================
//  2. 文件导入：读取用户选择的 txt/csv 文件
// ================================================================

/*
 *  处理文件选择器的 change 事件
 *  用 FileReader 读取文件内容，填入 textarea，触发同步
 *  注意：读取完成后要把 input.value 清空，否则再次选择同一文件不会触发 change
 */
function handleFileUpload(e) {
  const file = e.target.files[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = ev => {
    rawListText.value = ev.target.result.split(/[\r\n]+/).map(l => l.trim()).filter(Boolean).join('\n')
    syncTextToList()
    e.target.value = ''
  }
  reader.readAsText(file, 'utf-8')
}

// ================================================================
//  3. 权重操作：增删改查
// ================================================================

/*
 *  修改单个学生的权重值
 *  参数 i: 学生在数组中的索引
 *  参数 e: input 事件对象，e.target.value 是滑条的当前值
 *  注意：必须创建新数组再 emit，Vue 的响应式依赖引用变化
 */
function setWeight(i, e) {
  const list = [...props.studentList]
  list[i] = { ...list[i], weight: parseFloat(e.target.value) }
  emit('update:studentList', list)
}

/*
 *  删除指定索引的学生
 *  同时调用 syncListToText 更新 textarea，保持文本框与数组一致
 */
function removeStudent(i) {
  const list = [...props.studentList]
  list.splice(i, 1)
  emit('update:studentList', list)
  syncListToText()
}

/*
 *  将所有学生权重重置为 1.0
 */
function resetWeights() {
  emit('update:studentList', props.studentList.map(s => ({ ...s, weight: 1.0 })))
}

// ================================================================
//  4. 概率计算 & 滑条轨道填充
// ================================================================

/*
 *  计算所有学生权重的总和（响应式计算属性，任一学生权重变化时自动重算）
 */
const totalWeight = computed(() => props.studentList.reduce((sum, s) => sum + (s.weight || 0), 0))

/*
 *  计算单个学生在单次抽取中的被抽中概率
 *  公式：该学生权重 ÷ 总权重 × 100%
 *  返回格式：保留两位小数的百分比字符串，如 "12.50%"
 *  边界处理：总权重为 0 或该学生权重为 0 时返回 "0.00%"
 */
function studentProb(s) {
  const tw = totalWeight.value
  if (!tw || !s.weight) return '0.00%'
  return ((s.weight / tw) * 100).toFixed(2) + '%'
}

/*
 *  计算滑条已填充部分的 CSS 渐变样式
 *  参数 val: 滑条当前值, min: 最小值, max: 最大值
 *  返回：{ background: 'linear-gradient(...)' } 可直接绑定到 :style
 *  效果：已滑动区域显示主题色 #66ccff，未滑动区域灰色 #e0e5ea
 */
function rangeFill(val, min, max) {
  const pct = ((val - min) / (max - min)) * 100
  return { background: `linear-gradient(to right, #66ccff 0%, #66ccff ${pct}%, #e0e5ea ${pct}%, #e0e5ea 100%)` }
}

// ================================================================
//  5. LCP 优化：延迟渲染描述文字
// ================================================================

/*
 *  showDesc 控制 card-desc 的显示时机
 *  初始 false → 显示骨架占位 → requestAnimationFrame 后变 true → 显示真实文字
 *  作用：让标题和表单控件先绘制，描述文字晚一帧出现，降低 LCP 指标
 */
const showDesc = ref(false)
onMounted(() => requestAnimationFrame(() => { showDesc.value = true }))

// ================================================================
//  6. 数据监听：外部数据变化时自动同步 textarea
// ================================================================

/*
 *  监听 props.studentList 的变化
 *  immediate: true  → 组件首次挂载时立即执行一次（加载已保存的配置）
 *  deep: true      → 监听数组内部元素的变化（权重值改变也算）
 *  syncingFromList  → 如果是用户输入触发的变更则跳过，避免死循环
 */
watch(() => props.studentList, () => {
  if (!syncingFromList) syncListToText()
}, { immediate: true, deep: true })

// ================================================================
//  7. 芯片点击跳转：点击芯片 → 滚动到权重列表对应行
// ================================================================

/*
 *  studentRefs 存储每个 roster-item DOM 元素的引用
 *  通过模板中的 :ref="el => { if (el) studentRefs[i] = el }" 填充
 *  键为数组索引，值为对应的 DOM 元素
 */
const studentRefs = {}

/*
 *  点击芯片后平滑滚动到对应学生的权重行
 *  同时将该行背景高亮为 #66ccff，1.2 秒后恢复
 *  注意：如果该学生行内有权重概率显示(.weight-prob)，高亮时文字改为白色以确保可读性
 */
function scrollToStudent(i) {
  const el = studentRefs[i]
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    const probEl = el.querySelector('.weight-prob')
    el.style.background = '#66ccffbb'
    if (probEl) probEl.style.color = '#fff'
    setTimeout(() => {
      el.style.background = ''
      if (probEl) probEl.style.color = ''
    }, 1200)
  }
}
</script>

<style scoped>
/*
 *  本组件完整样式表
 *  主题色：天依蓝 #66ccff
 *  所有颜色硬编码，不依赖外部 CSS 变量（除 --accent 用于部分控件）
 */

/* ===== 主题色 & 全局 ===== */
.tab-page {
  --accent: #66ccff;
  animation: slide-in 0.3s cubic-bezier(0.25, 0, 0.25, 1);
}
@keyframes slide-in {
  from { opacity: 0; transform: translateX(24px); }
  to   { opacity: 1; transform: translateX(0); }
}

/* ===== 滚动条（主题色） ===== */
::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}
::-webkit-scrollbar-track {
  background: transparent;
}
::-webkit-scrollbar-thumb {
  background: rgba(102, 204, 255, 0.35);
  border-radius: 3px;
}
::-webkit-scrollbar-thumb:hover {
  background: rgba(102, 204, 255, 0.55);
}
::-webkit-scrollbar-button {
  display: none;
}
::-webkit-scrollbar-corner {
  background: transparent;
}

/* ===== 卡片（通用容器） ===== */
.card {
  padding: 14px 16px;
  margin-bottom: 12px;
  border-radius: 14px;
  background: #f8fafc;
  border: 1px solid #e8ecf2;
}
.card-title {
  font-size: 14px;
  font-weight: 700;
  color: #334;
  margin-bottom: 4px;
}
.card-desc {
  font-size: 12px;
  color: #99a;
  margin-bottom: 12px;
  line-height: 1.5;
}
.card-desc-skeleton {
  height: 36px;
  margin-bottom: 12px;
  border-radius: 6px;
  background: linear-gradient(90deg, #e8ecf2 25%, #f0f2f5 50%, #e8ecf2 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
}
@keyframes shimmer {
  0%   { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

/* ===== 配置行（通用布局） ===== */
.cfg-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 0;
  border-bottom: 1px solid #f5f5f5;
}
.cfg-row label:first-child {
  font-size: 14px;
  color: #444;
}
.cfg-row-col {
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
}
.cfg-hint-text {
  font-size: 11px;
  color: #99a;
}
.cfg-slider {
  display: flex;
  align-items: center;
  gap: 8px;
}
.cfg-slider span {
  font-size: 13px;
  color: #888;
  min-width: 36px;
}
.cfg-input {
  width: 80px;
  padding: 4px 8px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 13px;
  text-align: center;
}

/* ===== Switch 开关 ===== */
.switch {
  position: relative;
  display: inline-block;
  width: 44px;
  height: 24px;
  cursor: pointer;
}
.switch input {
  opacity: 0;
  width: 0;
  height: 0;
}
.switch-track {
  position: absolute;
  inset: 0;
  border-radius: 12px;
  background: #ccc;
  transition: 0.2s;
}
.switch-track::after {
  content: '';
  position: absolute;
  top: 2px;
  left: 2px;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: #fff;
  transition: 0.2s;
}
.switch input:checked + .switch-track {
  background: var(--accent);
}
.switch input:checked + .switch-track::after {
  transform: translateX(20px);
}

/* ===== 通用滑条 ===== */
input[type=range] {
  -webkit-appearance: none;
  appearance: none;
  width: 140px;
  height: 6px;
  border-radius: 3px;
  accent-color: var(--accent);
  background: #e0e5ea;
  outline: none;
  cursor: pointer;
}
input[type=range]::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--accent);
  border: 2px solid #fff;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
}

/* ===== 名单导入区域 ===== */
.import-capsule {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  margin-bottom: 12px;
  border-radius: 999px;
  border: 1.5px solid #898989;
  background: #fff;
}
.import-hint {
  flex: 1;
  font-size: 12px;
  color: #888;
  line-height: 1.4;
}
.upload-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 7px 16px 5px;
  border-radius: 999px;
  background: var(--accent);
  color: #fff;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  flex-shrink: 0;
}
.upload-btn:hover {
  filter: brightness(1.06);
}
.count-badge {
  padding: 7px 8px 5px;
  font-size: 12px;
  color: #fff;
  white-space: nowrap;
  flex-shrink: 0;
  background: var(--accent);
  border-radius: 999px;
  font-weight: 600;
  align-items: center;
  display: inline-flex;
}

/* ===== 名单左右布局 ===== */
.roster-layout {
  display: flex;
  gap: 14px;
  align-items: flex-start;
}
.roster-left {
  flex: 0 0 34%;
  display: flex;
  flex-direction: column;
}
.roster-right {
  flex: 1;
  padding: 2px;
  max-height: 220px;
  overflow-y: auto;
}

/* ===== Textarea 稿纸区 ===== */
.roster-textarea {
  width: 100%;
  height: 220px;
  resize: none;
  border: 1.5px solid #c8d4e0;
  border-radius: 10px;
  padding: 10px 12px;
  font-size: 14px;
  font-family: 'UI', 'Bahnschrift', 'Microsoft YaHei UI', sans-serif;
  line-height: 2;
  letter-spacing: 0.5px;
  outline: none;
  transition: border-color 0.2s, box-shadow 0.2s;
  background-color: #fdfcf8;
  color: #334;
  box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.04);
  white-space: nowrap;
}
.roster-textarea:hover {
  border-color: #a0b8cc;
}
.roster-textarea:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px rgba(102, 204, 255, 0.12), inset 0 1px 3px rgba(0, 0, 0, 0.04);
  background-color: #fffef9;
}

/* ===== 学生芯片（右侧预览） ===== */
.name-chip-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
}
.name-chip {
  text-align: center;
  padding: 5px 8px;
  border-radius: 999px;
  background: var(--accent);
  color: #fff;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: transform 0.15s, filter 0.15s;
  user-select: none;
  white-space: nowrap;
}
.name-chip:hover {
  filter: brightness(1.1);
}
.name-chip:active {
  transform: scale(0.96);
  filter: brightness(0.85);
}
.chip-empty-hint {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  min-height: 140px;
  color: #aab4c0;
  font-size: 13px;
  text-align: center;
  line-height: 1.6;
  user-select: none;
}

/* ===== 权重管理区域 ===== */
.weight-head-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 10px 0;
}
.inline-check {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: #667;
  margin: 0;
}

/* 空状态 */
.empty-tip {
  color: #ccc;
  font-size: 14px;
  text-align: center;
  padding: 16px 0;
}
.empty-arona-img {
  width: 30%;
  opacity: 0.8;
  display: block;
  margin: 0 auto 8px;
}

/* 学生列表 */
.student-table-wrap {
  max-height: 240px;
  overflow-y: auto;
}
.roster-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.roster-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  border-radius: 8px;
  background: #f7f9fb;
  transition: background 0.3s;
}
.roster-item:nth-child(even) {
  background: #eef2f7;
}
.roster-name {
  flex: 1;
  font-size: 13px;
  font-weight: 600;
  color: #334;
}
.roster-weight {
  display: flex;
  align-items: center;
  gap: 6px;
}
.roster-del {
  width: 24px;
  height: 24px;
  border: none;
  border-radius: 50%;
  background: #fee;
  color: #e55;
  font-size: 12px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}
.roster-del:hover {
  background: #fcc;
  color: #d33;
}
.roster-reset {
  padding: 4px 12px;
  border: 1px solid #dde;
  border-radius: 999px;
  background: #fff;
  cursor: pointer;
  font-size: 11px;
  color: #88a;
  font-family: inherit;
  white-space: nowrap;
  transition: all 0.2s;
}
.roster-reset:hover {
  border-color: #aab;
  color: #667;
}

/* 权重滑条（浓缩版） */
.weight-slider {
  width: 70px;
  height: 4px;
  -webkit-appearance: none;
  appearance: none;
  border-radius: 2px;
  outline: none;
  cursor: pointer;
  vertical-align: middle;
}
.weight-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: var(--accent);
  border: 2px solid #fff;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.12);
}
.weight-val {
  display: inline-block;
  width: 28px;
  text-align: right;
  font-size: 11px;
  font-weight: 600;
  color: #88a;
}
.weight-prob {
  display: inline-block;
  min-width: 48px;
  text-align: right;
  font-size: 11px;
  font-weight: 500;
  color: var(--accent);
}
</style>


