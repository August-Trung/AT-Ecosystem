<template>
    <div class="link-manager">
        <a-page-header :title="$t('links.title')" :sub-title="$t('links.subtitle')">
            <template #extra>
                <a-button type="primary" @click="showModal = true">
                    <template #icon>
                        <PlusOutlined />
                    </template>
                    {{ $t('links.createButton') }}
                </a-button>
            </template>
        </a-page-header>

        <!-- Filters -->
        <a-card style="margin-top: 24px">
            <a-row :gutter="16">
                <a-col :span="8">
                    <a-input-search v-model:value="searchKeyword" :placeholder="$t('links.filters.search')" allow-clear
                        @search="handleSearch" />
                </a-col>
                <a-col :span="8">
                    <a-select v-model:value="selectedCategory" :placeholder="$t('links.filters.category')"
                        style="width: 100%" allow-clear>
                        <a-select-option v-for="option in categoryOptions" :key="option.value" :value="option.value">
                            {{ option.label }}
                        </a-select-option>
                    </a-select>
                </a-col>
                <a-col :span="8">
                    <a-select v-model:value="selectedTags" mode="multiple" :placeholder="$t('links.filters.tags')"
                        style="width: 100%" allow-clear>
                        <a-select-option value="Demo">Demo</a-select-option>
                        <a-select-option value="Documentation">Documentation</a-select-option>
                        <a-select-option value="Testcase">Testcase</a-select-option>
                        <a-select-option value="Guide">Guide</a-select-option>
                        <a-select-option value="Game">Game</a-select-option>
                    </a-select>
                </a-col>
            </a-row>
        </a-card>

        <!-- Links List -->
        <a-card style="margin-top: 24px" :loading="loading">
            <a-table :columns="tableColumns" :data-source="filteredLinks" :pagination="pagination" row-key="id">
                <template #bodyCell="{ column, record }">
                    <template v-if="column.key === 'title'">
                        <a @click="viewLink(record)">{{ record.title }}</a>
                    </template>

                    <template v-if="column.key === 'shortUrl'">
                        <a-space>
                            <a-tag color="blue" style="cursor: pointer" @click="copyLink(record.shortUrl)">
                                {{ record.shortUrl }}
                            </a-tag>
                            <CopyOutlined style="cursor: pointer; color: #1890ff" @click="copyLink(record.shortUrl)" />
                        </a-space>
                    </template>

                    <template v-if="column.key === 'category'">
                        <a-tag :color="getCategoryColor(record.category)">
                            {{ record.category }}
                        </a-tag>
                    </template>

                    <template v-if="column.key === 'tags'">
                        <a-space>
                            <a-tag v-for="tag in record.tags" :key="tag">{{ tag }}</a-tag>
                        </a-space>
                    </template>

                    <template v-if="column.key === 'visits'">
                        <a-statistic :value="record.visits" :value-style="{ fontSize: '14px' }">
                            <template #prefix>
                                <EyeOutlined style="font-size: 12px" />
                            </template>
                        </a-statistic>
                    </template>

                    <template v-if="column.key === 'action'">
                        <a-space>
                            <a-tooltip :title="$t('links.tooltips.view')">
                                <a-button type="link" size="small" @click="viewLink(record)">
                                    <EyeOutlined />
                                </a-button>
                            </a-tooltip>
                            <a-tooltip :title="$t('links.tooltips.edit')">
                                <a-button type="link" size="small" @click="editLink(record)">
                                    <EditOutlined />
                                </a-button>
                            </a-tooltip>
                            <a-tooltip :title="$t('links.tooltips.delete')">
                                <a-button type="link" danger size="small" @click="deleteLink(record)">
                                    <DeleteOutlined />
                                </a-button>
                            </a-tooltip>
                        </a-space>
                    </template>
                </template>
            </a-table>
        </a-card>

        <!-- Create/Edit Link Modal -->
        <a-modal v-model:open="showModal"
            :title="editingLink ? $t('links.modal.editTitle') : $t('links.modal.createTitle')" width="600px"
            @ok="handleSubmit" @cancel="handleCancel">
            <a-form ref="formRef" :model="formData" :rules="formRules" layout="vertical">
                <a-form-item :label="$t('links.form.title')" name="title">
                    <a-input v-model:value="formData.title" :placeholder="$t('links.form.titlePlaceholder')" />
                </a-form-item>

                <a-form-item :label="$t('links.form.originalUrl')" name="originalUrl">
                    <a-input v-model:value="formData.originalUrl"
                        :placeholder="$t('links.form.originalUrlPlaceholder')" />
                </a-form-item>

                <a-form-item :label="$t('links.form.customSlug')" name="customSlug">
                    <a-input v-model:value="formData.customSlug" addon-before="myhub.me/"
                        :placeholder="$t('links.form.customSlugPlaceholder')" />
                </a-form-item>


                <a-form-item :label="$t('links.form.category')" name="category">
                    <a-select v-model:value="formData.category" :placeholder="$t('links.filters.category')">
                        <a-select-option v-for="option in categoryOptions" :key="option.value" :value="option.value">
                            {{ option.label }}
                        </a-select-option>
                    </a-select>
                </a-form-item>

                <a-form-item :label="$t('links.form.tags')" name="tags">
                    <a-select v-model:value="formData.tags" mode="tags" :placeholder="$t('links.form.tagsPlaceholder')">
                        <a-select-option value="Demo">Demo</a-select-option>
                        <a-select-option value="Documentation">Documentation</a-select-option>
                        <a-select-option value="Testcase">Testcase</a-select-option>
                        <a-select-option value="Guide">Guide</a-select-option>
                    </a-select>
                </a-form-item>

                <a-form-item :label="$t('links.form.visibility')" name="visibility">
                    <a-radio-group v-model:value="formData.visibility">
                        <a-radio value="public">{{ $t('common.visibility.public') }}</a-radio>
                        <a-radio value="private">{{ $t('common.visibility.private') }}</a-radio>
                    </a-radio-group>
                </a-form-item>

                <a-form-item :label="$t('links.form.description')">
                    <a-textarea v-model:value="formData.description" :rows="3"
                        :placeholder="$t('links.form.descriptionPlaceholder')" />
                </a-form-item>
            </a-form>
        </a-modal>
    </div>
