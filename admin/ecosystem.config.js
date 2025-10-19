module.exports = {
	apps: [
		{
			name: "admin",
			script: "npm",
			args: "start -- --port 3003 --hostname 0.0.0.0",
			cwd: "/var/www/growkapital/admin",
			env: {
				NODE_ENV: "production",
				PORT: 3003,
				HOSTNAME: "0.0.0.0",
				NEXT_PUBLIC_API_URL: "https://creditxpress.com.my",
				NEXT_PUBLIC_SITE_URL: "https://admin.creditxpress.com.my",
			},
			instances: 1,
			exec_mode: "fork",
			max_memory_restart: "1G",
			error_file: "/root/.pm2/logs/admin-error.log",
			out_file: "/root/.pm2/logs/admin-out.log",
			log_file: "/root/.pm2/logs/admin.log",
			time: true,
		},
	],
};
