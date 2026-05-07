<template>
    <div class="media">
        <a-page-header title="Media" :sub-title="$t('media.subtitle')" />

        <a-tabs v-model:activeKey="activeTab" style="margin-top: 24px">
            <a-tab-pane key="images" :tab="$t('media.tabs.images')">
                <a-row :gutter="[16, 16]">
                    <a-col v-for="file in imageFiles" :key="file.id" :xs="24" :sm="12" :md="8" :lg="6">
                        <a-card hoverable class="media-card">
                            <template #cover>
                                <div class="media-preview image-preview">
                                    <FileImageOutlined style="font-size: 64px; color: #722ed1" />
                                </div>
                            </template>
                            <a-card-meta :title="file.name">
                                <template #description>
                                    <div class="media-info">
                                        <span class="media-size">{{ file.size }}</span>
                                        <span class="media-date">{{ file.createdAt }}</span>
                                    </div>
                                </template>
                            </a-card-meta>
                            <template #actions>
                                <a-tooltip :title="$t('files.tooltips.view')">
                                    <EyeOutlined @click="viewFile(file)" />
                                </a-tooltip>
                                <a-tooltip :title="$t('files.tooltips.download')">
                                    <DownloadOutlined @click="downloadFile(file)" />
                                </a-tooltip>
                                <a-tooltip :title="$t('files.tooltips.delete')">
                                    <DeleteOutlined @click="deleteFile(file)" />
                                </a-tooltip>
                            </template>
                        </a-card>
                    </a-col>
                </a-row>
                <a-empty v-if="imageFiles.length === 0" :description="$t('media.empty.images')" />
            </a-tab-pane>

            <a-tab-pane key="videos" :tab="$t('media.tabs.videos')">
                <a-row :gutter="[16, 16]">
                    <a-col v-for="file in videoFiles" :key="file.id" :xs="24" :sm="12" :md="8">
                        <a-card hoverable class="media-card">
                            <template #cover>
                                <div class="media-preview video-preview">
                                    <VideoCameraOutlined style="font-size: 64px; color: #eb2f96" />
                                </div>
                            </template>
                            <a-card-meta :title="file.name">
                                <template #description>
                                    <div class="media-info">
                                        <span class="media-size">{{ file.size }}</span>
                                        <span class="media-date">{{ file.createdAt }}</span>
                                    </div>
                                    <a-space class="media-tags">
                                        <a-tag v-for="tag in file.tags" :key="tag" color="magenta">{{ tag }}</a-tag>
                                    </a-space>
                                </template>
                            </a-card-meta>
                            <template #actions>
                                <a-tooltip :title="$t('files.tooltips.view')">
                                    <EyeOutlined @click="viewFile(file)" />
                                </a-tooltip>
                                <a-tooltip :title="$t('files.tooltips.download')">
                                    <DownloadOutlined @click="downloadFile(file)" />
                                </a-tooltip>
                                <a-tooltip :title="$t('files.tooltips.delete')">
                                    <DeleteOutlined @click="deleteFile(file)" />
                                </a-tooltip>
                            </template>
                        </a-card>
                    </a-col>
                </a-row>
                <a-empty v-if="videoFiles.length === 0" :description="$t('media.empty.videos')" />
            </a-tab-pane>

            <a-tab-pane key="all" :tab="$t('media.tabs.others')">
                <a-row :gutter="[16, 16]">
                    <a-col v-for="file in categoryFiles" :key="file.id" :xs="24" :sm="12" :md="8" :lg="6">
                        <a-card hoverable class="media-card">
                            <template #cover>
                                <div class="media-preview"
                                    :class="file.type === 'video' ? 'video-preview' : 'image-preview'">
                                    <component :is="file.type === 'video' ? VideoCameraOutlined : FileImageOutlined"
                                        style="font-size: 64px"
                                        :style="{ color: file.type === 'video' ? '#eb2f96' : '#722ed1' }" />
                                </div>
                            </template>
                            <a-card-meta :title="file.name">
                                <template #description>
                                    <div class="media-info">
                                        <a-tag :color="file.type === 'video' ? 'magenta' : 'purple'">
                                            {{ file.type === 'video' ? 'Video' : 'Image' }}
                                        </a-tag>
                                        <span class="media-size">{{ file.size }}</span>
                                    </div>
                                </template>
                            </a-card-meta>
                            <template #actions>
                                <a-tooltip :title="$t('files.tooltips.view')">
                                    <EyeOutlined @click="viewFile(file)" />
                                </a-tooltip>
                                <a-tooltip :title="$t('files.tooltips.download')">
                                    <DownloadOutlined @click="downloadFile(file)" />
                                </a-tooltip>
                                <a-tooltip :title="$t('files.tooltips.delete')">
                                    <DeleteOutlined @click="deleteFile(file)" />
                                </a-tooltip>
                            </template>
                        </a-card>
                    </a-col>
                </a-row>
                <a-empty v-if="categoryFiles.length === 0" :description="$t('media.empty.all')" />
            </a-tab-pane>
        </a-tabs>
    </div>
</template>

<script>
import {
    FileImageOutlined,
    VideoCameraOutlined,
    EyeOutlined,
    DownloadOutlined,
    DeleteOutlined
} from '@ant-design/icons-vue'
import { message } from 'ant-design-vue'
import { mapGetters } from 'vuex'
import { getFileDownloadUrl } from '@/utils/helpers'

export default {
    name: 'Media',
    components: {
        FileImageOutlined,
        VideoCameraOutlined,
        EyeOutlined,
        DownloadOutlined,
        DeleteOutlined
    },
    data() {
        return {
            activeTab: 'all',
            loading: false 
        }
    },
    computed: {
        ...mapGetters(['getFilesByCategory']),
        categoryFiles() {
            return this.getFilesByCategory('Media')
        },
        imageFiles() {
            return this.categoryFiles.filter(file => file.type === 'image')
        },
        videoFiles() {
            return this.categoryFiles.filter(file => file.type === 'video')
        }
    },
    async mounted() {
        this.loading = true
        try {
            await this.$store.dispatch('fetchFiles')
        } catch (error) {
            console.error('Error loading files:', error)
        } finally {
            this.loading = false
        }
    },
    methods: {
        viewFile(file) {
            window.open(file.url, '_blank')
        },
        downloadFile(file) {
            window.open(`/api/files/download/${file.id}`, '_blank')
        },
        deleteFile(file) {
            this.$confirm({
                title: this.$t('common.dialog.deleteTitle'),
                content: this.$t('common.dialog.deleteItemContent', { name: file.name }),
                okText: this.$t('common.dialog.okText'),
                okType: 'danger',
                cancelText: this.$t('common.dialog.cancelText'),
                onOk: async () => {
                    try {
                        await this.$store.dispatch('deleteFile', file.id)
                        message.success(this.$t('files.messages.deleteSuccess'))
                    } catch (error) {
                        message.error(this.$t('files.messages.deleteError'))
                    }
                }
            })
        }
    }
}
</script>

<style scoped>
.media-card {
    height: 100%;
}

.media-preview {
    height: 200px;
    display: flex;
    align-items: center;
    justify-content: center;
}

.image-preview {
    background: linear-gradient(135deg, #a8edea 0%, #fed6e3 100%);
}

.video-preview {
    background: linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%);
}

.media-info {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin: 8px 0;
}

.media-size {
    color: #999;
    font-size: 12px;
}

.media-date {
    color: #999;
    font-size: 12px;
}

.media-tags {
    margin-top: 8px;
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
}
</style>

