import { Router } from "express";
import { requireAdminOrAttestor } from "../../lib/permissions";
import { AuthRequest, authenticateToken } from "../../middleware/auth";
import { CronScheduler } from "../../lib/cronScheduler";
import { logger } from "../../lib/logger";

const router = Router();

/**
 * @swagger
 * /api/admin/cron/trigger-late-fee-processing:
 *   post:
 *     summary: Manually trigger late fee processing
 *     tags: [Admin - Cron]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Late fee processing triggered successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *       500:
 *         description: Internal server error
 */
router.post("/trigger-late-fee-processing", authenticateToken, requireAdminOrAttestor, async (req: AuthRequest, res) => {
	try {
		logger.info("Manual late fee processing triggered by admin", {
			adminId: req.user?.userId,
			adminEmail: req.user?.fullName,
		});

		const cronScheduler = CronScheduler.getInstance();
		const result = await cronScheduler.triggerLateFeeProcessing();

		res.json({
			success: true,
			message: "Late fee processing completed successfully",
			data: result,
		});
	} catch (error) {
		logger.error("Error in manual late fee processing:", error);
		res.status(500).json({
			success: false,
			message: error instanceof Error ? error.message : "Internal server error",
		});
	}
});

/**
 * @swagger
 * /api/admin/cron/trigger-default-processing:
 *   post:
 *     summary: Manually trigger default processing (28-day and 42-day checks)
 *     tags: [Admin - Cron]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Default processing triggered successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *       500:
 *         description: Internal server error
 */
router.post("/trigger-default-processing", authenticateToken, requireAdminOrAttestor, async (req: AuthRequest, res) => {
	try {
		logger.info("Manual default processing triggered by admin", {
			adminId: req.user?.userId,
			adminEmail: req.user?.fullName,
		});

		const cronScheduler = CronScheduler.getInstance();
		const result = await cronScheduler.triggerDefaultProcessing();

		res.json({
			success: true,
			message: "Default processing completed successfully",
			data: result,
		});
	} catch (error) {
		logger.error("Error in manual default processing:", error);
		res.status(500).json({
			success: false,
			message: error instanceof Error ? error.message : "Internal server error",
		});
	}
});

/**
 * @swagger
 * /api/admin/cron/trigger-payment-notifications:
 *   post:
 *     summary: Manually trigger payment notifications processing
 *     tags: [Admin - Cron]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Payment notifications processing triggered successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *       500:
 *         description: Internal server error
 */
router.post("/trigger-payment-notifications", authenticateToken, requireAdminOrAttestor, async (req: AuthRequest, res) => {
	try {
		logger.info("Manual payment notifications processing triggered by admin", {
			adminId: req.user?.userId,
			adminEmail: req.user?.fullName,
		});

		const cronScheduler = CronScheduler.getInstance();
		const result = await cronScheduler.triggerPaymentNotifications();

		res.json({
			success: true,
			message: "Payment notifications processing completed successfully",
			data: result,
		});
	} catch (error) {
		logger.error("Error in manual payment notifications processing:", error);
		res.status(500).json({
			success: false,
			message: error instanceof Error ? error.message : "Internal server error",
		});
	}
});

/**
 * @swagger
 * /api/admin/cron/status:
 *   get:
 *     summary: Get cron job status
 *     tags: [Admin - Cron]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Cron job status retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       name:
 *                         type: string
 *                       running:
 *                         type: boolean
 *       500:
 *         description: Internal server error
 */
router.get("/status", authenticateToken, requireAdminOrAttestor, async (_req, res) => {
	try {
		const cronScheduler = CronScheduler.getInstance();
		const status = cronScheduler.getStatus();

		res.json({
			success: true,
			data: status,
		});
	} catch (error) {
		logger.error("Error getting cron job status:", error);
		res.status(500).json({
			success: false,
			message: error instanceof Error ? error.message : "Internal server error",
		});
	}
});

export default router;
