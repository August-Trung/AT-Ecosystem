<template>
    <div class="file-upload">
        <a-upload-dragger v-model:file-list="fileList" name="file" :multiple="multiple" :accept="accept"
            :before-upload="beforeUpload" :custom-request="customRequest" @remove="handleRemove" @change="handleChange">
            <p class="ant-upload-drag-icon">
                <InboxOutlined style="color: #1890ff" />
            </p>
            <p class="ant-upload-text">
                {{ $t('files.upload.dragTip') }}
            </p>
            <p class="ant-upload-hint">
                {{ uploadHint }}
            </p>
        </a-upload-dragger>

        <div v-if="showMetaForm && fileList.length > 0" class="meta-form">
            <a-divider>{{ $t('files.upload.title') }}</a-divider>

            <a-form ref="metaFormRef" :model="metaData" :rules="metaRules" layout="vertical">
                <a-form-item :label="$t('files.upload.category')" name="category">
                    <a-select v-model:value="metaData.category" :placeholder="$t('files.filters.category')"
                        size="large">
                        <a-select-option value="IT Support">
                            <ToolOutlined /> {{ $t('common.categories.itSupport') }}
                        </a-select-option>
                        <a-select-option value="Tester">
                            <BugOutlined /> {{ $t('common.categories.tester') }}
                        </a-select-option>
                        <a-select-option value="Web">
                            <CodeOutlined /> {{ $t('common.categories.web') }}
                        </a-select-option>
                        <a-select-option value="Media">
                            <PictureOutlined /> {{ $t('common.categories.media') }}
                        </a-select-option>
                    </a-select>
                </a-form-item>

                <a-form-item :label="$t('links.form.tags')">
                    <a-select v-model:value="metaData.tags" mode="tags" :placeholder="$t('links.form.tagsPlaceholder')"
                        size="large">
                        <a-select-option value="Guide">Guide</a-select-option>
                        <a-select-option value="Testcase">Testcase</a-select-option>
                        <a-select-option value="Documentation">Documentation</a-select-option>
                        <a-select-option value="Report">Report</a-select-option>
                        <a-select-option value="Design">Design</a-select-option>
                        <a-select-option value="Video">Video</a-select-option>
                    </a-select>
                </a-form-item>

                <a-form-item :label="$t('files.upload.visibility')" name="visibility">
                    <a-radio-group v-model:value="metaData.visibility" size="large">
                        <a-radio value="private">{{ $t('common.visibility.private') }}</a-radio>
                        <a-radio value="public">{{ $t('common.visibility.public') }}</a-radio>
                    </a-radio-group>
                </a-form-item>

                <a-form-item :label="$t('files.upload.description')">
                    <a-textarea v-model:value="metaData.description" :rows="3"
                        :placeholder="$t('files.upload.descriptionPlaceholder')"
                        :maxlength="300" show-count />
                </a-form-item>
            </a-form>
        </div>

        <div v-if="uploadProgress > 0 && uploadProgress < 100" class="upload-progress">
            <a-progress :percent="uploadProgress" status="active" />
            <p class="progress-text">{{ $t('files.messages.uploading') }} {{ uploadProgress }}%</p>
        </div>
    </div>
</template>

<script>
import {
    InboxOutlined,
    ToolOutlined,
    BugOutlined,
    CodeOutlined,
    PictureOutlined
} from '@ant-design/icons-vue'
import { message } from 'ant-design-vue'

