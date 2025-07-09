import {
	Router,
	Request,
	Response,
	NextFunction,
	RequestHandler,
} from "express";
import { LateFeeProcessor } from "../../lib/lateFeeProcessor";
import { authenticateToken, AuthRequest } from "../../middleware/auth";
import { PrismaClient } from "@prisma/client";
import { TimeUtils } from "../../lib/precisionUtils";
import fs from "fs";
import path from "path";

const router = Router();
const prisma = new PrismaClient();

// Middleware to check if user is admin
const isAdmin = async (req: Request, res: Response, next: NextFunction) => {
	try {
		const authReq = req as AuthRequest;
		const user = await prisma.user.findUnique({
			where: { id: authReq.user?.userId },
		});

		if (!user || user.role !== "ADMIN") {
			return res
				.status(403)
				.json({ message: "Access denied. Admin only." });
		}

		return next();
	} catch (error) {
		console.error("Error checking admin status:", error);
		return res.status(500).json({ message: "Internal server error" });
	}
};

/**
 * Get all repayments with late fees and related data
 */
router.get(
	"/",
	authenticateToken,
	isAdmin as unknown as RequestHandler,
	async (_req: AuthRequest, res: Response) => {
		try {
			// Get all repayments that have late fees
			const overdueRepayments = await prisma.loanRepayment.findMany({
				where: {
					lateFeeAmount: { gt: 0 }
				},
				include: {
					loan: {
						include: {
							user: {
								select: {
									id: true,
									fullName: true,
									email: true,
									phoneNumber: true,
								},
							},
							application: {
								include: {
									product: {
										select: {
											name: true,
											code: true,
											lateFeeRate: true,
											lateFeeFixedAmount: true,
											lateFeeFrequencyDays: true,
										},
									},
								},
							},
							lateFee: true, // Include loan-level late fee summary
						},
					},
				},
				orderBy: [
					{ loan: { id: 'asc' } },
					{ dueDate: 'asc' }
				],
			});

			// Transform data to match the expected format for the frontend
			const transformedData = overdueRepayments.map(repayment => {
				const dueDate = new Date(repayment.dueDate);
				const daysOverdue = TimeUtils.daysOverdue(dueDate);
				
				const totalLateFees = repayment.lateFeeAmount; // Total late fees assessed (matches loans page)
				const outstandingLateFees = Math.max(0, repayment.lateFeeAmount - repayment.lateFeesPaid);
				const outstandingPrincipal = Math.max(0, 
					(repayment.principalAmount + repayment.interestAmount) - repayment.principalPaid
				);

				// Debug: Log the values to see what's actually in the database
				console.log(`🔍 Late Fee Debug for repayment ${repayment.id}:`, {
					lateFeeAmount: repayment.lateFeeAmount,
					lateFeesPaid: repayment.lateFeesPaid,
					totalLateFees: totalLateFees,
					outstandingLateFees: outstandingLateFees,
					principalPaid: repayment.principalPaid,
					actualAmount: repayment.actualAmount,
					status: repayment.status
				});

				// Determine status based on outstanding amounts
				// Status should be PAID only if both late fees AND underlying payments are fully paid
				let status = 'ACTIVE';
				if (outstandingLateFees <= 0 && outstandingPrincipal <= 0) {
					status = 'PAID';
				}

				// Get actual product configuration
				const product = repayment.loan.application.product;
				const dailyRate = Number(product.lateFeeRate) / 100; // Convert percentage to decimal, preserve precision
				const fixedFeeAmount = Number(product.lateFeeFixedAmount) || 0;
				const frequencyDays = Number(product.lateFeeFrequencyDays) || 7;

				// Calculate component breakdown from database values (for display purposes only)
				// Import SafeMath for high precision late fee calculations
				const { SafeMath } = require("../../lib/precisionUtils");
				const interestFeesTotal = daysOverdue > 0 && outstandingPrincipal > 0 ? 
					SafeMath.lateFeeCalculation(outstandingPrincipal, dailyRate, daysOverdue) : 0;
				
				const completedPeriods = Math.floor(daysOverdue / frequencyDays);
				const fixedFeesTotal = Math.round(completedPeriods * fixedFeeAmount * 100) / 100;

				return {
					id: `${repayment.id}_late_fee`, // Create a unique ID for frontend compatibility
					loanRepaymentId: repayment.id,
					calculationDate: repayment.loan.lateFee?.lastCalculationDate || repayment.updatedAt,
					daysOverdue: daysOverdue,
					outstandingPrincipal: outstandingPrincipal,
					dailyRate: dailyRate, // Use actual product configuration
									feeAmount: totalLateFees, // Total late fees assessed (matches loans page display)
				outstandingFeeAmount: outstandingLateFees, // Outstanding late fees still owed
				cumulativeFees: repayment.lateFeeAmount, // Use database value
				feeType: "COMBINED",
					fixedFeeAmount: fixedFeeAmount,
					frequencyDays: frequencyDays,
					// Add breakdown for display (these are calculated from database values)
					interestFeesTotal: interestFeesTotal,
					fixedFeesTotal: fixedFeesTotal,
					status: status,
					createdAt: repayment.createdAt,
					updatedAt: repayment.updatedAt,
					loanRepayment: {
						id: repayment.id,
						amount: repayment.amount,
						principalAmount: repayment.principalAmount,
						interestAmount: repayment.interestAmount,
						dueDate: repayment.dueDate,
						status: repayment.status,
						installmentNumber: repayment.installmentNumber,
						actualAmount: repayment.actualAmount,
						paidAt: repayment.paidAt,
						paymentType: repayment.paymentType,
						// Add new fields for payment allocation
						lateFeeAmount: repayment.lateFeeAmount,
						lateFeesPaid: repayment.lateFeesPaid,
						principalPaid: repayment.principalPaid,
						loan: repayment.loan
					}
				};
			});

			res.json({
				success: true,
				data: transformedData,
			});
		} catch (error) {
			console.error("Error fetching late fees:", error);
			res.status(500).json({
				success: false,
				error: "Failed to fetch late fees",
			});
		}
	}
);

