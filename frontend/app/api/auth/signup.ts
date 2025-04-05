export interface SignupResponse {
	message: string;
	accessToken: string;
	refreshToken: string;
}

export const signup = async (
	phoneNumber: string,
	password: string
): Promise<SignupResponse> => {
	console.log("Signup - Attempting signup with phone:", phoneNumber);

	const response = await fetch(
		`${process.env.NEXT_PUBLIC_API_URL}/api/auth/signup`,
		{
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ phoneNumber, password }),
		}
	);

	const data = await response.json();

	if (!response.ok) {
		console.error("Signup - Failed:", data.message);
		throw new Error(data.message || "Failed to sign up");
	}

	console.log("Signup - Successful");
	return data;
};
