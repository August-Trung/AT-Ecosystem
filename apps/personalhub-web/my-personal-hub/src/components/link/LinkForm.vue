<template>
    <a-form ref="formRef" :model="formData" :rules="formRules" layout="vertical">
        <a-form-item :label="$t('links.form.title')" name="title">
            <a-input v-model:value="formData.title" :placeholder="$t('links.form.titlePlaceholder')" size="large">
                <template #prefix>
                    <FileTextOutlined />
                </template>
            </a-input>
        </a-form-item>

        <a-form-item :label="$t('links.form.originalUrl')" name="originalUrl">
            <a-input v-model:value="formData.originalUrl" :placeholder="$t('links.form.originalUrlPlaceholder')"
                size="large">
                <template #prefix>
                    <LinkOutlined />
                </template>
            </a-input>
            <template #extra>
                {{ $t('links.form.originalUrlHint') }}
            </template>
        </a-form-item>

        <a-form-item :label="$t('links.form.customSlug')" name="customSlug">
            <a-input v-model:value="formData.customSlug" :placeholder="$t('links.form.customSlugPlaceholder')"
                size="large">
                <template #addonBefore>
                    myhub.me/
                </template>
                <template #suffix>
                    <a-tooltip v-if="checkingSlug">
                        <template #title>{{ $t('links.form.slugChecking') }}</template>
                        <LoadingOutlined />
                    </a-tooltip>
                    <a-tooltip v-else-if="slugAvailable">
                        <template #title>{{ $t('links.form.slugAvailable') }}</template>
                        <CheckCircleOutlined style="color: #52c41a" />
                    </a-tooltip>
                </template>
            </a-input>
            <template #extra>
                {{ $t('links.form.customSlugHint') }}
            </template>
        </a-form-item>

        <a-row :gutter="16">
            <a-col :span="12">
                <a-form-item :label="$t('links.form.category')" name="category">
                    <a-select v-model:value="formData.category" :placeholder="$t('links.filters.category')" size="large">
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
            </a-col>

            <a-col :span="12">
                <a-form-item :label="$t('links.form.visibility')" name="visibility">
                    <a-radio-group v-model:value="formData.visibility" size="large">
                        <a-radio-button value="public">
                            <GlobalOutlined /> {{ $t('common.visibility.public') }}
                        </a-radio-button>
                        <a-radio-button value="private">
                            <LockOutlined /> {{ $t('common.visibility.private') }}
                        </a-radio-button>
                    </a-radio-group>
                </a-form-item>
            </a-col>
        </a-row>

        <a-form-item :label="$t('links.form.tags')" name="tags">
            <a-select v-model:value="formData.tags" mode="tags" :placeholder="$t('links.form.tagsPlaceholder')"
                size="large">
                <a-select-option value="Demo">Demo</a-select-option>
                <a-select-option value="Documentation">Documentation</a-select-option>
                <a-select-option value="Testcase">Testcase</a-select-option>
                <a-select-option value="Guide">Guide</a-select-option>
                <a-select-option value="Game">Game</a-select-option>
                <a-select-option value="Report">Report</a-select-option>
            </a-select>
            <template #extra>
                {{ $t('links.form.tagsHint') }}
            </template>
        </a-form-item>

        <a-form-item :label="$t('links.form.description')">
            <a-textarea v-model:value="formData.description" :rows="4"
                :placeholder="$t('links.form.descriptionPlaceholder')"
                :maxlength="500" show-count />
        </a-form-item>

        <a-divider />

        <a-form-item>
            <a-space style="width: 100%; justify-content: flex-end">
                <a-button @click="$emit('cancel')">
                    {{ $t('common.actions.cancel') }}
                </a-button>
                <a-button type="primary" @click="handleSubmit" :loading="submitting">
                    {{ isEdit ? $t('common.actions.save') : $t('links.createButton') }}
                </a-button>
            </a-space>
        </a-form-item>
    </a-form>
</template>

