module.exports = {
	apps: [
		{
			name: "frontend",
			script: "npm",
			args: "start -- --port 3002 --hostname 0.0.0.0",
			cwd: "/var/www/growkapital/frontend",
			env: {
				NODE_ENV: "production",
				PORT: 3002,
				HOSTNAME: "0.0.0.0",
				NEXT_PUBLIC_API_URL: "https://creditxpress.com.my",
				NEXT_PUBLIC_SITE_URL: "https://creditxpress.com.my",
			},
			instances: 1,
			exec_mode: "fork",
			max_memory_restart: "1G",
			error_file: "/root/.pm2/logs/frontend-error.log",
			out_file: "/root/.pm2/logs/frontend-out.log",
			log_file: "/root/.pm2/logs/frontend.log",
			time: true,
		},
	],
};

