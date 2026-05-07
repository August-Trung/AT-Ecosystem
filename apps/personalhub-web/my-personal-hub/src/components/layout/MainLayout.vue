<template>
    <a-layout style="min-height: 100vh">
        <!-- Header -->
        <a-layout-header class="header">
            <div class="header-content">
                <div class="logo">
                    <FileTextOutlined style="font-size: 24px; color: #1890ff" />
                    <span class="logo-text">{{ $t('app.title') }}</span>
                </div>

                <div class="header-actions">
                    <a-button type="text" class="collapse-toggle" @click="toggleSidebar">
                        <template #icon>
                            <component :is="collapsed ? MenuUnfoldOutlined : MenuFoldOutlined" />
                        </template>
                    </a-button>
                    <a-input-search v-model:value="searchKeyword" :placeholder="$t('app.searchPlaceholder')"
                        style="width: 300px; margin-right: 16px" @search="handleSearch" />

                    <a-badge :count="5">
                        <BellOutlined style="font-size: 20px; cursor: pointer" />
                    </a-badge>

                    <div class="user-info">
                        <span class="user-name">{{ userName }}</span>
                        <a-dropdown>
                            <a-avatar style="background-color: #1890ff; margin-left: 8px; cursor: pointer">
                                <template #icon>
                                    <UserOutlined />
                                </template>
                            </a-avatar>
                            <template #overlay>
                                <a-menu @click="handleMenuClick">
                                    <a-menu-item key="profile">
                                        <UserOutlined /> {{ $t('menu.profile') }}
                                    </a-menu-item>
                                    <a-menu-item key="settings">
                                        <SettingOutlined /> {{ $t('menu.settings') }}
                                    </a-menu-item>
                                    <a-menu-divider />
                                    <a-menu-item key="logout">
                                        <LogoutOutlined /> {{ $t('menu.logout') }}
                                    </a-menu-item>
                                </a-menu>
                            </template>
                        </a-dropdown>
                    </div>
                </div>
            </div>
        </a-layout-header>

        <a-layout>
            <!-- Sidebar -->
            <a-layout-sider v-model:collapsed="collapsed" :trigger="null" collapsible width="250"
                style="background: #fff">
                <Sidebar :collapsed="collapsed" />
            </a-layout-sider>

            <!-- Content -->
            <a-layout-content class="main-content">
                <div class="content-wrapper">
                    <router-view />
                </div>
            </a-layout-content>
        </a-layout>
    </a-layout>
</template>

<script>
import {
    FileTextOutlined,
    BellOutlined,
    UserOutlined,
    SettingOutlined,
    LogoutOutlined,
    MenuFoldOutlined,
    MenuUnfoldOutlined
} from '@ant-design/icons-vue'
import Sidebar from './Sidebar.vue'

export default {
    name: 'MainLayout',
    components: {
        FileTextOutlined,
        BellOutlined,
        UserOutlined,
        SettingOutlined,
        LogoutOutlined,
        MenuFoldOutlined,
        MenuUnfoldOutlined,
        Sidebar
    },
    data() {
        return {
            collapsed: this.$store.state.settings?.preferences?.sidebarCollapsed ?? false,
            searchKeyword: ''
        }
    },
    computed: {
        user() {
            return this.$store.state.user
        },
        userName() {
            return this.user?.fullName || this.user?.email || this.$t('common.defaultUser')
        },
        preferencesSidebarCollapsed() {
            return this.$store.state.settings?.preferences?.sidebarCollapsed ?? false
        }
    },
    watch: {
        preferencesSidebarCollapsed(value) {
            this.collapsed = value
        }
    },
    methods: {
        handleSearch(value) {
            this.$store.commit('SET_SEARCH_KEYWORD', value)
        },
        toggleSidebar() {
            const nextValue = !this.collapsed
            this.collapsed = nextValue
            this.$store.dispatch('updateSettings', {
                preferences: { sidebarCollapsed: nextValue }
            })
        },
        async handleMenuClick({ key }) {
            if (key === 'logout') {
                await this.$store.dispatch('logout')
                this.$router.replace({ name: 'Login' })
            } else if (key === 'profile') {
                this.$router.push({ name: 'Profile' })
            } else if (key === 'settings') {
                this.$router.push({ name: 'Settings' })
            }
        }
    }
}
</script>

<style scoped>
.header {
    background: #fff;
    padding: 0 24px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    position: sticky;
    top: 0;
    z-index: 100;
}

.header-content {
    display: flex;
    justify-content: space-between;
    align-items: center;
    height: 100%;
}

.logo {
    display: flex;
    align-items: center;
    gap: 12px;
}

.logo-text {
    font-size: 20px;
    font-weight: 600;
    color: #1890ff;
}

.header-actions {
    display: flex;
    align-items: center;
}
.collapse-toggle {
    margin-right: 12px;
}
.user-info {
    display: flex;
    align-items: center;
    margin-left: 16px;
}
.user-name {
    font-weight: 500;
    margin-right: 8px;
}

.main-content {
    padding: 24px;
    background: #f0f2f5;
}

.content-wrapper {
    background: #fff;
    padding: 24px;
    border-radius: 8px;
    min-height: calc(100vh - 112px);
}
</style>
