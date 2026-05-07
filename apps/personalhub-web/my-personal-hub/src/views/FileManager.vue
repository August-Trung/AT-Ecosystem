<template>
    <div class="file-manager">
        <a-page-header :title="$t('files.title')" :sub-title="$t('files.subtitle')">
            <template #extra>
                <a-button type="primary" @click="showUploadModal = true">
                    <template #icon>
                        <UploadOutlined />
                    </template>
                    {{ $t('files.upload.title') }}
                </a-button>
            </template>
        </a-page-header>

        <!-- Filters -->
        <a-card style="margin-top: 24px">
            <a-row :gutter="16">
                <a-col :span="8">
                    <a-input-search v-model:value="searchKeyword" :placeholder="$t('files.filters.search')" allow-clear
                        @search="handleSearch" />
                </a-col>
                <a-col :span="8">
                    <a-select v-model:value="selectedCategory" :placeholder="$t('files.filters.category')" style="width: 100%"
                        allow-clear>
                        <a-select-option v-for="option in categoryOptions" :key="option.value" :value="option.value">
                            {{ option.label }}
                        </a-select-option>
                    </a-select>
                </a-col>
                <a-col :span="8">
                    <a-select v-model:value="selectedFileType" :placeholder="$t('files.filters.type')" style="width: 100%"
                        allow-clear>
                        <a-select-option value="pdf">PDF</a-select-option>
                        <a-select-option value="word">Word</a-select-option>
                        <a-select-option value="excel">Excel</a-select-option>
                        <a-select-option value="ppt">PowerPoint</a-select-option>
                        <a-select-option value="image">Image</a-select-option>
                        <a-select-option value="video">Video</a-select-option>
                    </a-select>
                </a-col>
            </a-row>
        </a-card>

        <!-- View Mode Toggle -->
        <a-card style="margin-top: 24px">
            <a-radio-group v-model:value="viewMode" button-style="solid">
                <a-radio-button value="grid">
                    <AppstoreOutlined /> {{ $t('files.viewMode.grid') }}
                </a-radio-button>
                <a-radio-button value="list">
                    <BarsOutlined /> {{ $t('files.viewMode.list') }}
                </a-radio-button>
            </a-radio-group>
        </a-card>

        <!-- Files Grid View -->
        <a-card v-if="viewMode === 'grid'" style="margin-top: 24px" :loading="loading">
            <a-row :gutter="[16, 16]">
                <a-col v-for="file in filteredFiles" :key="file.id" :xs="24" :sm="12" :md="8" :lg="6">
                    <a-card hoverable class="file-card">
                        <div class="file-icon">
                            <component :is="getFileIcon(file.type)" style="font-size: 48px"
                                :style="{ color: getFileColor(file.type) }" />
                        </div>
                        <div class="file-name" :title="file.name">{{ file.name }}</div>
                        <div class="file-info">
                            <a-tag :color="getCategoryColor(file.category)">
                                {{ categoryLabel(file.category) }}
                            </a-tag>
                            <span class="file-size">{{ file.size }}</span>
                        </div>
                        <div class="file-date">{{ formatDate(file.createdAt) }}</div>
                        <div class="file-actions">
                            <a-space>
                                <a-tooltip :title="$t('files.tooltips.view')">
                                    <a-button type="link" size="small" @click="viewFile(file)">
                                        <EyeOutlined />
                                    </a-button>
                                </a-tooltip>
                                <a-tooltip :title="$t('files.tooltips.download')">
                                    <a-button type="link" size="small" @click="downloadFile(file)">
                                        <DownloadOutlined />
                                    </a-button>
                                </a-tooltip>
                                <a-tooltip :title="$t('files.tooltips.share')">
                                    <a-button type="link" size="small" @click="shareFile(file)">
                                        <ShareAltOutlined />
                                    </a-button>
                                </a-tooltip>
                                <a-tooltip :title="$t('files.tooltips.delete')">
                                    <a-button type="link" danger size="small" @click="deleteFile(file)">
                                        <DeleteOutlined />
                                    </a-button>
                                </a-tooltip>
                            </a-space>
                        </div>
                    </a-card>
                </a-col>
            </a-row>
        </a-card>

        <!-- Files List View -->
        <a-card v-else style="margin-top: 24px" :loading="loading">
            <a-table :columns="tableColumns" :data-source="filteredFiles" :pagination="pagination" row-key="id">
                <template #bodyCell="{ column, record }">
                    <template v-if="column.key === 'name'">
                        <a-space>
                            <component :is="getFileIcon(record.type)" :style="{ color: getFileColor(record.type) }" />
                            <a @click="viewFile(record)">{{ record.name }}</a>
                        </a-space>
                    </template>

                    <template v-else-if="column.key === 'category'">
                        <a-tag :color="getCategoryColor(record.category)">
                            {{ categoryLabel(record.category) }}
                        </a-tag>
                    </template>

                    <template v-else-if="column.key === 'tags'">
                        <a-space>
                            <a-tag v-for="tag in record.tags" :key="tag">{{ tag }}</a-tag>
                        </a-space>
                    </template>

                    <template v-else-if="column.key === 'type'">
                        <component :is="getFileIcon(record.type)" style="font-size: 48px"
                            :style="{ color: getFileColor(record.type) }" />
                    </template>

                    <template v-else-if="column.key === 'size'">
                        {{ record.size }}
                    </template>

                    <template v-else-if="column.key === 'createdAt'">
                        {{ formatDate(record.createdAt) }}
                    </template>

                    <template v-else-if="column.key === 'action'">
                        <a-space>
                            <a-tooltip :title="$t('files.tooltips.view')">
                                <a-button type="link" size="small" @click="viewFile(record)">
                                    <EyeOutlined />
                                </a-button>
                            </a-tooltip>
                            <a-tooltip :title="$t('files.tooltips.download')">
                                <a-button type="link" size="small" @click="downloadFile(record)">
                                    <DownloadOutlined />
                                </a-button>
                            </a-tooltip>
                            <a-tooltip :title="$t('files.tooltips.share')">
                                <a-button type="link" size="small" @click="shareFile(record)">
                                    <ShareAltOutlined />
                                </a-button>
                            </a-tooltip>
                            <a-tooltip :title="$t('files.tooltips.delete')">
                                <a-button type="link" danger size="small" @click="deleteFile(record)">
                                    <DeleteOutlined />
                                </a-button>
                            </a-tooltip>
                        </a-space>
                    </template>
                </template>
            </a-table>
        </a-card>

        <!-- Upload Modal -->
        <a-modal v-model:open="showUploadModal" :title="$t('files.upload.title')" width="600px" @ok="handleUpload"
            @cancel="handleCancelUpload" :confirm-loading="uploading">
            <a-form ref="uploadFormRef" :model="uploadFormData" :rules="uploadRules" layout="vertical">
                <a-form-item :label="$t('files.upload.selectFile')" name="file">
                    <a-upload-dragger v-model:file-list="fileList" name="file" :multiple="false"
                        :before-upload="beforeUpload" @remove="handleRemove">
                        <p class="ant-upload-drag-icon">
                            <InboxOutlined />
                        </p>
                        <p class="ant-upload-text">{{ $t('files.upload.dragTip') }}</p>
                        <p class="ant-upload-hint">
                            {{ $t('files.upload.supportHint') }}
                        </p>
                    </a-upload-dragger>
                </a-form-item>

                <a-form-item :label="$t('files.upload.category')" name="category">
                    <a-select v-model:value="uploadFormData.category" :placeholder="$t('files.filters.category')">
                        <a-select-option v-for="option in categoryOptions" :key="option.value" :value="option.value">
                            {{ option.label }}
                        </a-select-option>
                    </a-select>
                </a-form-item>

                <a-form-item :label="$t('files.upload.tags')" name="tags">
                    <a-select v-model:value="uploadFormData.tags" mode="tags" :placeholder="$t('links.form.tagsPlaceholder')">
                        <a-select-option value="Guide">Guide</a-select-option>
                        <a-select-option value="Testcase">Testcase</a-select-option>
                        <a-select-option value="Documentation">Documentation</a-select-option>
                        <a-select-option value="Report">Report</a-select-option>
                    </a-select>
                </a-form-item>

                <a-form-item :label="$t('files.upload.visibility')" name="visibility">
                    <a-radio-group v-model:value="uploadFormData.visibility">
                        <a-radio value="private">{{ $t('common.visibility.private') }}</a-radio>
                        <a-radio value="public">{{ $t('common.visibility.public') }}</a-radio>
                    </a-radio-group>
                </a-form-item>

                <a-form-item :label="$t('files.upload.description')">
                    <a-textarea v-model:value="uploadFormData.description" :rows="3"
                        :placeholder="$t('files.upload.descriptionPlaceholder')" />
                </a-form-item>
            </a-form>
        </a-modal>

        <!-- Share Modal -->
        <a-modal v-model:open="showShareModal" :title="$t('files.share.title')" width="500px" @ok="handleShare"
            @cancel="showShareModal = false">
            <div v-if="shareFileData">
                <p><strong>{{ $t('files.share.fileLabel') }}:</strong> {{ shareFileData.name }}</p>
                <a-divider />
                <a-form-item :label="$t('files.share.linkLabel')">
                    <a-input :value="shareFileData.url" readonly addon-after="<CopyOutlined />">
                        <template #addonAfter>
                            <CopyOutlined style="cursor: pointer" @click="copyShareLink(shareFileData.url)" />
                        </template>
                    </a-input>
                </a-form-item>
                <a-form-item :label="$t('files.share.permissionLabel')">
                    <a-radio-group v-model:value="sharePermission">
                        <a-radio value="public">{{ $t('common.visibility.public') }}</a-radio>
                        <a-radio value="private">{{ $t('common.visibility.private') }}</a-radio>
                    </a-radio-group>
                </a-form-item>
            </div>
        </a-modal>
    </div>
