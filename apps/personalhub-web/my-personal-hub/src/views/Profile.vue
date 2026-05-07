<template>
    <div class="profile-page">
        <a-row :gutter="[24, 24]">
            <a-col :xs="24" :lg="12">
                <a-card :title="$t('profile.personalInfo')" :loading="loading.profile">
                    <a-form layout="vertical" @submit.prevent="handleProfileSubmit">
                        <a-form-item label="Email">
                            <a-input v-model:value="profileForm.email" disabled />
                        </a-form-item>

                        <a-form-item :label="$t('profile.fullName')">
                            <a-input v-model:value="profileForm.fullName" :placeholder="$t('profile.fullNamePlaceholder')" />
                        </a-form-item>

                        <a-form-item :label="$t('profile.username')">
                            <a-input v-model:value="profileForm.username" :placeholder="$t('profile.usernamePlaceholder')" />
                        </a-form-item>

                        <a-form-item>
                            <a-button type="primary" :loading="loading.profile" block @click="handleProfileSubmit">
                                {{ $t('profile.saveChanges') }}
                            </a-button>
                        </a-form-item>
                    </a-form>
                </a-card>
            </a-col>

            <a-col :xs="24" :lg="12">
                <a-card :title="$t('profile.changePassword')" :loading="loading.password">
                    <a-form layout="vertical" @submit.prevent="handlePasswordSubmit">
                        <a-form-item :label="$t('profile.currentPassword')">
                            <a-input-password v-model:value="passwordForm.currentPassword" placeholder="••••••••" />
                        </a-form-item>

                        <a-form-item :label="$t('profile.newPassword')">
                            <a-input-password v-model:value="passwordForm.newPassword" placeholder="••••••••" />
                        </a-form-item>

                        <a-form-item :label="$t('profile.confirmPassword')">
                            <a-input-password v-model:value="passwordForm.confirmPassword" placeholder="••••••••" />
                        </a-form-item>

                        <a-form-item>
                            <a-button type="primary" :loading="loading.password" block
                                @click="handlePasswordSubmit">
                                {{ $t('profile.updatePassword') }}
                            </a-button>
                        </a-form-item>
                    </a-form>
                </a-card>
            </a-col>
        </a-row>
    </div>
</template>

<script>
export default {
    name: 'Profile',
    data() {
        return {
            loading: {
                profile: false,
                password: false
            },
            profileForm: {
                fullName: '',
                username: '',
                email: ''
            },
            passwordForm: {
                currentPassword: '',
                newPassword: '',
                confirmPassword: ''
            }
        }
    },
    computed: {
        user() {
            return this.$store.state.user
        }
    },
    watch: {
        user: {
            immediate: true,
            handler() {
                this.syncFormWithUser()
            }
        }
    },
    created() {
        this.ensureProfileLoaded()
    },
    methods: {
        async ensureProfileLoaded() {
            if (!this.user && this.$store.state.token) {
                try {
                    await this.$store.dispatch('fetchCurrentUser')
                } catch (error) {
                    console.error(this.$t('profile.fetchError'), error)
                }
            }
            this.syncFormWithUser()
        },
        syncFormWithUser() {
            if (!this.user) return
            this.profileForm = {
                fullName: this.user.fullName || '',
                username: this.user.username || '',
                email: this.user.email || ''
            }
        },
        async handleProfileSubmit() {
            if (this.loading.profile) return
            this.loading.profile = true
            try {
                const payload = {
                    fullName: this.profileForm.fullName?.trim() || '',
                    username: this.profileForm.username?.trim() || ''
                }
                const response = await this.$store.dispatch('updateProfile', payload)
                if (response.success) {
                    this.$message.success(this.$t('profile.updateSuccess'))
                }
            } catch (error) {
                const message = error.response?.data?.message || this.$t('profile.updateFailed')
                this.$message.error(message)
            } finally {
                this.loading.profile = false
            }
        },
        async handlePasswordSubmit() {
            if (this.loading.password) return
            if (!this.passwordForm.currentPassword || !this.passwordForm.newPassword) {
                this.$message.error(this.$t('profile.passwordRequired'))
                return
            }
            if (this.passwordForm.newPassword !== this.passwordForm.confirmPassword) {
                this.$message.error(this.$t('profile.passwordMismatch'))
                return
            }
            this.loading.password = true
            try {
                const payload = {
                    currentPassword: this.passwordForm.currentPassword,
                    newPassword: this.passwordForm.newPassword
                }
                const response = await this.$store.dispatch('changePassword', payload)
                if (response.success) {
                    this.$message.success(this.$t('profile.passwordSuccess'))
                    this.passwordForm = {
                        currentPassword: '',
                        newPassword: '',
                        confirmPassword: ''
                    }
                }
            } catch (error) {
                const message = error.response?.data?.message || this.$t('profile.passwordFailed')
                this.$message.error(message)
            } finally {
                this.loading.password = false
            }
        }
    }
}
</script>

<style scoped>
.profile-page {
    padding: 12px;
}

@media (max-width: 768px) {
    .profile-page {
        padding: 0;
    }
}
</style>
