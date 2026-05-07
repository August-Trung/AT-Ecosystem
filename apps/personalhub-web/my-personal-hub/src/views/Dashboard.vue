<template>
    <div class="dashboard">
        <a-page-header title="Dashboard" :sub-title="$t('dashboard.subtitle')" />

        <!-- Statistics Cards -->
        <a-row :gutter="[16, 16]" style="margin-top: 24px">
            <a-col :xs="24" :sm="12" :lg="6">
                <a-card :loading="loading">
                    <a-statistic :title="$t('dashboard.stats.totalLinks')" :value="stats.totalLinks"
                        :value-style="{ color: '#1890ff' }">
                        <template #prefix>
                            <LinkOutlined />
                        </template>
                    </a-statistic>
                </a-card>
            </a-col>

            <a-col :xs="24" :sm="12" :lg="6">
                <a-card :loading="loading">
                    <a-statistic :title="$t('dashboard.stats.totalFiles')" :value="stats.totalFiles"
                        :value-style="{ color: '#52c41a' }">
                        <template #prefix>
                            <FileOutlined />
                        </template>
                    </a-statistic>
                </a-card>
            </a-col>

            <a-col :xs="24" :sm="12" :lg="6">
                <a-card :loading="loading">
                    <a-statistic :title="$t('dashboard.stats.totalVisits')" :value="stats.totalVisits"
                        :value-style="{ color: '#faad14' }">
                        <template #prefix>
                            <EyeOutlined />
                        </template>
                    </a-statistic>
                </a-card>
            </a-col>

            <a-col :xs="24" :sm="12" :lg="6">
                <a-card :loading="loading">
                    <a-statistic :title="$t('dashboard.stats.totalStorage')" :value="stats.totalStorageValue"
                        :suffix="stats.totalStorageUnit"
                        :value-style="{ color: '#722ed1' }">
                        <template #prefix>
                            <CloudOutlined />
                        </template>
                    </a-statistic>
                </a-card>
            </a-col>
        </a-row>

        <!-- Quick Actions -->
        <a-card :title="$t('dashboard.quickActions')" style="margin-top: 24px">
            <a-row :gutter="16">
                <a-col :span="8">
                    <a-button type="primary" block size="large" @click="showCreateLinkModal">
                        <template #icon>
                            <PlusOutlined />
                        </template>
                        {{ $t('dashboard.actions.createLink') }}
                    </a-button>
                </a-col>
                <a-col :span="8">
                    <a-button block size="large" @click="showUploadModal">
                        <template #icon>
                            <UploadOutlined />
                        </template>
                        {{ $t('dashboard.actions.uploadFile') }}
                    </a-button>
                </a-col>
                <a-col :span="8">
                    <a-button block size="large" @click="$router.push('/files')">
                        <template #icon>
                            <FolderOutlined />
                        </template>
                        {{ $t('dashboard.actions.manageFiles') }}
                    </a-button>
                </a-col>
            </a-row>
        </a-card>

        <!-- Categories Overview -->
        <a-row :gutter="[16, 16]" style="margin-top: 24px">
            <a-col :xs="24" :md="12">
                <a-card :title="$t('dashboard.categoryTitle')" :loading="loading">
                    <div v-for="category in categories" :key="category.id" class="category-item"
                        @click="navigateToCategory(category.route)">
                        <div class="category-info">
                            <component :is="category.icon" style="font-size: 24px" />
                            <div>
                                <div class="category-name">{{ $t(category.labelKey) }}</div>
                                <div class="category-count">{{ category.linkCount }} {{ $t('dashboard.stats.linksUnit') }}
                                </div>
                            </div>
                        </div>
                        <RightOutlined />
                    </div>
                </a-card>
            </a-col>

            <a-col :xs="24" :md="12">
                <a-card :title="$t('dashboard.recentTitle')" :loading="loading">
                    <a-list :data-source="recentLinks" :loading="loading">
                        <template #renderItem="{ item }">
                            <a-list-item>
                                <a-list-item-meta>
                                    <template #title>
                                        <a :href="linkUrl(item)" target="_blank">{{ item.title }}</a>
                                    </template>
                                    <template #description>
                                        <a-space>
                                            <a-tag color="blue">{{ item.shortUrl }}</a-tag>
                                            <span>{{ item.visits }} {{ $t('dashboard.stats.visitsUnit') }}</span>
                                        </a-space>
                                    </template>
                                </a-list-item-meta>
                            </a-list-item>
                        </template>
                    </a-list>
                </a-card>
            </a-col>
        </a-row>
    </div>