</template>

<script>
import {
    UploadOutlined,
    AppstoreOutlined,
    BarsOutlined,
    EyeOutlined,
    DownloadOutlined,
    ShareAltOutlined,
    DeleteOutlined,
    InboxOutlined,
    CopyOutlined,
    FileTextOutlined,
    FileWordOutlined,
    FileExcelOutlined,
    FilePptOutlined,
    FilePdfOutlined,
    FileImageOutlined,
    VideoCameraOutlined
} from '@ant-design/icons-vue'
import { message } from 'ant-design-vue'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import 'dayjs/locale/vi'
import 'dayjs/locale/en'
import { getFileDownloadUrl } from '@/utils/helpers'

dayjs.extend(relativeTime)
dayjs.locale('vi')

export default {
    name: 'FileManager',
    components: {
        UploadOutlined,
        AppstoreOutlined,
        BarsOutlined,
        EyeOutlined,
        DownloadOutlined,
        ShareAltOutlined,
        DeleteOutlined,
        InboxOutlined,
        CopyOutlined,
        FileTextOutlined,
        FileWordOutlined,
        FileExcelOutlined,
        FilePptOutlined,
        FilePdfOutlined,
        FileImageOutlined,
        VideoCameraOutlined
    },
    data() {
        return {
            loading: false,
            viewMode: 'grid',
            showUploadModal: false,
            showShareModal: false,
            uploading: false,
            shareFileData: null,
            sharePermission: 'private',
            searchKeyword: this.$store.state.searchKeyword,
            selectedCategory: undefined,
            selectedFileType: undefined,
            fileList: [],
            uploadFormData: {
                category: undefined,
                tags: [],
                description: '',
                visibility: 'private'
            },
            pagination: {
                current: 1,
                pageSize: 10,
                total: 0
            }
        }
    },
    computed: {
        currentLanguage() {
            return (this.$store.state.settings?.general?.language || 'vi').toLowerCase()
        },
        categoryOptions() {
            return [
                { value: 'IT Support', label: this.$t('common.categories.itSupport') },
                { value: 'Tester', label: this.$t('common.categories.tester') },
                { value: 'Web', label: this.$t('common.categories.web') },
                { value: 'Media', label: this.$t('common.categories.media') }
            ]
        },
        tableColumns() {
            return [
                { title: this.$t('files.table.name'), dataIndex: 'name', key: 'name', width: 220 },
                { title: this.$t('files.table.type'), dataIndex: 'type', key: 'type', width: 100 },
                { title: this.$t('files.table.category'), dataIndex: 'category', key: 'category', width: 150 },
                { title: this.$t('files.table.tags'), dataIndex: 'tags', key: 'tags', width: 200 },
                { title: this.$t('files.table.size'), dataIndex: 'size', key: 'size', width: 120 },
                { title: this.$t('files.table.createdAt'), dataIndex: 'createdAt', key: 'createdAt', width: 140 },
                { title: this.$t('files.table.actions'), key: 'action', fixed: 'right', width: 200 }
            ]
        },
        uploadRules() {
            return {
                category: [{ required: true, message: this.$t('files.validation.category') }],
                visibility: [{ required: true, message: this.$t('files.validation.visibility') }]
            }
        },
        filteredFiles() {
            let filtered = this.$store.getters.filteredFiles

            if (this.selectedCategory) {
                filtered = filtered.filter(file => file.category === this.selectedCategory)
            }

            if (this.selectedFileType) {
                filtered = filtered.filter(file => file.type === this.selectedFileType)
            }

            return filtered
        }
    },
    watch: {
        searchKeyword(value) {
            this.$store.commit('SET_SEARCH_KEYWORD', value || '')
        },
        filteredFiles: {
            immediate: true,
            handler(files) {
                this.pagination.total = files.length
            }
        },
        currentLanguage: {
            immediate: true,
            handler(lang) {
                dayjs.locale(lang === 'en' ? 'en' : 'vi')
            }
        }
    },
    mounted() {
        this.loadFiles()
    },
    methods: {
        async loadFiles() {
            this.loading = true
            try {
                await this.$store.dispatch('fetchFiles')
                this.pagination.total = this.filteredFiles.length
            } catch (error) {
                console.error('Error loading files:', error)
                this.$message.error(this.$t('files.messages.loadError'))
            } finally {
                this.loading = false
            }
        },
        handleSearch() {
            // Search handled by watcher
        },
        beforeUpload(file) {
            const isLt100M = file.size / 1024 / 1024 < 100
            if (!isLt100M) {
                message.error(this.$t('files.messages.fileTooLarge'))
            }
            return false
        },
        handleRemove() {
            this.fileList = []
        },
        async handleUpload() {
            if (this.uploading) return
            this.uploading = true
            const hideMessage = this.$message.loading(this.$t('files.messages.uploading'), 0)
            try {
                await this.$refs.uploadFormRef.validate()

                if (this.fileList.length === 0) {
                    this.$message.error(this.$t('files.validation.fileRequired'))
                    return
                }

                const formData = new FormData()
                formData.append('file', this.fileList[0].originFileObj)
                formData.append('category', this.uploadFormData.category)
                formData.append('tags', JSON.stringify(this.uploadFormData.tags))
                formData.append('description', this.uploadFormData.description)
                formData.append('visibility', this.uploadFormData.visibility)

                await this.$store.dispatch('uploadFile', formData)
                this.$message.success(this.$t('files.messages.uploadSuccess'))
                this.handleCancelUpload()
                await this.loadFiles()
            } catch (error) {
                console.error('Upload error:', error)
                this.$message.error(error.response?.data?.message || this.$t('files.messages.uploadError'))
            } finally {
                hideMessage()
                this.uploading = false
            }
        },
        handleCancelUpload() {
            this.showUploadModal = false
            this.fileList = []
            this.uploadFormData = {
                category: undefined,
                tags: [],
                description: '',
                visibility: 'private'
            }
            this.$refs.uploadFormRef?.resetFields()
        },
        viewFile(file) {
            window.open(file.url, '_blank')
        },
        downloadFile(file) {
            window.open(`/api/files/download/${file.id}`, '_blank')
        },
        shareFile(file) {
            const latest =
                this.$store.state.files.find((f) => f.id === file.id) || file
            this.shareFileData = { ...latest }
            this.sharePermission = this.shareFileData.visibility || 'private'
            this.showShareModal = true
        },
        async handleShare() {
            if (!this.shareFileData) return
            try {
                await this.$store.dispatch('updateFile', {
                    id: this.shareFileData.id,
                    data: { visibility: this.sharePermission }
                })
                this.$message.success(this.$t('files.messages.shareUpdateSuccess'))
                this.shareFileData = {
                    ...this.shareFileData,
                    visibility: this.sharePermission
                }
                this.showShareModal = false
            } catch (error) {
                console.error('Share update error:', error)
                this.$message.error(this.$t('files.messages.shareUpdateError'))
            }
        },
        copyShareLink(url) {
            navigator.clipboard.writeText(url)
            message.success(this.$t('common.messages.copySuccess'))
        },
        deleteFile(file) {
            this.$confirm({
                title: this.$t('common.dialog.deleteTitle'),
                content: this.$t('common.dialog.deleteFileContent', { name: file.name }),
                okText: this.$t('common.dialog.okText'),
                okType: 'danger',
                cancelText: this.$t('common.dialog.cancelText'),
                onOk: async () => {
                    try {
                        await this.$store.dispatch('deleteFile', file.id)
                        this.$message.success(this.$t('files.messages.deleteSuccess'))
                        await this.loadFiles()
                    } catch (error) {
                        this.$message.error(this.$t('files.messages.deleteError'))
                    }
                }
            })
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
        getCategoryColor(category) {
            const colors = {
                'IT Support': 'blue',
                'Tester': 'green',
                'Web': 'purple',
                'Media': 'orange'
            }
            return colors[category] || 'default'
        },
        formatFileSize(bytes) {
            if (bytes < 1024) return bytes + ' B'
            if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
            return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
        },
        formatDate(date) {
            if (!date) return ''
            return dayjs(date).format('DD/MM/YYYY HH:mm')
        }
    }
}
</script>

<style scoped>
.file-manager {
    padding: 0;
}

.file-card {
    text-align: center;
    transition: all 0.3s;
}

.file-card:hover {
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.file-icon {
    padding: 20px 0;
}

.file-name {
    font-weight: 500;
    margin: 12px 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.file-info {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin: 8px 0;
}

.file-size {
    color: #999;
    font-size: 12px;
}

.file-date {
    color: #999;
    font-size: 12px;
    margin-bottom: 12px;
}

.file-actions {
    border-top: 1px solid #f0f0f0;
    padding-top: 12px;
}
</style>


