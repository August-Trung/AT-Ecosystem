<template>
    <div class="file-list">
        <a-spin :spinning="loading">
            <a-list :data-source="files" :pagination="pagination" item-layout="horizontal">
                <template #renderItem="{ item }">
                    <a-list-item>
                        <template #actions>
                            <a-space>
                                <a-tooltip :title="$t('files.tooltips.view')">
                                    <a-button type="text" size="small" @click="$emit('view', item)">
                                        <template #icon>
                                            <EyeOutlined />
                                        </template>
                                    </a-button>
                                </a-tooltip>

                                <a-tooltip :title="$t('files.tooltips.download')">
                                    <a-button type="text" size="small" @click="$emit('download', item)">
                                        <template #icon>
                                            <DownloadOutlined />
                                        </template>
                                    </a-button>
                                </a-tooltip>

                                <a-tooltip :title="$t('files.tooltips.share')">
                                    <a-button type="text" size="small" @click="$emit('share', item)">
                                        <template #icon>
                                            <ShareAltOutlined />
                                        </template>
                                    </a-button>
                                </a-tooltip>

                                <a-dropdown>
                                    <a-button type="text" size="small">
                                        <template #icon>
                                            <MoreOutlined />
                                        </template>
                                    </a-button>
                                    <template #overlay>
                                        <a-menu>
                                            <a-menu-item @click="$emit('edit', item)">
                                                <EditOutlined /> {{ $t('common.actions.edit') }}
                                            </a-menu-item>
                                            <a-menu-item @click="$emit('move', item)">
                                                <FolderOutlined /> {{ $t('common.actions.move') }}
                                            </a-menu-item>
                                            <a-menu-divider />
                                            <a-menu-item danger @click="$emit('delete', item)">
                                                <DeleteOutlined /> {{ $t('common.actions.delete') }}
                                            </a-menu-item>
                                        </a-menu>
                                    </template>
                                </a-dropdown>
                            </a-space>
                        </template>

                        <a-list-item-meta>
                            <template #avatar>
                                <a-avatar :size="48" :style="{
                                    backgroundColor: getFileColor(item.type),
                                    fontSize: '20px'
                                }">
                                    <template #icon>
                                        <component :is="getFileIcon(item.type)" />
                                    </template>
                                </a-avatar>
                            </template>

                            <template #title>
                                <div class="file-title">
                                    <span class="file-name">{{ item.name }}</span>
                                    <a-tag :color="getFileTypeColor(item.type)" size="small" style="margin-left: 8px">
                                        {{ getFileTypeText(item.type) }}
                                    </a-tag>
                                </div>
                            </template>

                            <template #description>
                                <div class="file-description">
                                    <a-space :size="16">
                                        <span class="desc-item">
                                            <FolderOutlined />
                                            <a-tag :color="getCategoryColor(item.category)" size="small">
                                                {{ categoryLabel(item.category) }}
                                            </a-tag>
                                        </span>

                                        <span class="desc-item">
                                            <FileOutlined />
                                            {{ item.size }}
                                        </span>

                                        <span class="desc-item">
                                            <CalendarOutlined />
                                            {{ formatDate(item.createdAt) }}
                                        </span>
                                    </a-space>

                                    <div v-if="item.tags && item.tags.length > 0" class="tags-row">
                                        <TagOutlined />
                                        <a-tag v-for="tag in item.tags" :key="tag" size="small">
                                            {{ tag }}
                                        </a-tag>
                                    </div>

                                    <div v-if="item.description" class="description-text">
                                        {{ item.description }}
                                    </div>
                                </div>
                            </template>
                        </a-list-item-meta>
                    </a-list-item>
                </template>
            </a-list>
        </a-spin>

        <a-empty v-if="!loading && files.length === 0" :description="$t('common.empty.files')" />
    </div>
</template>

<script>
import {
    EyeOutlined,
    DownloadOutlined,
    ShareAltOutlined,
    MoreOutlined,
    EditOutlined,
    FolderOutlined,
    DeleteOutlined,
    FileOutlined,
    CalendarOutlined,
    TagOutlined,
    FilePdfOutlined,
    FileWordOutlined,
    FileExcelOutlined,
    FilePptOutlined,
    FileImageOutlined,
    VideoCameraOutlined,
    FileTextOutlined
} from '@ant-design/icons-vue'

export default {
    name: 'FileList',
    components: {
        EyeOutlined,
        DownloadOutlined,
        ShareAltOutlined,
        MoreOutlined,
        EditOutlined,
        FolderOutlined,
        DeleteOutlined,
        FileOutlined,
        CalendarOutlined,
        TagOutlined,
        FilePdfOutlined,
        FileWordOutlined,
        FileExcelOutlined,
        FilePptOutlined,
        FileImageOutlined,
        VideoCameraOutlined,
        FileTextOutlined
    },
    props: {
        files: {
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
    emits: ['view', 'download', 'share', 'edit', 'move', 'delete'],
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
        getFileIcon(type) {
            const icons = {
                pdf: FilePdfOutlined,
                word: FileWordOutlined,
                excel: FileExcelOutlined,
                ppt: FilePptOutlined,
                image: FileImageOutlined,
                video: VideoCameraOutlined
            }
            return icons[type] || FileTextOutlined
        },
        getFileColor(type) {
            const colors = {
                pdf: '#ff4d4f',
                word: '#1890ff',
                excel: '#52c41a',
                ppt: '#fa8c16',
                image: '#722ed1',
                video: '#eb2f96'
            }
            return colors[type] || '#666'
        },
        getFileTypeColor(type) {
            const colors = {
                pdf: 'red',
                word: 'blue',
                excel: 'green',
                ppt: 'orange',
                image: 'purple',
                video: 'magenta'
            }
            return colors[type] || 'default'
        },
        getFileTypeText(type) {
            const texts = {
                pdf: 'PDF',
                word: 'Word',
                excel: 'Excel',
                ppt: 'PPT',
                image: 'Image',
                video: 'Video'
            }
            return texts[type] || 'File'
        },
        getCategoryColor(category) {
            const colors = {
                'IT Support': 'blue',
                'Tester': 'green',
                'Web': 'purple',
                'Media': 'orange'
            }
            return colors[category] || 'default'
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
        formatDate(date) {
            if (!date) return ''
            return this.dateFormatter.format(new Date(date))
        }
    }
}
</script>

<style scoped>
.file-list {
    background: #fff;
}

.file-title {
    display: flex;
    align-items: center;
}

.file-name {
    font-weight: 600;
    font-size: 15px;
}

.file-description {
    margin-top: 8px;
}

.desc-item {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    color: #666;
    font-size: 13px;
}

.tags-row {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-top: 8px;
}

.description-text {
    margin-top: 8px;
    color: #999;
    font-size: 13px;
}
</style>