export default {
    name: 'FileUpload',
    components: {
        InboxOutlined,
        ToolOutlined,
        BugOutlined,
        CodeOutlined,
        PictureOutlined
    },
    props: {
        multiple: {
            type: Boolean,
            default: false
        },
        accept: {
            type: String,
            default: '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png,.gif,.mp4,.avi,.mov'
        },
        maxSize: {
            type: Number,
            default: 100 // MB
        },
        showMetaForm: {
            type: Boolean,
            default: true
        }
    },
    emits: ['upload-success', 'upload-error'],
    data() {
        return {
            fileList: [],
            uploadProgress: 0,
            metaData: {
                category: undefined,
                tags: [],
                description: '',
                visibility: 'private'
            }
        }
    },
    computed: {
        uploadHint() {
            const support = this.$t('files.upload.supportHint')
            const limit = this.$t('files.messages.fileTooLargeWithLimit', { size: this.maxSize })
            return `${support} (${limit})`
        },
        metaRules() {
            return {
                category: [
                    { required: true, message: this.$t('files.validation.category'), trigger: 'change' }
                ],
                visibility: [
                    { required: true, message: this.$t('files.validation.visibility'), trigger: 'change' }
                ]
            }
        }
    },
    methods: {
        beforeUpload(file) {
            const isLtMaxSize = file.size / 1024 / 1024 < this.maxSize
            if (!isLtMaxSize) {
                message.error(this.$t('files.messages.fileTooLargeWithLimit', { size: this.maxSize }))
                return false
            }

            // Validate file type
            const fileExtension = file.name.split('.').pop().toLowerCase()
            const allowedExtensions = this.accept.split(',').map(ext => ext.replace('.', ''))

            if (!allowedExtensions.includes(fileExtension)) {
                message.error(this.$t('files.messages.unsupportedType'))
                return false
            }

            return false // Prevent auto upload
        },
        async customRequest({ file, onSuccess, onError, onProgress }) {
            try {
                await this.$refs.metaFormRef?.validate()
                this.uploadProgress = 0
                const formData = new FormData()
                formData.append('file', file)
                formData.append('category', this.metaData.category)
                formData.append('tags', JSON.stringify(this.metaData.tags))
                formData.append('description', this.metaData.description)
                formData.append('visibility', this.metaData.visibility)

                const response = await this.$store.dispatch('uploadFile', {
                    formData,
                    config: {
                        onUploadProgress: ({ loaded, total }) => {
                            if (!total) return
                            const percent = Math.round((loaded / total) * 100)
                            this.uploadProgress = percent
                            onProgress?.({ percent })
                        }
                    }
                })

                const payload = response?.data || response
                onSuccess(payload)
                this.$emit('upload-success', payload)
                message.success(this.$t('files.messages.uploadSuccess'))
                this.resetForm()
            } catch (error) {
                onError?.(error)
                this.$emit('upload-error', error)
                message.error(error.response?.data?.message || this.$t('files.messages.uploadError'))
                this.uploadProgress = 0
            }
        },
        handleRemove(file) {
            const index = this.fileList.indexOf(file)
            if (index > -1) {
                this.fileList.splice(index, 1)
            }
            this.uploadProgress = 0
        },
        handleChange(info) {
            const { status } = info.file
            if (status === 'done') {
                this.uploadProgress = 0
            } else if (status === 'error') {
                this.uploadProgress = 0
            }
        },
        getFileType(filename) {
            const extension = filename.split('.').pop().toLowerCase()
            const typeMap = {
                pdf: 'pdf',
                doc: 'word',
                docx: 'word',
                xls: 'excel',
                xlsx: 'excel',
                ppt: 'ppt',
                pptx: 'ppt',
                jpg: 'image',
                jpeg: 'image',
                png: 'image',
                gif: 'image',
                mp4: 'video',
                avi: 'video',
                mov: 'video'
            }
            return typeMap[extension] || 'other'
        },
        formatFileSize(bytes) {
            if (bytes < 1024) return bytes + ' B'
            if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
            return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
        },
        resetForm() {
            this.fileList = []
            this.uploadProgress = 0
            this.metaData = {
                category: undefined,
                tags: [],
                description: '',
                visibility: 'private'
            }
            this.$refs.metaFormRef?.resetFields()
        }
    }
}
</script>

<style scoped>
.file-upload {
    width: 100%;
}

.meta-form {
    margin-top: 24px;
}

.upload-progress {
    margin-top: 24px;
    text-align: center;
}

.progress-text {
    margin-top: 8px;
    color: #1890ff;
    font-weight: 500;
}
</style>