/**
 * Get late fee processing status
 */
router.get(
	"/status",
	authenticateToken,
	isAdmin as unknown as RequestHandler,
	async (_req: AuthRequest, res: Response) => {
		try {
			const status = await LateFeeProcessor.getProcessingStatus();

			// Check for alerts (try both production and development paths)
			const alertsDirs = ["/app/logs/alerts", "./logs/alerts"];
			let alerts: any[] = [];

			for (const alertsDir of alertsDirs) {
				if (fs.existsSync(alertsDir)) {
					const alertFiles = fs
						.readdirSync(alertsDir)
						.filter((file) => file.startsWith("late-fee-"));

					const dirAlerts = alertFiles.map((file) => {
						const alertPath = path.join(alertsDir, file);
						const alertContent = fs.readFileSync(alertPath, "utf8");
						const alertData = JSON.parse(alertContent);

						// Return structured alert data
						return {
							id:
								alertData.data?.alertId ||
								`${alertData.type}_${alertData.timestamp}`,
							type: alertData.type,
							severity: alertData.data?.severity || "MEDIUM",
							title: alertData.data?.title || "System Alert",
							message:
								alertData.data?.message ||
								alertData.data ||
								"Unknown alert",
							timestamp: alertData.timestamp,
							details: alertData.data?.details || {},
							suggestedAction:
								alertData.data?.suggestedAction ||
								"Check system status",
							impact: alertData.data?.impact || "Unknown impact",
							category: alertData.data?.category || "UNKNOWN",
							systemComponent:
								alertData.data?.systemComponent ||
								"Late Fee Processing",
							environment:
								alertData.data?.environment || "unknown",
						};
					});

					alerts = alerts.concat(dirAlerts);
				}
			}

			// Sort all alerts
			alerts = alerts.sort((a, b) => {
				// Sort by severity (HIGH first) then by timestamp (newest first)
				const severityOrder: { [key: string]: number } = {
					HIGH: 3,
					MEDIUM: 2,
					LOW: 1,
				};
				const severityDiff =
					(severityOrder[b.severity] || 1) -
					(severityOrder[a.severity] || 1);
				if (severityDiff !== 0) return severityDiff;
				return (
					new Date(b.timestamp).getTime() -
					new Date(a.timestamp).getTime()
				);
			});

			// Determine overall system health
			let systemHealth = "healthy";
			if (alerts.length > 0) {
				const hasHighSeverity = alerts.some(
					(alert) => alert.severity === "HIGH"
				);
				systemHealth = hasHighSeverity ? "critical" : "warning";
			}

			res.json({
				success: true,
				data: {
					...status,
					alerts,
					systemHealth,
					alertSummary: {
						total: alerts.length,
						high: alerts.filter((a) => a.severity === "HIGH")
							.length,
						medium: alerts.filter((a) => a.severity === "MEDIUM")
							.length,
						low: alerts.filter((a) => a.severity === "LOW").length,
					},
				},
			});
		} catch (error) {
			console.error("Error getting late fee status:", error);
			res.status(500).json({
				success: false,
				error: "Failed to get late fee processing status",
			});
		}
	}
);

