<template>
  <a-config-provider :theme="themeConfig">
    <div :class="appClasses">
      <router-view />
    </div>
  </a-config-provider>
</template>

<script>
import { theme } from 'ant-design-vue'

const { defaultAlgorithm, darkAlgorithm, compactAlgorithm } = theme

export default {
  name: 'App',
  computed: {
    appearance() {
      return this.$store.state.settings?.appearance || {}
    },
    themeConfig() {
      const isDark = this.appearance.theme === 'dark'
      const isCompact = this.appearance.density === 'compact'
      const algorithms = [isDark ? darkAlgorithm : defaultAlgorithm]
      if (isCompact) {
        algorithms.push(compactAlgorithm)
      }
      return {
        token: {
          colorPrimary: this.appearance.primaryColor || '#1890ff',
          borderRadius: isCompact ? 4 : 8
        },
        algorithm: algorithms.length > 1 ? algorithms : algorithms[0]
      }
    },
    appClasses() {
      const fontSize = this.appearance.fontSize || 'normal'
      const themeClass = this.appearance.theme === 'dark' ? 'theme-dark' : 'theme-light'
      return [
        'app-root',
        themeClass,
        fontSize === 'large' ? 'font-size-large' : 'font-size-normal'
      ]
    }
  },
  created() {
    this.$store.dispatch('loadSettings')
  }
}
</script>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
}

#app {
  min-height: 100vh;
  background: #f0f2f5;
}

.app-root {
  min-height: 100vh;
  font-size: 14px;
  background: #f0f2f5;
  transition: background 0.3s ease, color 0.3s ease;
}

.app-root.font-size-large {
  font-size: 16px;
}

.app-root.theme-dark {
  background: #0f172a;
  color: #f5f5f5;
}

.app-root.theme-dark .ant-layout,
.app-root.theme-dark .ant-layout-content,
.app-root.theme-dark .ant-layout-header,
.app-root.theme-dark .ant-layout-sider {
  background: #111827 !important;
}

.app-root.theme-dark .header,
.app-root.theme-dark .content-wrapper,
.app-root.theme-dark .ant-card,
.app-root.theme-dark .ant-drawer,
.app-root.theme-dark .ant-list,
.app-root.theme-dark .ant-table,
.app-root.theme-dark .ant-modal-content {
  background-color: #1f2937 !important;
  color: #f3f4f6;
}

.app-root.theme-dark .ant-card,
.app-root.theme-dark .content-wrapper,
.app-root.theme-dark .ant-modal-content {
  border-color: #374151;
  box-shadow: none;
}

.app-root.theme-dark .ant-divider,
.app-root.theme-dark .ant-list-split .ant-list-item,
.app-root.theme-dark .ant-table {
  border-color: #374151 !important;
}

.app-root.theme-dark .ant-typography,
.app-root.theme-dark .ant-statistic-title,
.app-root.theme-dark .ant-statistic-content {
  color: #e5e7eb !important;
}

.app-root.theme-dark .ant-tag {
  color: #f9fafb;
}
</style>
