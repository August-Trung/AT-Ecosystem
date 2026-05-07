<template>
    <div class="sidebar">
        <a-menu v-model:selectedKeys="selectedKeys" mode="inline" :inline-collapsed="collapsed"
            style="border-right: none" @click="handleMenuClick">
            <a-menu-item key="/">
                <template #icon>
                    <DashboardOutlined />
                </template>
                <span>{{ $t('sidebar.dashboard') }}</span>
            </a-menu-item>

            <a-menu-divider />

            <a-menu-item-group :title="$t('sidebar.manageGroup')">
                <a-menu-item key="/links">
                    <template #icon>
                        <LinkOutlined />
                    </template>
                    <span>{{ $t('sidebar.links') }}</span>
                </a-menu-item>

                <a-menu-item key="/files">
                    <template #icon>
                        <FolderOutlined />
                    </template>
                    <span>{{ $t('sidebar.files') }}</span>
                </a-menu-item>
            </a-menu-item-group>

            <a-menu-divider />

            <a-menu-item-group :title="$t('sidebar.categoryGroup')">
                <a-menu-item key="/it-support">
                    <template #icon>
                        <ToolOutlined />
                    </template>
                    <span>{{ $t('sidebar.itSupport') }}</span>
                </a-menu-item>

                <a-menu-item key="/tester">
                    <template #icon>
                        <BugOutlined />
                    </template>
                    <span>{{ $t('sidebar.tester') }}</span>
                </a-menu-item>

                <a-menu-item key="/web-projects">
                    <template #icon>
                        <CodeOutlined />
                    </template>
                    <span>{{ $t('sidebar.webProjects') }}</span>
                </a-menu-item>

                <a-menu-item key="/media">
                    <template #icon>
                        <PictureOutlined />
                    </template>
                    <span>{{ $t('sidebar.media') }}</span>
                </a-menu-item>
            </a-menu-item-group>

            <a-menu-divider />

            <a-menu-item key="/settings">
                <template #icon>
                    <SettingOutlined />
                </template>
                <span>{{ $t('sidebar.settings') }}</span>
            </a-menu-item>
        </a-menu>
    </div>
</template>

<script>
import {
    DashboardOutlined,
    LinkOutlined,
    FolderOutlined,
    ToolOutlined,
    BugOutlined,
    CodeOutlined,
    PictureOutlined,
    SettingOutlined
} from '@ant-design/icons-vue'

export default {
    name: 'Sidebar',
    components: {
        DashboardOutlined,
        LinkOutlined,
        FolderOutlined,
        ToolOutlined,
        BugOutlined,
        CodeOutlined,
        PictureOutlined,
        SettingOutlined
    },
    props: {
        collapsed: {
            type: Boolean,
            default: false
        }
    },
    data() {
        return {
            selectedKeys: [this.$route.path]
        }
    },
    watch: {
        '$route.path'(newPath) {
            this.selectedKeys = [newPath]
        }
    },
    methods: {
        handleMenuClick({ key }) {
            if (key !== this.$route.path) {
                this.$router.push(key)
            }
        }
    }
}
</script>

<style scoped>
.sidebar {
    padding-top: 16px;
}
</style>
