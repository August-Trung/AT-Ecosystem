<template>
    <a-card hoverable class="link-card">
        <template #title>
            <div class="card-title">
                <LinkOutlined />
                <span class="title-text">{{ link.title }}</span>
            </div>
        </template>

        <template #extra>
            <a-dropdown>
                <MoreOutlined style="cursor: pointer; font-size: 18px" />
                <template #overlay>
                    <a-menu>
                        <a-menu-item @click="$emit('edit', link)">
                            <EditOutlined /> {{ $t('common.actions.edit') }}
                        </a-menu-item>
                        <a-menu-item @click="$emit('share', link)">
                            <ShareAltOutlined /> {{ $t('common.actions.share') }}
                        </a-menu-item>
                        <a-menu-divider />
                        <a-menu-item danger @click="$emit('delete', link)">
                            <DeleteOutlined /> {{ $t('common.actions.delete') }}
                        </a-menu-item>
                    </a-menu>
                </template>
            </a-dropdown>
        </template>

        <div class="link-content">
            <div class="short-url" @click="copyShortUrl">
                <a-tag color="blue">{{ link.shortUrl }}</a-tag>
                <CopyOutlined class="copy-icon" />
            </div>

            <div class="original-url">
                <a :href="redirectUrl" target="_blank" rel="noopener">
                    {{ truncateUrl(link.originalUrl) }}
                </a>
            </div>

            <a-divider style="margin: 12px 0" />

            <div class="link-meta">
                <div class="meta-item">
                    <a-tag :color="getCategoryColor(link.category)">
                        {{ categoryLabel(link.category) }}
                    </a-tag>
                </div>

                <div class="meta-item">
                    <EyeOutlined />
                    <span>{{ link.visits }} {{ $t('dashboard.stats.visitsUnit') }}</span>
                </div>
            </div>

            <div v-if="link.tags && link.tags.length > 0" class="link-tags">
                <a-tag v-for="tag in link.tags" :key="tag" size="small">
                    {{ tag }}
                </a-tag>
            </div>

            <div class="link-date">
                <CalendarOutlined />
                <span>{{ formatDate(link.createdAt) }}</span>
            </div>
        </div>

        <template #actions>
            <a-tooltip :title="$t('common.actions.openLink')">
                <span @click="openLink">
                    <ExportOutlined /> {{ $t('common.actions.openLink') }}
                </span>
            </a-tooltip>
            <a-tooltip :title="$t('common.actions.copy')">
                <span @click="copyShortUrl">
                    <CopyOutlined /> {{ $t('common.actions.copy') }}
                </span>
            </a-tooltip>
            <a-tooltip :title="$t('common.actions.qrCode')">
                <span @click="$emit('qrcode', link)">
                    <QrcodeOutlined /> {{ $t('common.actions.qrCode') }}
                </span>
            </a-tooltip>
        </template>
    </a-card>
</template>

<script>
import {
    LinkOutlined,
    MoreOutlined,
    EditOutlined,
    ShareAltOutlined,
    DeleteOutlined,
    CopyOutlined,
    EyeOutlined,
    CalendarOutlined,
    ExportOutlined,
    QrcodeOutlined
} from '@ant-design/icons-vue'
import { message } from 'ant-design-vue'
import { getLinkRedirectUrl } from '@/utils/helpers'

export default {
    name: 'LinkCard',
    components: {
        LinkOutlined,
        MoreOutlined,
        EditOutlined,
        ShareAltOutlined,
        DeleteOutlined,
        CopyOutlined,
        EyeOutlined,
        CalendarOutlined,
        ExportOutlined,
        QrcodeOutlined
    },
    props: {
        link: {
            type: Object,
            required: true
        }
    },
    emits: ['edit', 'delete', 'share', 'qrcode'],
    computed: {
        redirectUrl() {
            return getLinkRedirectUrl(this.link) || this.link.originalUrl
        },
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
        openLink() {
            if (this.redirectUrl) {
                window.open(this.redirectUrl, '_blank')
            }
        },
        copyShortUrl() {
            navigator.clipboard.writeText(`https://${this.link.shortUrl}`)
            message.success(this.$t('common.messages.copySuccess'))
        },
        truncateUrl(url) {
            if (url.length > 50) {
                return url.substring(0, 47) + '...'
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
.link-card {
    height: 100%;
    transition: all 0.3s;
}

.link-card:hover {
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.card-title {
    display: flex;
    align-items: center;
    gap: 8px;
}

.title-text {
    font-weight: 600;
}

.link-content {
    min-height: 150px;
}

.short-url {
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
    margin-bottom: 8px;
}

.copy-icon {
    color: #1890ff;
    font-size: 14px;
}

.original-url {
    color: #666;
    font-size: 13px;
    margin-bottom: 12px;
}

.original-url a {
    color: #666;
    text-decoration: none;
}

.original-url a:hover {
    color: #1890ff;
}

.link-meta {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
}

.meta-item {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
    color: #666;
}

.link-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-bottom: 12px;
}

.link-date {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    color: #999;
}
</style>
