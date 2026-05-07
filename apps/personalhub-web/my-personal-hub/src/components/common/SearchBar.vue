<template>
    <div class="search-bar">
        <a-input-search v-model:value="searchValue" :placeholder="placeholder || $t('app.searchPlaceholder')"
            :size="size" :loading="loading"
            allow-clear @search="handleSearch" @change="handleChange">
            <template #prefix>
                <SearchOutlined />
            </template>
        </a-input-search>
    </div>
</template>

<script>
import { SearchOutlined } from '@ant-design/icons-vue'

export default {
    name: 'SearchBar',
    components: {
        SearchOutlined
    },
    props: {
        placeholder: {
            type: String,
            default: null
        },
        size: {
            type: String,
            default: 'default'
        },
        loading: {
            type: Boolean,
            default: false
        },
        modelValue: {
            type: String,
            default: ''
        }
    },
    emits: ['update:modelValue', 'search'],
    data() {
        return {
            searchValue: this.modelValue
        }
    },
    watch: {
        modelValue(newVal) {
            this.searchValue = newVal
        }
    },
    methods: {
        handleSearch(value) {
            this.$emit('search', value)
            this.$emit('update:modelValue', value)
        },
        handleChange(e) {
            const value = e.target.value
            this.$emit('update:modelValue', value)
        }
    }
}
</script>

<style scoped>
.search-bar {
    width: 100%;
}
</style>