<script>
 import {
     FileTextOutlined,
     LinkOutlined,
     LoadingOutlined,
     CheckCircleOutlined,
     ToolOutlined,
     BugOutlined,
     CodeOutlined,
     PictureOutlined,
     GlobalOutlined,
     LockOutlined
 } from '@ant-design/icons-vue'
import linkService from '@/services/linkService'

export default {
    name: 'LinkForm',
    components: {
        FileTextOutlined,
        LinkOutlined,
        LoadingOutlined,
        CheckCircleOutlined,
        ToolOutlined,
        BugOutlined,
        CodeOutlined,
        PictureOutlined,
        GlobalOutlined,
        LockOutlined
    },
    props: {
        link: {
            type: Object,
            default: null
        },
        isEdit: {
            type: Boolean,
            default: false
        }
    },
    emits: ['submit', 'cancel'],
    data() {
        return {
            formData: {
                title: '',
                originalUrl: '',
                customSlug: '',
                category: undefined,
                tags: [],
                visibility: 'public',
                description: ''
            },
            checkingSlug: false,
            slugAvailable: false,
            submitting: false,
            slugCheckTimeout: null,
            originalSlug: ''
        }
    },
    computed: {
        formRules() {
            return {
                title: [
                    { required: true, message: this.$t('links.validation.title'), trigger: 'blur' }
                ],
                originalUrl: [
                    { required: true, message: this.$t('links.validation.originalUrl'), trigger: 'blur' },
                    { type: 'url', message: this.$t('links.validation.originalUrlInvalid'), trigger: 'blur' }
                ],
                category: [
                    { required: true, message: this.$t('links.validation.category'), trigger: 'change' }
                ]
            }
        }
    },
      watch: {
          'formData.customSlug'(newVal) {
              clearTimeout(this.slugCheckTimeout)
              if (!newVal) {
                  this.slugAvailable = false
                  return
              }
              this.slugCheckTimeout = setTimeout(() => {
                  this.checkSlugAvailability(newVal)
              }, 400)
          },
        link: {
            immediate: true,
            handler(newVal) {
                if (newVal) {
                    this.formData = {
                        title: newVal.title || '',
                        originalUrl: newVal.originalUrl || '',
                        customSlug: newVal.shortUrl ? newVal.shortUrl.replace('myhub.me/', '') : '',
                        category: newVal.category,
                        tags: newVal.tags ? [...newVal.tags] : [],
                        visibility: newVal.visibility || 'public',
                        description: newVal.description || ''
                    }
                    this.originalSlug = this.formData.customSlug
                } else {
                    this.originalSlug = ''
                }
            }
        }
    },
      beforeUnmount() {
          clearTimeout(this.slugCheckTimeout)
      },
      methods: {
        async checkSlugAvailability(slug) {
            this.checkingSlug = true
            if (this.link && slug === this.originalSlug) {
                this.slugAvailable = true
                this.checkingSlug = false
                return
            }
            try {
                const response = await linkService.checkSlug(slug)
                this.slugAvailable = response?.data?.available ?? true
              } catch (error) {
                  console.error('Slug check error:', error)
                  this.slugAvailable = false
              } finally {
                  this.checkingSlug = false
              }
          },
          handleSubmit() {
              this.$refs.formRef.validate().then(() => {
                  this.submitting = true
                  const payload = {
                      ...this.formData,
                      customSlug: this.formData.customSlug.trim()
                  }
                  this.$emit('submit', payload)
                  setTimeout(() => {
                      this.submitting = false
                  }, 1000)
            }).catch(error => {
                console.error('Validation error:', error)
            })
        },
        resetForm() {
            this.$refs.formRef?.resetFields()
            this.formData = {
                title: '',
                originalUrl: '',
                customSlug: '',
                category: undefined,
                tags: [],
                visibility: 'public',
                description: ''
            }
            this.slugAvailable = false
            clearTimeout(this.slugCheckTimeout)
            this.originalSlug = ''
        }
      }
  }
</script>

<style scoped>
/* Additional styles if needed */
</style>
