<template>
    <div class="it-support">
        <a-page-header title="IT Support" :sub-title="$t('itSupport.subtitle')" />

        <a-tabs v-model:activeKey="activeTab" style="margin-top: 24px">
            <a-tab-pane key="links" :tab="$t('itSupport.tabs.links')">
                <a-row :gutter="[16, 16]">
                    <a-col v-for="link in categoryLinks" :key="link.id" :xs="24" :sm="12" :lg="8">
                        <a-card hoverable class="link-card">
                            <template #title>
                                <LinkOutlined /> {{ link.title }}
                            </template>
                            <template #extra>
                                <a-tag color="blue">{{ link.visits }} {{ $t('dashboard.stats.visitsUnit') }}</a-tag>
                            </template>
                            <p class="link-url">{{ link.shortUrl }}</p>
                            <a-space class="link-tags">
                                <a-tag v-for="tag in link.tags" :key="tag">{{ tag }}</a-tag>
                            </a-space>
                            <div class="link-actions">
                                <a-button type="primary" size="small" @click="openLink(link)">
                                    {{ $t('common.actions.openLink') }}
                                </a-button>
                                <a-button size="small" @click="copyLink(link.shortUrl)">
                                    <CopyOutlined /> {{ $t('common.actions.copy') }}
                                </a-button>
                            </div>
                        </a-card>
                    </a-col>
                </a-row>
                <a-empty v-if="categoryLinks.length === 0" :description="$t('itSupport.empty.links')" />
            </a-tab-pane>

            <a-tab-pane key="files" :tab="$t('itSupport.tabs.files')">
                <a-row :gutter="[16, 16]">
                    <a-col v-for="file in categoryFiles" :key="file.id" :xs="24" :sm="12" :lg="8">
                        <a-card hoverable class="file-card">
                            <div class="file-icon">
                                <component :is="getFileIcon(file.type)" style="font-size: 48px"
                                    :style="{ color: getFileColor(file.type) }" />
                            </div>
                            <div class="file-name">{{ file.name }}</div>
                            <div class="file-info">
                                <span class="file-size">{{ file.size }}</span>
                                <span class="file-date">{{ file.createdAt }}</span>
                            </div>
                            <a-space class="file-tags">
                                <a-tag v-for="tag in file.tags" :key="tag">{{ tag }}</a-tag>
                            </a-space>
                            <div class="file-actions">
                                <a-button type="primary" size="small" @click="viewFile(file.url)">
                                    <EyeOutlined /> {{ $t('files.tooltips.view') }}
                                </a-button>
                                <a-button size="small" @click="downloadFile(file)">
                                    <DownloadOutlined /> {{ $t('files.tooltips.download') }}
                                </a-button>
                            </div>
                        </a-card>
                    </a-col>
                </a-row>
                <a-empty v-if="categoryFiles.length === 0" :description="$t('itSupport.empty.files')" />
            </a-tab-pane>
        </a-tabs>
    </div>
</template>

<script>
import {
    LinkOutlined,
    CopyOutlined,
    EyeOutlined,
    DownloadOutlined,
    FilePdfOutlined,
    FileWordOutlined,
    FilePptOutlined
} from '@ant-design/icons-vue'
import { message } from 'ant-design-vue'
import { mapGetters } from 'vuex'
import { getFileDownloadUrl, getLinkRedirectUrl } from '@/utils/helpers'

export default {
    name: 'ITSupport',
    components: {
        LinkOutlined,
        CopyOutlined,
        EyeOutlined,
        DownloadOutlined,
        FilePdfOutlined,
        FileWordOutlined,
        FilePptOutlined
    },
    data() {
        return {
            activeTab: 'links',
            loading: false
        }
    },
    computed: {
        ...mapGetters(['getLinksByCategory', 'getFilesByCategory']),
        categoryLinks() {
            return this.getLinksByCategory('IT Support')
        },
        categoryFiles() {
            return this.getFilesByCategory('IT Support')
        }
    },
    async mounted() {
        this.loading = true
        try {
            await this.$store.dispatch('fetchLinks')
            await this.$store.dispatch('fetchFiles')
        } catch (error) {
            console.error('Error loading data:', error)
        } finally {
            this.loading = false
        }
    },
    methods: {
        openLink(link) {
            const url = getLinkRedirectUrl(link) || link.originalUrl
            if (url) {
                window.open(url, '_blank')
            }
        },
        copyLink(shortUrl) {
            navigator.clipboard.writeText(`https://${shortUrl}`)
            message.success(this.$t('common.messages.copySuccess'))
        },
        viewFile(url) {
            window.open(url, '_blank')
        },
        downloadFile(file) {
            window.open(`/api/files/download/${file.id}`, '_blank')
        },
        getFileIcon(type) {
            const icons = {
                pdf: FilePdfOutlined,
                word: FileWordOutlined,
                ppt: FilePptOutlined
            }
            return icons[type] || FilePdfOutlined
        },
        getFileColor(type) {
            const colors = {
                pdf: '#ff4d4f',
                word: '#1890ff',
                ppt: '#fa8c16'
            }
            return colors[type] || '#666'
        }
    }
}
</script>

<style scoped>
.link-card,
.file-card {
    height: 100%;
}

.link-url {
    color: #1890ff;
    margin: 12px 0;
}

.link-tags,
.file-tags {
    margin: 12px 0;
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
}

.link-actions,
.file-actions {
    display: flex;
    gap: 8px;
    margin-top: 16px;
}

.file-icon {
    text-align: center;
    padding: 20px 0;
}

.file-name {
    font-weight: 500;
    text-align: center;
    margin: 12px 0;
}

.file-info {
    display: flex;
    justify-content: space-between;
    color: #999;
    font-size: 12px;
    margin: 8px 0;
}
</style>

