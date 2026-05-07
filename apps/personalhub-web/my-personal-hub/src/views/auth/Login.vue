<template>
    <div class="auth-page">
        <a-card class="auth-card" :loading="loading">
            <div class="auth-header">
                <h2>{{ $t('auth.loginTitle') }}</h2>
                <p>{{ $t('auth.loginSubtitle') }}</p>
            </div>

            <a-tabs v-model:activeKey="activeTab" class="auth-tabs">
                <a-tab-pane key="password" tab="Email">
                    <a-form layout="vertical" @submit.prevent="handlePasswordSubmit">
                        <a-form-item :label="$t('auth.email')">
                            <a-input v-model:value="passwordForm.email" type="email" :placeholder="$t('auth.emailPlaceholder')" />
                        </a-form-item>

                        <a-form-item :label="$t('auth.password')">
                            <a-input-password
                                v-model:value="passwordForm.password"
                                :placeholder="$t('auth.passwordPlaceholder')"
                            />
                        </a-form-item>

                        <a-form-item>
                            <a-button type="primary" block :loading="loading" @click="handlePasswordSubmit">
                                {{ $t('auth.loginButton') }}
                            </a-button>
                        </a-form-item>
                    </a-form>
                </a-tab-pane>

                <a-tab-pane key="phone" tab="OTP điện thoại">
                    <a-form layout="vertical" @submit.prevent="handlePhoneRequest">
                        <a-form-item label="Số điện thoại">
                            <a-input
                                v-model:value="phoneForm.phoneNumber"
                                placeholder="VD: 0912345678 hoặc +84912345678"
                            />
                        </a-form-item>

                        <a-form-item v-if="otpRequested" label="Mã OTP">
                            <a-input
                                v-model:value="phoneForm.otpCode"
                                :maxlength="otpLength"
                                placeholder="Nhập mã OTP"
                            />
                        </a-form-item>

                        <a-alert
                            v-if="otpHint"
                            class="otp-alert"
                            type="info"
                            show-icon
                            :message="otpHint"
                        />

                        <a-space direction="vertical" style="width: 100%">
                            <a-button block :loading="phoneLoading" @click="handlePhoneRequest">
                                {{ otpRequested ? 'Gửi lại OTP' : 'Nhận mã OTP' }}
                            </a-button>
                            <a-button
                                type="primary"
                                block
                                :disabled="!otpRequested"
                                :loading="phoneVerifyLoading"
                                @click="handlePhoneVerify"
                            >
                                Đăng nhập bằng OTP
                            </a-button>
                        </a-space>
                    </a-form>
                </a-tab-pane>
            </a-tabs>

            <div class="social-auth">
                <a-divider>Hoặc tiếp tục với</a-divider>

                <a-space direction="vertical" style="width: 100%">
                    <a-button block size="large" :disabled="!googleEnabled || googleLoading" @click="handleGoogleLogin">
                        Đăng nhập với Google
                    </a-button>
                    <a-button block size="large" :disabled="!githubEnabled || githubLoading" @click="handleGitHubLogin">
                        Đăng nhập với GitHub
                    </a-button>
                </a-space>

                <p class="auth-hint" v-if="!googleEnabled || !githubEnabled">
                    Một số phương thức đăng nhập sẽ hiện khả dụng sau khi cấu hình provider ở backend.
                </p>
            </div>

            <div class="auth-footer">
                <span>{{ $t('auth.noAccount') }}</span>
                <a @click="goRegister">{{ $t('auth.registerNow') }}</a>
            </div>
        </a-card>
    </div>
</template>

<script>
import { GOOGLE_CLIENT_ID } from '@/config/api.config'

const GOOGLE_SCRIPT_ID = 'google-identity-services'

