import { verify } from "jsonwebtoken";
import prisma from "./prisma";

interface TokenPayload {
	userId: string;
}

export async function verifyAuth(token: string) {
	try {
		// Verify JWT token
		const decoded = verify(token, process.env.JWT_SECRET!) as TokenPayload;

		// Get user from database
		const user = await prisma.user.findUnique({
			where: { id: decoded.userId },
			select: {
				id: true,
				email: true,
			},
		});

		if (!user) {
			return null;
		}

		return {
			id: user.id,
			email: user.email,
		};
	} catch (error) {
		console.error("Error verifying auth:", error);
		return null;
	}
}