</template>

<script>
import {
    LinkOutlined,
    FileOutlined,
    EyeOutlined,
    CloudOutlined,
    PlusOutlined,
    UploadOutlined,
    FolderOutlined,
    RightOutlined,
    ToolOutlined,
    BugOutlined,
    CodeOutlined,
    PictureOutlined
} from '@ant-design/icons-vue'
import linkService from '../services/linkService'
import { getLinkRedirectUrl } from '@/utils/helpers'

export default {
    name: 'Dashboard',
    components: {
        LinkOutlined,
        FileOutlined,
        EyeOutlined,
        CloudOutlined,
        PlusOutlined,
        UploadOutlined,
        FolderOutlined,
        RightOutlined,
        ToolOutlined,
        BugOutlined,
        CodeOutlined,
        PictureOutlined
    },
    data() {
        return {
            loading: false,
            stats: {
                totalLinks: 0,
                totalFiles: 0,
                totalVisits: 0,
                totalStorageValue: 0,
                totalStorageUnit: 'MB'
            },
            categories: [
                {
                    id: 'IT Support',
                    labelKey: 'common.categories.itSupport',
                    icon: ToolOutlined,
                    linkCount: 0,
                    route: '/it-support'
                },
                {
                    id: 'Tester',
                    labelKey: 'common.categories.tester',
                    icon: BugOutlined,
                    linkCount: 0,
                    route: '/tester'
                },
                {
                    id: 'Web',
                    labelKey: 'common.categories.web',
                    icon: CodeOutlined,
                    linkCount: 0,
                    route: '/web-projects'
                },
                {
                    id: 'Media',
                    labelKey: 'common.categories.media',
                    icon: PictureOutlined,
                    linkCount: 0,
                    route: '/media'
                }
            ],
            recentLinks: []
        }
    },
    mounted() {
        this.loadDashboardData()
    },
    methods: {
        async loadDashboardData() {
            this.loading = true
            try {
                // 1️⃣ Fetch aggregated statistics
                const statsResponse = await linkService.getStatistics()
                if (statsResponse.success) {
                    const storage = statsResponse.data.totalStorage || {
                        value: 0,
                        unit: 'MB'
                    }
                    this.stats = {
                        totalLinks: statsResponse.data.totalLinks || 0,
                        totalFiles: statsResponse.data.totalFiles || 0,
                        totalVisits: statsResponse.data.totalVisits || 0,
                        totalStorageValue: Number(storage.value) || 0,
                        totalStorageUnit: storage.unit || 'MB'
                    }
                }

                // 2️⃣ Load all links from Vuex store
                await this.$store.dispatch('fetchLinks')
                const allLinks = this.$store.state.links

                // 3️⃣ Count links per category
                this.categories.forEach(category => {
                    category.linkCount = allLinks.filter(l => l.category === category.id).length
                })

                // 4️⃣ Take the latest 5 links
                this.recentLinks = allLinks.slice(0, 5)

            } catch (error) {
                console.error('Error loading dashboard:', error)
                this.$message.error(this.$t('dashboard.errors.load'))
            } finally {
                this.loading = false
            }
        },
        showCreateLinkModal() {
            this.$router.push('/links')
        },
        showUploadModal() {
            this.$router.push('/files')
        },
        navigateToCategory(route) {
            this.$router.push(route)
        },
        linkUrl(link) {
            return getLinkRedirectUrl(link) || link.originalUrl
        }
    }
}
</script>

<style scoped>
.dashboard {
    padding: 0;
}

.category-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px;
    border-bottom: 1px solid #f0f0f0;
    cursor: pointer;
    transition: all 0.3s;
}

.category-item:hover {
    background: #f5f5f5;
}

.category-item:last-child {
    border-bottom: none;
}

.category-info {
    display: flex;
    align-items: center;
    gap: 16px;
}

.category-name {
    font-weight: 500;
    font-size: 16px;
}

.category-count {
    color: #999;
    font-size: 14px;
}
</style>
