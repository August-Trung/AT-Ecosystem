<template>
	<div class="auth-page">
		<a-card class="auth-card">
			<div class="auth-header">
				<h2>Đang xác thực</h2>
				<p>Hệ thống đang hoàn tất đăng nhập...</p>
			</div>
		</a-card>
	</div>
</template>

<script>
export default {
	name: "AuthCallback",
	async mounted() {
		const token = this.$route.query.token;
		if (!token) {
			this.$message.error("Thiếu token đăng nhập");
			this.$router.replace({ name: "Login" });
			return;
		}

		const remember = this.$store.state.settings?.general?.rememberLogin ?? true;
		if (remember) {
			window.localStorage.setItem("token", token);
			window.sessionStorage.removeItem("token");
		} else {
			window.sessionStorage.setItem("token", token);
			window.localStorage.removeItem("token");
		}

		this.$store.commit("SET_TOKEN", token);

		try {
			await this.$store.dispatch("fetchCurrentUser");
			this.$message.success("Đăng nhập thành công");
			this.$router.replace({ name: "Dashboard" });
		} catch (error) {
			this.$message.error("Không thể hoàn tất đăng nhập");
			this.$router.replace({ name: "Login" });
		}
	},
};
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
	max-width: 420px;
}

.auth-header {
	text-align: center;
}
</style>
