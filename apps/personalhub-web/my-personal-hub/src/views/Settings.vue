<template>
    <div class="settings-page">
        <div class="settings-header">
            <div>
                <h2>{{ $t('settings.title') }}</h2>
                <p>{{ $t('settings.description') }}</p>
            </div>
        </div>

        <a-row :gutter="[24, 24]">
            <a-col :xs="24" :lg="12">
                <a-card :title="$t('settings.general')">
                    <a-form layout="vertical">
                        <a-form-item :label="$t('settings.language')">
                            <a-select v-model:value="generalForm.language">
                                <a-select-option value="vi">{{ $t('settings.languageOptionVi') }}</a-select-option>
                                <a-select-option value="en">{{ $t('settings.languageOptionEn') }}</a-select-option>
                            </a-select>
                        </a-form-item>

                        <a-form-item :label="$t('settings.rememberLogin')">
                            <a-switch v-model:checked="generalForm.rememberLogin" />
                        </a-form-item>

                        <a-button type="primary" :loading="loading.general" @click="saveGeneralSettings" block>
                            {{ $t('settings.saveChanges') }}
                        </a-button>
                    </a-form>
                </a-card>
            </a-col>

            <a-col :xs="24" :lg="12">
                <a-card :title="$t('settings.appearance')">
                    <a-form layout="vertical">
                        <a-form-item :label="$t('settings.theme')">
                            <a-radio-group v-model:value="appearanceForm.theme">
                                <a-radio value="light">{{ $t('settings.themeLight') }}</a-radio>
                                <a-radio value="dark">{{ $t('settings.themeDark') }}</a-radio>
                            </a-radio-group>
                        </a-form-item>

                        <a-form-item :label="$t('settings.density')">
                            <a-radio-group v-model:value="appearanceForm.density">
                                <a-radio value="comfortable">{{ $t('settings.densityComfortable') }}</a-radio>
                                <a-radio value="compact">{{ $t('settings.densityCompact') }}</a-radio>
                            </a-radio-group>
                        </a-form-item>

                        <a-form-item :label="$t('settings.primaryColor')">
                            <div class="color-picker">
                                <input type="color" v-model="appearanceForm.primaryColor" />
                                <span>{{ appearanceForm.primaryColor }}</span>
                            </div>
                        </a-form-item>

                        <a-form-item :label="$t('settings.fontSize')">
                            <a-radio-group v-model:value="appearanceForm.fontSize">
                                <a-radio value="normal">{{ $t('settings.fontSizeNormal') }}</a-radio>
                                <a-radio value="large">{{ $t('settings.fontSizeLarge') }}</a-radio>
                            </a-radio-group>
                        </a-form-item>

                        <a-button type="primary" :loading="loading.appearance" @click="saveAppearanceSettings" block>
                            {{ $t('settings.applyAppearance') }}
                        </a-button>
                    </a-form>
                </a-card>
            </a-col>

            <a-col :xs="24" :lg="12">
                <a-card :title="$t('settings.preferences')">
                    <a-form layout="vertical">
                        <a-form-item :label="$t('settings.sidebarCollapsed')">
                            <a-switch v-model:checked="preferencesForm.sidebarCollapsed" />
                        </a-form-item>

                        <a-form-item :label="$t('settings.landingPage')">
                            <a-select v-model:value="preferencesForm.landingPage">
                                <a-select-option v-for="option in landingOptions" :key="option.value"
                                    :value="option.value">
                                    {{ $t(option.label) }}
                                </a-select-option>
                            </a-select>
                        </a-form-item>

                        <a-button type="primary" :loading="loading.preferences" @click="savePreferenceSettings" block>
                            {{ $t('settings.savePreferences') }}
                        </a-button>
                    </a-form>
                </a-card>
            </a-col>
        </a-row>
    </div>
</template>

<script>
export default {
    name: 'Settings',
    data() {
        return {
            loading: {
                general: false,
                appearance: false,
                preferences: false
            },
            generalForm: {
                language: 'vi',
                rememberLogin: true
            },
            appearanceForm: {
                theme: 'light',
                density: 'comfortable',
                primaryColor: '#1890ff',
                fontSize: 'normal'
            },
            preferencesForm: {
                sidebarCollapsed: false,
                landingPage: 'Dashboard'
            },
            landingOptions: [
                { value: 'Dashboard', label: 'sidebar.dashboard' },
                { value: 'LinkManager', label: 'sidebar.links' },
                { value: 'FileManager', label: 'sidebar.files' },
                { value: 'Media', label: 'sidebar.media' },
                { value: 'WebProjects', label: 'sidebar.webProjects' }
            ]
        }
    },
    computed: {
        settings() {
            return this.$store.state.settings
        }
    },
    watch: {
        settings: {
            immediate: true,
            deep: true,
            handler() {
                this.syncForms()
            }
        }
    },
    methods: {
        syncForms() {
            if (!this.settings) return
            this.generalForm = { ...this.generalForm, ...this.settings.general }
            this.appearanceForm = { ...this.appearanceForm, ...this.settings.appearance }
            this.preferencesForm = { ...this.preferencesForm, ...this.settings.preferences }
        },
        async saveGeneralSettings() {
            if (this.loading.general) return
            this.loading.general = true
            try {
                await this.$store.dispatch('updateSettings', {
                    general: { ...this.generalForm }
                })
                this.$message.success(this.$t('settings.saveGeneralSuccess'))
            } catch (error) {
                console.error(error)
                this.$message.error(this.$t('settings.saveError'))
            } finally {
                this.loading.general = false
            }
        },
        async saveAppearanceSettings() {
            if (this.loading.appearance) return
            this.loading.appearance = true
            try {
                await this.$store.dispatch('updateSettings', {
                    appearance: { ...this.appearanceForm }
                })
                this.$message.success(this.$t('settings.saveAppearanceSuccess'))
            } catch (error) {
                console.error(error)
                this.$message.error(this.$t('settings.saveError'))
            } finally {
                this.loading.appearance = false
            }
        },
        async savePreferenceSettings() {
            if (this.loading.preferences) return
            this.loading.preferences = true
            try {
                await this.$store.dispatch('updateSettings', {
                    preferences: { ...this.preferencesForm }
                })
                this.$message.success(this.$t('settings.savePreferencesSuccess'))
            } catch (error) {
                console.error(error)
                this.$message.error(this.$t('settings.saveError'))
            } finally {
                this.loading.preferences = false
            }
        }
    }
}
</script>

<style scoped>
.settings-page {
    display: flex;
    flex-direction: column;
    gap: 24px;
}

.settings-header h2 {
    margin-bottom: 4px;
}

.color-picker {
    display: inline-flex;
    align-items: center;
    gap: 12px;
}

.color-picker input {
    width: 48px;
    height: 32px;
    padding: 0;
    border: none;
    background: transparent;
}
</style>
