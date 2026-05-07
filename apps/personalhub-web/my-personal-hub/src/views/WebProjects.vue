<template>
    <div class="web-projects">
        <a-page-header title="Web Projects" :sub-title="$t('webProjects.subtitle')" />

        <a-row :gutter="[16, 16]" style="margin-top: 24px">
            <a-col v-for="link in categoryLinks" :key="link.id" :xs="24" :sm="12" :lg="8">
                <a-card hoverable class="project-card">
                    <template #cover>
                        <div class="project-preview">
                            <CodeOutlined style="font-size: 64px; color: #722ed1" />
                        </div>
                    </template>
                    <a-card-meta :title="link.title">
                        <template #description>
                            <p class="project-url">{{ link.shortUrl }}</p>
                            <a-space class="project-tags">
                                <a-tag v-for="tag in link.tags" :key="tag" color="purple">{{ tag }}</a-tag>
                            </a-space>
                            <div class="project-stats">
                                <a-statistic :value="link.visits" :suffix="$t('dashboard.stats.visitsUnit')"
                                    :value-style="{ fontSize: '14px' }" />
                            </div>
                        </template>
                    </a-card-meta>
                    <template #actions>
                        <a-tooltip :title="$t('webProjects.open')">
                            <EyeOutlined @click="openLink(link)" />
                        </a-tooltip>
                        <a-tooltip :title="$t('common.actions.copy')">
                            <CopyOutlined @click="copyLink(link.shortUrl)" />
                        </a-tooltip>
                        <a-tooltip :title="$t('common.actions.share')">
                            <ShareAltOutlined @click="shareProject(link)" />
                        </a-tooltip>
                    </template>
                </a-card>
            </a-col>
        </a-row>
        <a-empty v-if="categoryLinks.length === 0" :description="$t('webProjects.empty')" style="margin-top: 48px" />
    </div>
</template>

<script>
import {
    CodeOutlined,
    EyeOutlined,
    CopyOutlined,
    ShareAltOutlined
} from '@ant-design/icons-vue'
import { message } from 'ant-design-vue'
import { mapGetters } from 'vuex'
import { getLinkRedirectUrl } from '@/utils/helpers'

export default {
    name: 'WebProjects',
    components: {
        CodeOutlined,
        EyeOutlined,
        CopyOutlined,
        ShareAltOutlined
    },
    computed: {
        ...mapGetters(['getLinksByCategory']),
        categoryLinks() {
            return this.getLinksByCategory('Web')
        }
    },
    async mounted() {
        this.loading = true
        try {
            await this.$store.dispatch('fetchLinks')
        } catch (error) {
            console.error('Error loading links:', error)
        } finally {
            this.loading = false
        }
    },
    data() {
        return {
            loading: false
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
        shareProject(link) {
            message.info(this.$t('webProjects.share', { name: link.title }))
        }
    }
}
</script>

<style scoped>
.project-card {
    height: 100%;
}

.project-preview {
    height: 200px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.project-url {
    color: #1890ff;
    margin: 12px 0;
}

.project-tags {
    margin: 12px 0;
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
}

.project-stats {
    margin-top: 16px;
}
</style>
