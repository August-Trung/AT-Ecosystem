<template>
    <div class="tag-filter">
        <div class="filter-header">
            <span class="filter-title">
                <TagOutlined /> {{ $t('links.table.tags') }}
            </span>
            <a-button v-if="selectedTags.length > 0" type="link" size="small" @click="clearAll">
                {{ $t('common.actions.clearAll') }}
            </a-button>
        </div>

        <div class="tag-list">
            <a-checkable-tag v-for="tag in availableTags" :key="tag" :checked="selectedTags.includes(tag)"
                @change="checked => handleChange(tag, checked)">
                {{ tag }}
            </a-checkable-tag>
        </div>

        <div v-if="showCustomInput" class="custom-tag-input">
            <a-input v-model:value="customTag" :placeholder="$t('links.form.tagsPlaceholder')" size="small"
                @pressEnter="addCustomTag">
                <template #suffix>
                    <PlusOutlined style="cursor: pointer" @click="addCustomTag" />
                </template>
            </a-input>
        </div>
    </div>
</template>

<script>
import { TagOutlined, PlusOutlined } from '@ant-design/icons-vue'

export default {
    name: 'TagFilter',
    components: {
        TagOutlined,
        PlusOutlined
    },
    props: {
        availableTags: {
            type: Array,
            default: () => ['Demo', 'Documentation', 'Testcase', 'Guide', 'Game', 'Report', 'Design', 'Video']
        },
        modelValue: {
            type: Array,
            default: () => []
        },
        showCustomInput: {
            type: Boolean,
            default: false
        }
    },
    emits: ['update:modelValue', 'change'],
    data() {
        return {
            selectedTags: [...this.modelValue],
            customTag: ''
        }
    },
    watch: {
        modelValue(newVal) {
            this.selectedTags = [...newVal]
        }
    },
    methods: {
        handleChange(tag, checked) {
            if (checked) {
                this.selectedTags.push(tag)
            } else {
                this.selectedTags = this.selectedTags.filter(t => t !== tag)
            }
            this.emitChange()
        },
        clearAll() {
            this.selectedTags = []
            this.emitChange()
        },
        addCustomTag() {
            if (this.customTag && !this.selectedTags.includes(this.customTag)) {
                this.selectedTags.push(this.customTag)
                this.emitChange()
                this.customTag = ''
            }
        },
        emitChange() {
            this.$emit('update:modelValue', this.selectedTags)
            this.$emit('change', this.selectedTags)
        }
    }
}
</script>

<style scoped>
.tag-filter {
    padding: 16px;
    background: #fafafa;
    border-radius: 8px;
}

.filter-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
}

.filter-title {
    font-weight: 500;
    display: flex;
    align-items: center;
    gap: 8px;
}

.tag-list {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
}

.custom-tag-input {
    margin-top: 12px;
}
</style>