</template>

<script>
import {
    PlusOutlined,
    CopyOutlined,
    EyeOutlined,
    EditOutlined,
    DeleteOutlined
} from '@ant-design/icons-vue'
import { getLinkRedirectUrl, getLinkSlug } from '@/utils/helpers'
export default {
    name: 'LinkManager',
    components: {
        PlusOutlined,
        CopyOutlined,
        EyeOutlined,
        EditOutlined,
        DeleteOutlined
    },
    data() {
        return {
            loading: false,
            showModal: false,
            editingLink: null,
            searchKeyword: '',
            selectedCategory: undefined,
            selectedTags: [],
            formData: {
                title: '',
                originalUrl: '',
                customSlug: '',
                category: undefined,
                tags: [],
                visibility: 'public',
                description: ''
            },
            pagination: {
                current: 1,
                pageSize: 10,
                total: 0
            }
        }
    },
    computed: {
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
                { title: this.$t('links.table.title'), dataIndex: 'title', key: 'title', width: 200 },
                { title: this.$t('links.table.shortUrl'), dataIndex: 'shortUrl', key: 'shortUrl', width: 200 },
                { title: this.$t('links.table.category'), dataIndex: 'category', key: 'category', width: 120 },
                { title: this.$t('links.table.tags'), dataIndex: 'tags', key: 'tags', width: 200 },
                { title: this.$t('links.table.visits'), dataIndex: 'visits', key: 'visits', width: 120 },
                { title: this.$t('links.table.createdAt'), dataIndex: 'createdAt', key: 'createdAt', width: 140 },
                { title: this.$t('links.table.actions'), key: 'action', fixed: 'right', width: 150 }
            ]
        },
        formRules() {
            return {
                title: [{ required: true, message: this.$t('links.validation.title') }],
                originalUrl: [
                    { required: true, message: this.$t('links.validation.originalUrl') },
                    { type: 'url', message: this.$t('links.validation.originalUrlInvalid') }
                ],
                category: [{ required: true, message: this.$t('links.validation.category') }],
            }
        },
        filteredLinks() {
            let filtered = this.$store.getters.filteredLinks

            if (this.selectedCategory) {
                filtered = filtered.filter(link => link.category === this.selectedCategory)
            }

            if (this.selectedTags.length > 0) {
                filtered = filtered.filter(link =>
                    link.tags.some(tag => this.selectedTags.includes(tag))
                )
            }

            return filtered
        }
    },
    watch: {
        searchKeyword(value) {
            this.$store.commit('SET_SEARCH_KEYWORD', value || '')
        },
        selectedTags(value) {
            this.$store.commit('SET_SELECTED_TAGS', value || [])
        },
        filteredLinks: {
            immediate: true,
            handler(links) {
                this.pagination.total = links.length
            }
        }
    },
    created() {
        this.searchKeyword = this.$store.state.searchKeyword
        this.selectedTags = [...this.$store.state.selectedTags]
    },
    mounted() {
        this.loadLinks()
    },
    methods: {
        async loadLinks() {
            this.loading = true
            try {
                await this.$store.dispatch('fetchLinks')
                this.pagination.total = this.filteredLinks.length
            } catch (error) {
                console.error('Error loading links:', error)
                this.$message.error(this.$t('links.messages.loadError'))
            } finally {
                this.loading = false
            }
        },
        handleSearch() {
            // Search handled via watcher/state binding
        },
        viewLink(record) {
            const url = getLinkRedirectUrl(record) || record.originalUrl
            if (url) {
                window.open(url, '_blank')
            }
        },
        editLink(record) {
            this.editingLink = record
            const customSlug = getLinkSlug(record) || ''
            this.formData = {
                title: record.title,
                originalUrl: record.originalUrl,
                shortUrl: record.shortUrl,
                customSlug,
                category: record.category,
                tags: Array.isArray(record.tags) ? [...record.tags] : [],
                visibility: record.visibility || 'public',
                description: record.description || ''
            }
            this.showModal = true
        },
        async deleteLink(record) {
            this.$confirm({
                title: this.$t('common.dialog.deleteTitle'),
                content: this.$t('common.dialog.deleteLinkContent', { name: record.title }),
                okText: this.$t('common.dialog.okText'),
                okType: 'danger',
                cancelText: this.$t('common.dialog.cancelText'),
                onOk: async () => {
                    try {
                        await this.$store.dispatch('deleteLink', record.id)
                        this.$message.success(this.$t('links.messages.deleteSuccess'))
                        await this.loadLinks()
                    } catch (error) {
                        console.error('Delete error:', error)
                        this.$message.error(this.$t('links.messages.deleteError'))
                    }
                }
            })
        },
        copyLink(shortUrl) {
            const fullUrl = shortUrl.startsWith('http') ? shortUrl : `https://${shortUrl}`
            navigator.clipboard.writeText(fullUrl)
            this.$message.success(this.$t('links.messages.copySuccess'))
        },
        async handleSubmit() {
            try {
                await this.$refs.formRef.validate()
                const customSlug = this.formData.customSlug?.trim() || ''
                const payload = {
                    ...this.formData,
                    customSlug: customSlug || null,
                    shortUrl: customSlug ? `myhub.me/${customSlug}` : null
                }

                if (this.editingLink) {
                    await this.$store.dispatch('updateLink', {
                        id: this.editingLink.id,
                        data: payload
                    })
                    this.$message.success(this.$t('links.messages.updateSuccess'))
                } else {
                    await this.$store.dispatch('createLink', payload)
                    this.$message.success(this.$t('links.messages.createSuccess'))
                }

                this.handleCancel()
                await this.loadLinks()
            } catch (error) {
                console.error('Submit error:', error)
                const errorMsg = error.response?.data?.message || error.message || this.$t('links.messages.error')
                this.$message.error(errorMsg)
            }
        },
        handleCancel() {
            this.showModal = false
            this.editingLink = null
            this.formData = {
                title: '',
                originalUrl: '',
                customSlug: '',
                category: undefined,
                tags: [],
                visibility: 'public',
                description: ''
            }
            this.$refs.formRef?.resetFields()
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
.link-manager {
    padding: 0;
}
</style>
