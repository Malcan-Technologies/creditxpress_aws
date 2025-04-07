"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { useFormik } from "formik";
import * as Yup from "yup";
import { TextField, Button, Alert, CircularProgress } from "@mui/material";
import { Visibility, VisibilityOff } from "@mui/icons-material";
import Cookies from "js-cookie";

const validationSchema = Yup.object({
	email: Yup.string()
		.email("Enter a valid email")
		.required("Email is required"),
	password: Yup.string()
		.min(8, "Password should be of minimum 8 characters length")
		.required("Password is required"),
});

export default function AdminLoginPage() {
	const router = useRouter();
	const [showPassword, setShowPassword] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);

	useEffect(() => {
		// Check if user is already logged in
		const token =
			localStorage.getItem("adminToken") || Cookies.get("adminToken");
		if (token) {
			router.push("/admin/dashboard");
		}
	}, [router]);

	const formik = useFormik({
		initialValues: {
			email: "",
			password: "",
		},
		validationSchema: validationSchema,
		onSubmit: async (values) => {
			setLoading(true);
			setError(null);
			try {
				const response = await fetch(
					`${process.env.NEXT_PUBLIC_API_URL}/api/auth/login`,
					{
						method: "POST",
						headers: {
							"Content-Type": "application/json",
						},
						body: JSON.stringify(values),
					}
				);

				const data = await response.json();

				if (!response.ok) {
					throw new Error(data.message || "Login failed");
				}

				// Check if user is an admin
				if (data.user.role !== "ADMIN") {
					throw new Error(
						"Access denied. Admin privileges required."
					);
				}

				// Store the token
				localStorage.setItem("adminToken", data.token);
				Cookies.set("adminToken", data.token, { expires: 7 }); // 7 days expiry

				// Redirect to admin dashboard
				router.push("/admin/dashboard");
			} catch (err: any) {
				setError(err.message || "An error occurred during login");
			} finally {
				setLoading(false);
			}
		},
	});

	const togglePasswordVisibility = () => {
		setShowPassword(!showPassword);
	};

	return (
		<div className="min-h-screen flex flex-col justify-center py-12 sm:px-6 lg:px-8 bg-gray-50">
			<div className="sm:mx-auto sm:w-full sm:max-w-md">
				<div className="flex justify-center">
					<Image
						src="/logo.png"
						alt="Kapital Logo"
						width={120}
						height={120}
						className="mx-auto h-12 w-auto"
					/>
				</div>
				<h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
					Admin Portal
				</h2>
				<p className="mt-2 text-center text-sm text-gray-600">
					Sign in to access the admin dashboard
				</p>
			</div>

			<div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
				<div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
					{error && (
						<Alert severity="error" className="mb-4">
							{error}
						</Alert>
					)}

					<form className="space-y-6" onSubmit={formik.handleSubmit}>
						<div>
							<TextField
								fullWidth
								id="email"
								name="email"
								label="Email address"
								value={formik.values.email}
								onChange={formik.handleChange}
								error={
									formik.touched.email &&
									Boolean(formik.errors.email)
								}
								helperText={
									formik.touched.email && formik.errors.email
								}
								disabled={loading}
								className="[&_.MuiOutlinedInput-root]:focus-within:ring-blue-600 [&_.MuiOutlinedInput-root]:focus-within:border-blue-600"
							/>
						</div>

						<div>
							<TextField
								fullWidth
								id="password"
								name="password"
								label="Password"
								type={showPassword ? "text" : "password"}
								value={formik.values.password}
								onChange={formik.handleChange}
								error={
									formik.touched.password &&
									Boolean(formik.errors.password)
								}
								helperText={
									formik.touched.password &&
									formik.errors.password
								}
								disabled={loading}
								InputProps={{
									endAdornment: (
										<button
											type="button"
											onClick={togglePasswordVisibility}
											className="text-gray-500 hover:text-gray-700"
										>
											{showPassword ? (
												<VisibilityOff />
											) : (
												<Visibility />
											)}
										</button>
									),
								}}
								className="[&_.MuiOutlinedInput-root]:focus-within:ring-blue-600 [&_.MuiOutlinedInput-root]:focus-within:border-blue-600"
							/>
						</div>

						<div>
							<Button
								type="submit"
								fullWidth
								variant="contained"
								disabled={loading}
								className="bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-md shadow-sm"
							>
								{loading ? (
									<CircularProgress
										size={24}
										color="inherit"
									/>
								) : (
									"Sign in"
								)}
							</Button>
						</div>
					</form>

					<div className="mt-6">
						<div className="relative">
							<div className="absolute inset-0 flex items-center">
								<div className="w-full border-t border-gray-300" />
							</div>
							<div className="relative flex justify-center text-sm">
								<span className="px-2 bg-white text-gray-500">
									Not an admin?
								</span>
							</div>
						</div>

						<div className="mt-6 text-center">
							<Link
								href="/login"
								className="font-medium text-blue-600 hover:text-blue-500"
							>
								Go to user login
							</Link>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
