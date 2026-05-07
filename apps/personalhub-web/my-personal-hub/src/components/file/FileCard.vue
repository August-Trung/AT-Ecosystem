<template>
    <a-card hoverable class="file-card">
        <template #cover>
            <div class="file-preview" :style="{ background: getFileBackground(file.type) }">
                <component :is="getFileIcon(file.type)" class="file-icon" :style="{ color: getFileColor(file.type) }" />
            </div>
        </template>

        <template #actions>
            <a-tooltip :title="$t('files.tooltips.view')">
                <span @click="$emit('view', file)">
                    <EyeOutlined />
                </span>
            </a-tooltip>
            <a-tooltip :title="$t('files.tooltips.download')">
                <span @click="$emit('download', file)">
                    <DownloadOutlined />
                </span>
            </a-tooltip>
            <a-tooltip :title="$t('files.tooltips.share')">
                <span @click="$emit('share', file)">
                    <ShareAltOutlined />
                </span>
            </a-tooltip>
            <a-dropdown>
                <MoreOutlined />
                <template #overlay>
                    <a-menu>
                        <a-menu-item @click="$emit('edit', file)">
                            <EditOutlined /> {{ $t('common.actions.edit') }}
                        </a-menu-item>
                        <a-menu-item @click="$emit('move', file)">
                            <FolderOutlined /> {{ $t('common.actions.move') }}
                        </a-menu-item>
                        <a-menu-divider />
                        <a-menu-item danger @click="$emit('delete', file)">
                            <DeleteOutlined /> {{ $t('common.actions.delete') }}
                        </a-menu-item>
                    </a-menu>
                </template>
            </a-dropdown>
        </template>

        <a-card-meta>
            <template #title>
                <div class="file-title" :title="file.name">
                    {{ truncateFileName(file.name) }}
                </div>
            </template>

            <template #description>
                <div class="file-info">
                    <div class="info-row">
                        <a-tag :color="getFileTypeColor(file.type)" size="small">
                            {{ getFileTypeText(file.type) }}
                        </a-tag>
                        <span class="file-size">{{ file.size }}</span>
                    </div>

                    <div class="info-row">
                        <a-tag :color="getCategoryColor(file.category)" size="small">
                            {{ categoryLabel(file.category) }}
                        </a-tag>
                    </div>

                    <div v-if="file.tags && file.tags.length > 0" class="tags-row">
                        <a-tag v-for="tag in file.tags.slice(0, 2)" :key="tag" size="small">
                            {{ tag }}
                        </a-tag>
                        <a-tag v-if="file.tags.length > 2" size="small">
                            +{{ file.tags.length - 2 }}
                        </a-tag>
                    </div>

                    <div class="date-row">
                        <CalendarOutlined />
                        <span>{{ formatDate(file.createdAt) }}</span>
                    </div>
                </div>
            </template>
        </a-card-meta>
    </a-card>
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
    CalendarOutlined,
    FilePdfOutlined,
    FileWordOutlined,
    FileExcelOutlined,
    FilePptOutlined,
    FileImageOutlined,
    VideoCameraOutlined,
    FileTextOutlined
} from '@ant-design/icons-vue'

export default {
    name: 'FileCard',
    components: {
        EyeOutlined,
        DownloadOutlined,
        ShareAltOutlined,
        MoreOutlined,
        EditOutlined,
        FolderOutlined,
        DeleteOutlined,
        CalendarOutlined,
        FilePdfOutlined,
        FileWordOutlined,
        FileExcelOutlined,
        FilePptOutlined,
        FileImageOutlined,
        VideoCameraOutlined,
        FileTextOutlined
    },
    props: {
        file: {
            type: Object,
            required: true
        }
    },
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
    emits: ['view', 'download', 'share', 'edit', 'move', 'delete'],
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
        getFileBackground(type) {
            const backgrounds = {
                pdf: 'linear-gradient(135deg, #ffeaa7 0%, #fdcb6e 100%)',
                word: 'linear-gradient(135deg, #a8e6ff 0%, #74b9ff 100%)',
                excel: 'linear-gradient(135deg, #c7f0bd 0%, #90ee90 100%)',
                ppt: 'linear-gradient(135deg, #fdcb6e 0%, #fd79a8 100%)',
                image: 'linear-gradient(135deg, #dfe6e9 0%, #b2bec3 100%)',
                video: 'linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)'
            }
            return backgrounds[type] || 'linear-gradient(135deg, #e0e0e0 0%, #bdbdbd 100%)'
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
                pptx: 'Powerpoint',
                ppt: 'PPT',
                image: 'Image',
                video: 'Video'
            }
            return texts[type] || 'File'
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
        },
        truncateFileName(name) {
            if (name.length > 20) {
                const ext = name.split('.').pop()
                const nameWithoutExt = name.substring(0, name.lastIndexOf('.'))
                return nameWithoutExt.substring(0, 15) + '...' + ext
            }
            return name
        },
        formatDate(date) {
            if (!date) return ''
            return this.dateFormatter.format(new Date(date))
        }
    }
}
</script>

<style scoped>
.file-card {
    height: 100%;
    transition: all 0.3s;
}

.file-card:hover {
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.file-preview {
    height: 160px;
    display: flex;
    align-items: center;
    justify-content: center;
}

.file-icon {
    font-size: 64px;
}

.file-title {
    font-weight: 600;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.file-info {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.info-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.file-size {
    color: #999;
    font-size: 12px;
}

.tags-row {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
}

.date-row {
    display: flex;
    align-items: center;
    gap: 6px;
    color: #999;
    font-size: 12px;
}
</style>