/**
 * Manually trigger late fee processing
 */
router.post(
	"/process",
	authenticateToken,
	isAdmin as unknown as RequestHandler,
	async (_req: AuthRequest, res: Response) => {
		try {
			// Manual processing always uses force mode to bypass daily limits
			const result = await LateFeeProcessor.processLateFees(true);

			res.json({
				success: true,
				data: result,
				message: result.isManualRun
					? `Manual processing completed successfully. ${
							result.feesCalculated
					  } fees calculated, $${result.totalFeeAmount.toFixed(
							2
					  )} total amount.`
					: "Processing completed successfully.",
			});
		} catch (error) {
			console.error("Error processing late fees:", error);
			res.status(500).json({
				success: false,
				error: "Failed to process late fees",
			});
		}
	}
);

/**
 * Get late fee summary for a specific repayment
 */
router.get(
	"/repayment/:repaymentId",
	authenticateToken,
	isAdmin as unknown as RequestHandler,
	async (req: AuthRequest, res: Response) => {
		try {
			const { repaymentId } = req.params;
			const summary = await LateFeeProcessor.getLateFeesSummary(
				repaymentId
			);

			res.json({
				success: true,
				data: summary,
			});
		} catch (error) {
			console.error("Error getting late fee summary:", error);
			res.status(500).json({
				success: false,
				error: "Failed to get late fee summary",
			});
		}
	}
);

/**
 * Get total amount due for a repayment including late fees
 */
router.get(
	"/repayment/:repaymentId/total-due",
	authenticateToken,
	isAdmin as unknown as RequestHandler,
	async (req: AuthRequest, res: Response) => {
		try {
			const { repaymentId } = req.params;
			const amountDue = await LateFeeProcessor.getTotalAmountDue(
				repaymentId
			);

			res.json({
				success: true,
				data: amountDue,
			});
		} catch (error) {
			console.error("Error getting total amount due:", error);
			res.status(500).json({
				success: false,
				error: "Failed to get total amount due",
			});
		}
	}
);

/**
 * Manually handle late fee payment for a repayment
 */
router.post(
	"/repayment/:repaymentId/handle-payment",
	authenticateToken,
	isAdmin as unknown as RequestHandler,
	async (req: AuthRequest, res: Response) => {
		try {
			const { repaymentId } = req.params;
			const { paymentAmount, paymentDate } = req.body;

			if (!paymentAmount || paymentAmount <= 0) {
				return res.status(400).json({
					success: false,
					error: "Valid payment amount is required",
				});
			}

			// Get the repayment to find the loanId
			const repayment = await prisma.loanRepayment.findUnique({
				where: { id: repaymentId },
				select: { loanId: true }
			});

			if (!repayment) {
				return res.status(404).json({
					success: false,
					error: "Repayment not found",
				});
			}

			const result = await LateFeeProcessor.handlePaymentAllocation(
				repayment.loanId,
				paymentAmount,
				paymentDate ? new Date(paymentDate) : new Date()
			);

			return res.json({
				success: true,
				data: result,
			});
		} catch (error) {
			console.error("Error handling late fee payment:", error);
			return res.status(500).json({
				success: false,
				error: "Failed to handle late fee payment",
			});
		}
	}
);

/**
 * Manually waive late fees for a specific repayment
 */
