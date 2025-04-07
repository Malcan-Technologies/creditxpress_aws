const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

// Function to check if we're on Linux with glibc
function isLinuxGlibc() {
	if (process.platform !== "linux") return false;
	try {
		const lddVersion = execSync("ldd --version").toString();
		return lddVersion.includes("GNU libc");
	} catch (e) {
		return false;
	}
}

// Function to install the correct SWC compiler
function installCorrectSwc() {
	if (isLinuxGlibc()) {
		console.log(
			"Detected Linux with glibc, installing appropriate SWC compiler..."
		);
		try {
			// Remove musl version if it exists
			execSync("npm uninstall @next/swc-linux-x64-musl", {
				stdio: "inherit",
			});

			// Install gnu version
			execSync("npm install @next/swc-linux-x64-gnu@latest", {
				stdio: "inherit",
			});

			console.log("Successfully installed @next/swc-linux-x64-gnu");
		} catch (error) {
			console.error("Error installing SWC compiler:", error);
			process.exit(1);
		}
	} else {
		console.log(
			"Not on Linux with glibc, skipping SWC compiler installation"
		);
	}
}

// Run the installation
installCorrectSwc();
