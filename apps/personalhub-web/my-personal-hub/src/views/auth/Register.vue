<template>
    <div class="auth-page">
        <a-card class="auth-card" :loading="loading">
            <div class="auth-header">
                <h2>{{ $t('auth.registerTitle') }}</h2>
                <p>{{ $t('auth.registerSubtitle') }}</p>
            </div>

            <a-form layout="vertical" @submit.prevent="handleSubmit">
                <a-form-item :label="$t('auth.fullName')">
                    <a-input v-model:value="form.fullName" :placeholder="$t('auth.fullNamePlaceholder')" />
                </a-form-item>

                <a-form-item :label="$t('auth.email')">
                    <a-input v-model:value="form.email" type="email" :placeholder="$t('auth.emailPlaceholder')" />
                </a-form-item>

                <a-form-item :label="$t('auth.password')">
                    <a-input-password v-model:value="form.password" :placeholder="$t('auth.passwordPlaceholder')" />
                </a-form-item>

                <a-form-item :label="$t('auth.confirmPassword')">
                    <a-input-password v-model:value="form.confirmPassword" :placeholder="$t('auth.passwordPlaceholder')" />
                </a-form-item>

                <a-form-item>
                    <a-button type="primary" block :loading="loading" @click="handleSubmit">
                        {{ $t('auth.registerButton') }}
                    </a-button>
                </a-form-item>
            </a-form>

            <div class="social-register">
                <a-divider>Tạo tài khoản nhanh</a-divider>
                <p class="register-hint">
                    Bạn cũng có thể dùng Google, GitHub hoặc OTP điện thoại. Tài khoản sẽ được tạo tự động ở lần đăng nhập đầu tiên.
                </p>
                <a-space direction="vertical" style="width: 100%">
                    <a-button block @click="goLoginWithMethod('google')">Tiếp tục với Google</a-button>
                    <a-button block @click="goLoginWithMethod('github')">Tiếp tục với GitHub</a-button>
                    <a-button block @click="goLoginWithMethod('phone')">Tiếp tục với OTP điện thoại</a-button>
                </a-space>
            </div>

            <div class="auth-footer">
                <span>{{ $t('auth.haveAccount') }}</span>
                <a @click="goLogin">{{ $t('auth.loginNow') }}</a>
            </div>
        </a-card>
    </div>
</template>

<script>
export default {
    name: 'Register',
    data() {
        return {
            loading: false,
            form: {
                fullName: '',
                email: '',
                password: '',
                confirmPassword: ''
            }
        }
    },
    methods: {
        goLogin() {
            this.$router.push({ name: 'Login' })
        },
        goLoginWithMethod(method) {
            this.$router.push({ name: 'Login', query: { method } })
        },
        async handleSubmit() {
            if (this.loading) return
            if (!this.form.email || !this.form.password) {
                this.$message.error(this.$t('auth.requiredMessage'))
                return
            }
            if (this.form.password !== this.form.confirmPassword) {
                this.$message.error(this.$t('auth.passwordMismatch'))
                return
            }
            this.loading = true
            try {
                const payload = {
                    email: this.form.email,
                    password: this.form.password,
                    fullName: this.form.fullName
                }
                const response = await this.$store.dispatch('register', payload)
                if (response.success) {
                    this.$message.success(this.$t('auth.registerSuccess'))
                    this.$router.replace('/')
                }
            } catch (error) {
                const msg = error.response?.data?.message || this.$t('auth.registerFailed')
                this.$message.error(msg)
            } finally {
                this.loading = false
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

.social-register {
    margin: 12px 0 20px;
}

.register-hint {
    margin-bottom: 16px;
    color: rgba(0, 0, 0, 0.6);
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