router.post(
	"/repayment/:repaymentId/waive",
	authenticateToken,
	isAdmin as unknown as RequestHandler,
	async (req: AuthRequest, res: Response) => {
		try {
			const { repaymentId } = req.params;
			const { reason, adminUserId } = req.body;

			if (!reason || reason.trim().length === 0) {
				return res.status(400).json({
					success: false,
					error: "Waive reason is required",
				});
			}

			// Get the specific repayment with its late fee data
			const repayment = await prisma.loanRepayment.findUnique({
				where: { id: repaymentId },
				include: {
					loan: {
						include: {
							lateFee: true,
						},
					},
				},
			});

			if (!repayment) {
				return res.status(404).json({
					success: false,
					error: "Repayment not found",
				});
			}

			// Check if this repayment has any outstanding late fees
			const outstandingLateFees = Math.max(0, repayment.lateFeeAmount - repayment.lateFeesPaid);
			
			if (outstandingLateFees <= 0) {
				return res.status(400).json({
					success: false,
					error: "No outstanding late fees found for this repayment",
				});
			}

			// Use a transaction to ensure data consistency
			const result = await prisma.$transaction(async (tx) => {
				// Update the repayment to mark late fees as paid (waived)
				await tx.loanRepayment.update({
					where: { id: repaymentId },
					data: {
						lateFeesPaid: repayment.lateFeeAmount, // Mark all late fees as paid
						updatedAt: new Date(),
					},
				});

				// Update the loan-level late fee record to reflect the waived amount
				if (repayment.loan.lateFee) {
					const newTotalAccruedFees = Math.max(0, repayment.loan.lateFee.totalAccruedFees - outstandingLateFees);
					await tx.lateFee.update({
						where: { id: repayment.loan.lateFee.id },
						data: {
							totalAccruedFees: newTotalAccruedFees,
							status: newTotalAccruedFees <= 0 ? "WAIVED" : "ACTIVE",
							updatedAt: new Date(),
						},
					});
				}

				return {
					waivedAmount: outstandingLateFees,
					repaymentId: repaymentId,
					loanId: repayment.loanId,
				};
			});

			// Log the manual waive action for audit trail
			await prisma.$executeRaw`
				INSERT INTO late_fee_processing_logs (
					id, "processedAt", "feesCalculated", "totalFeeAmount", 
					"overdue_repayments", status, "processingTimeMs", metadata, "createdAt"
				) VALUES (
					gen_random_uuid(), NOW(), 0, ${result.waivedAmount}, 1, 'MANUAL_WAIVED', 0, 
					${JSON.stringify({
						type: "manual_waive",
						scope: "repayment",
						repaymentId: repaymentId,
						loanId: result.loanId,
						waivedAmount: result.waivedAmount,
						reason: reason,
						adminUserId: adminUserId || "unknown",
						waivedAt: new Date().toISOString(),
						originalLateFeeAmount: repayment.lateFeeAmount,
						originalLateFeesPaid: repayment.lateFeesPaid,
					})}::jsonb, NOW()
				)
			`;

			return res.json({
				success: true,
				data: {
					repaymentId: repaymentId,
					waivedAmount: result.waivedAmount,
					reason: reason,
				},
				message: `Successfully waived $${result.waivedAmount.toFixed(2)} in late fees for repayment ${repaymentId}`,
			});
		} catch (error) {
			console.error("Error waiving late fees:", error);
			return res.status(500).json({
				success: false,
				error: "Failed to waive late fees",
			});
		}
	}
);

/**
 * Get recent processing logs
 */
router.get(
	"/logs",
	authenticateToken,
	isAdmin as unknown as RequestHandler,
	async (req: AuthRequest, res: Response) => {
		try {
			const limit = parseInt(req.query.limit as string) || 10;

			// Get recent logs using raw query
			const query = `
      SELECT * FROM late_fee_processing_logs
      ORDER BY "processedAt" DESC
      LIMIT $1
    `;

			const logs = await prisma.$queryRawUnsafe(query, limit);

			res.json({
				success: true,
				data: logs,
			});
		} catch (error) {
			console.error("Error getting processing logs:", error);
			res.status(500).json({
				success: false,
				error: "Failed to get processing logs",
			});
		}
	}
);

/**
 * Clear alerts
 */
router.delete(
	"/alerts",
	authenticateToken,
	isAdmin as unknown as RequestHandler,
	async (_req: AuthRequest, res: Response) => {
		try {
			const alertsDirs = ["/app/logs/alerts", "./logs/alerts"];
			let clearedCount = 0;

			for (const alertsDir of alertsDirs) {
				if (fs.existsSync(alertsDir)) {
					const alertFiles = fs
						.readdirSync(alertsDir)
						.filter((file) => file.startsWith("late-fee-"));
					for (const file of alertFiles) {
						fs.unlinkSync(path.join(alertsDir, file));
						clearedCount++;
					}
				}
			}

			res.json({
				success: true,
				data: {
					clearedCount,
					message: `Cleared ${clearedCount} alert(s)`,
				},
			});
		} catch (error) {
			console.error("Error clearing alerts:", error);
			res.status(500).json({
				success: false,
				error: "Failed to clear alerts",
			});
		}
	}
);

export default router;