export default {
    name: 'Login',
    data() {
        return {
            loading: false,
            googleLoading: false,
            githubLoading: false,
            phoneLoading: false,
            phoneVerifyLoading: false,
            activeTab: 'password',
            otpRequested: false,
            otpHint: '',
            otpLength: 6,
            passwordForm: {
                email: '',
                password: ''
            },
            phoneForm: {
                phoneNumber: '',
                otpCode: ''
            }
        }
    },
    computed: {
        providers() {
            return this.$store.state.authProviders || {}
        },
        googleEnabled() {
            return Boolean(this.providers.googleEnabled && GOOGLE_CLIENT_ID)
        },
        githubEnabled() {
            return Boolean(this.providers.githubEnabled)
        }
    },
    async created() {
        const method = this.$route.query.method
        if (method === 'phone') {
            this.activeTab = 'phone'
        }
        await this.fetchProviders()
    },
    methods: {
        async fetchProviders() {
            try {
                const providers = await this.$store.dispatch('fetchAuthProviders')
                if (providers?.data?.phoneOtpLength) {
                    this.otpLength = providers.data.phoneOtpLength
                }
            } catch (error) {
                const msg = error.response?.data?.message || 'Không thể tải cấu hình xác thực'
                this.$message.error(msg)
            }
        },
        goRegister() {
            this.$router.push({ name: 'Register' })
        },
        async afterLoginSuccess(response) {
            if (response.success) {
                this.$message.success(response.message || this.$t('auth.loginSuccess'))
                const redirect = this.$route.query.redirect
                if (redirect) {
                    this.$router.replace(redirect)
                    return
                }
                const landing = this.$store.state.settings?.preferences?.landingPage || 'Dashboard'
                this.$router.replace({ name: landing })
            }
        },
        async handlePasswordSubmit() {
            if (this.loading) return
            if (!this.passwordForm.email || !this.passwordForm.password) {
                this.$message.error(this.$t('auth.requiredMessage'))
                return
            }

            this.loading = true
            try {
                const response = await this.$store.dispatch('login', this.passwordForm)
                await this.afterLoginSuccess(response)
            } catch (error) {
                const msg = error.response?.data?.message || this.$t('auth.loginFailed')
                this.$message.error(msg)
            } finally {
                this.loading = false
            }
        },
        async handlePhoneRequest() {
            if (this.phoneLoading) return
            if (!this.phoneForm.phoneNumber) {
                this.$message.error('Vui lòng nhập số điện thoại')
                return
            }

            this.phoneLoading = true
            try {
                const response = await this.$store.dispatch('requestPhoneOtp', {
                    phoneNumber: this.phoneForm.phoneNumber
                })
                this.otpRequested = true
                this.otpHint = response.data?.otp
                    ? `Mã OTP local hiện tại: ${response.data.otp}`
                    : 'OTP đã được tạo. Hãy nhập mã để xác thực.'
                this.$message.success(response.message || 'OTP đã được gửi')
            } catch (error) {
                const msg = error.response?.data?.message || 'Không thể gửi OTP'
                this.$message.error(msg)
            } finally {
                this.phoneLoading = false
            }
        },
        async handlePhoneVerify() {
            if (this.phoneVerifyLoading) return
            if (!this.phoneForm.phoneNumber || !this.phoneForm.otpCode) {
                this.$message.error('Vui lòng nhập số điện thoại và mã OTP')
                return
            }

            this.phoneVerifyLoading = true
            try {
                const response = await this.$store.dispatch('verifyPhoneOtp', this.phoneForm)
                await this.afterLoginSuccess(response)
            } catch (error) {
                const msg = error.response?.data?.message || 'Xác thực OTP thất bại'
                this.$message.error(msg)
            } finally {
                this.phoneVerifyLoading = false
            }
        },
        async ensureGoogleScript() {
            if (window.google?.accounts?.id) {
                return
            }

            const existing = document.getElementById(GOOGLE_SCRIPT_ID)
            if (existing) {
                await new Promise((resolve, reject) => {
                    existing.addEventListener('load', resolve, { once: true })
                    existing.addEventListener('error', reject, { once: true })
                })
                return
            }

            await new Promise((resolve, reject) => {
                const script = document.createElement('script')
                script.id = GOOGLE_SCRIPT_ID
                script.src = 'https://accounts.google.com/gsi/client'
                script.async = true
                script.defer = true
                script.onload = resolve
                script.onerror = reject
                document.head.appendChild(script)
            })
        },
        async getGoogleCredential() {
            await this.ensureGoogleScript()
            return await new Promise((resolve, reject) => {
                const timeout = window.setTimeout(() => reject(new Error('Google sign-in timeout')), 30000)
                window.google.accounts.id.initialize({
                    client_id: GOOGLE_CLIENT_ID,
                    callback: (response) => {
                        window.clearTimeout(timeout)
                        if (!response?.credential) {
                            reject(new Error('Google did not return a credential'))
                            return
                        }
                        resolve(response.credential)
                    }
                })
                window.google.accounts.id.prompt((notification) => {
                    const skipped = notification?.isNotDisplayed?.() || notification?.isSkippedMoment?.()
                    if (skipped) {
                        window.google.accounts.id.cancel()
                        window.clearTimeout(timeout)
                        reject(new Error('Google sign-in was not completed'))
                    }
                })
            })
        },
        async handleGoogleLogin() {
            if (!this.googleEnabled || this.googleLoading) return

            this.googleLoading = true
            try {
                const credential = await this.getGoogleCredential()
                const response = await this.$store.dispatch('loginWithGoogle', { credential })
                await this.afterLoginSuccess(response)
            } catch (error) {
                const msg = error.response?.data?.message || error.message || 'Đăng nhập Google thất bại'
                this.$message.error(msg)
            } finally {
                this.googleLoading = false
            }
        },
        async handleGitHubLogin() {
            if (!this.githubEnabled || this.githubLoading) return

            this.githubLoading = true
            try {
                const callbackUrl = `${window.location.origin}/auth/callback`
                const url = await this.$store.dispatch('getGitHubStartUrl', callbackUrl)
                window.location.assign(url)
            } catch (error) {
                const msg = error.response?.data?.message || 'Không thể khởi tạo đăng nhập GitHub'
                this.$message.error(msg)
                this.githubLoading = false
            }
        }
    }
}
</script>

<style scoped>
.auth-page {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #f0f2f5;
    padding: 24px;
}

.auth-card {
    width: 100%;
    max-width: 460px;
}

.auth-header {
    text-align: center;
    margin-bottom: 24px;
}

.auth-header h2 {
    margin-bottom: 8px;
}

.auth-tabs {
    margin-bottom: 16px;
}

.social-auth {
    margin: 8px 0 20px;
}

.auth-hint {
    margin-top: 12px;
    color: rgba(0, 0, 0, 0.45);
    font-size: 12px;
}

.otp-alert {
    margin-bottom: 16px;
}

.auth-footer {
    display: flex;
    justify-content: center;
    gap: 8px;
}

.auth-footer a {
    cursor: pointer;
}
</style>
