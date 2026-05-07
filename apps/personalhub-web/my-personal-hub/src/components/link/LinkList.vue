<template>
    <div class="link-list">
        <a-spin :spinning="loading">
            <a-list :data-source="links" :pagination="pagination" item-layout="vertical">
                <template #renderItem="{ item }">
                    <a-list-item>
                        <template #actions>
                            <a-space>
                                <a-tooltip :title="$t('common.actions.openLink')">
                                    <a-button type="text" size="small" @click="openLink(item)">
                                        <template #icon>
                                            <ExportOutlined />
                                        </template>
                                    </a-button>
                                </a-tooltip>

                                <a-tooltip :title="$t('common.actions.copy')">
                                    <a-button type="text" size="small" @click="copyLink(item)">
                                        <template #icon>
                                            <CopyOutlined />
                                        </template>
                                    </a-button>
                                </a-tooltip>

                                <a-tooltip :title="$t('common.actions.edit')">
                                    <a-button type="text" size="small" @click="$emit('edit', item)">
                                        <template #icon>
                                            <EditOutlined />
                                        </template>
                                    </a-button>
                                </a-tooltip>

                                <a-tooltip :title="$t('common.actions.delete')">
                                    <a-button type="text" danger size="small" @click="$emit('delete', item)">
                                        <template #icon>
                                            <DeleteOutlined />
                                        </template>
                                    </a-button>
                                </a-tooltip>
                            </a-space>
                        </template>

                        <a-list-item-meta>
                            <template #title>
                                <div class="list-item-title">
                                    <LinkOutlined />
                                    <span>{{ item.title }}</span>
                                    <a-tag v-if="item.visibility === 'private'" color="red" size="small">
                                        <LockOutlined /> {{ $t('common.visibility.private') }}
                                    </a-tag>
                                </div>
                            </template>

                            <template #description>
                                <div class="list-item-description">
                                    <div class="url-section">
                                        <a-tag color="blue" style="cursor: pointer" @click="copyLink(item)">
                                            {{ item.shortUrl }}
                                        </a-tag>
                                        <a-divider type="vertical" />
                                        <a :href="linkRedirect(item)" target="_blank" class="original-url">
                                            {{ truncateUrl(item.originalUrl) }}
                                        </a>
                                    </div>

                                    <div v-if="item.description" class="description-text">
                                        {{ item.description }}
                                    </div>

                                    <div class="meta-section">
                                        <a-space :size="12">
                                            <a-tag :color="getCategoryColor(item.category)">
                                                {{ categoryLabel(item.category) }}
                                            </a-tag>

                                            <span class="meta-item">
                                                <EyeOutlined />
                                                {{ item.visits }} {{ $t('dashboard.stats.visitsUnit') }}
                                            </span>

                                            <span class="meta-item">
                                                <CalendarOutlined />
                                                {{ formatDate(item.createdAt) }}
                                            </span>
                                        </a-space>
                                    </div>

                                    <div v-if="item.tags && item.tags.length > 0" class="tags-section">
                                        <a-tag v-for="tag in item.tags" :key="tag" size="small">
                                            {{ tag }}
                                        </a-tag>
                                    </div>
                                </div>
                            </template>
                        </a-list-item-meta>
                    </a-list-item>
                </template>
            </a-list>
        </a-spin>

        <a-empty v-if="!loading && links.length === 0" :description="$t('common.empty.links')" />
    </div>
</template>

<script>
import {
    LinkOutlined,
    ExportOutlined,
    CopyOutlined,
    EditOutlined,
    DeleteOutlined,
    LockOutlined,
    EyeOutlined,
    CalendarOutlined
} from '@ant-design/icons-vue'
import { message } from 'ant-design-vue'
import { getLinkRedirectUrl } from '@/utils/helpers'

export default {
    name: 'LinkList',
    components: {
        LinkOutlined,
        ExportOutlined,
        CopyOutlined,
        EditOutlined,
        DeleteOutlined,
        LockOutlined,
        EyeOutlined,
        CalendarOutlined
    },
    props: {
        links: {
            type: Array,
            default: () => []
        },
        loading: {
            type: Boolean,
            default: false
        },
        pagination: {
            type: Object,
            default: () => ({
                current: 1,
                pageSize: 10,
                total: 0
            })
        }
    },
    emits: ['edit', 'delete', 'page-change'],
    computed: {
        currentLanguage() {
            return (this.$store.state.settings?.general?.language || 'vi').toLowerCase()
        },
        dateFormatter() {
            const locale = this.currentLanguage === 'en' ? 'en-US' : 'vi-VN'
            return new Intl.DateTimeFormat(locale, {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric'
            })
        }
    },
    methods: {
        linkRedirect(link) {
            return getLinkRedirectUrl(link) || link.originalUrl
        },
        openLink(link) {
            const url = this.linkRedirect(link)
            if (url) {
                window.open(url, '_blank')
            }
        },
        copyLink(link) {
            navigator.clipboard.writeText(`https://${link.shortUrl}`)
            message.success(this.$t('common.messages.copySuccess'))
        },
        truncateUrl(url) {
            if (url.length > 60) {
                return url.substring(0, 57) + '...'
            }
            return url
        },
        formatDate(date) {
            if (!date) return ''
            return this.dateFormatter.format(new Date(date))
        },
        categoryLabel(category) {
            const map = {
                'IT Support': 'common.categories.itSupport',
                'Tester': 'common.categories.tester',
                'Web': 'common.categories.web',
                'Media': 'common.categories.media'
            }
            return map[category] ? this.$t(map[category]) : category
        },
        getCategoryColor(category) {
            const colors = {
                'IT Support': 'blue',
                'Tester': 'green',
                'Web': 'purple',
                'Media': 'orange'
            }
            return colors[category] || 'default'
        }
    }
}
</script>

<style scoped>
.link-list {
    background: #fff;
}

.list-item-title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 16px;
    font-weight: 600;
}

.list-item-description {
    margin-top: 8px;
}

.url-section {
    display: flex;
    align-items: center;
    margin-bottom: 8px;
}

.original-url {
    color: #666;
    font-size: 13px;
}

.original-url:hover {
    color: #1890ff;
}

.description-text {
    margin: 8px 0;
    color: #666;
    font-size: 14px;
}

.meta-section {
    margin: 8px 0;
}

.meta-item {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    color: #999;
    font-size: 13px;
}

.tags-section {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 8px;
}
</style>
