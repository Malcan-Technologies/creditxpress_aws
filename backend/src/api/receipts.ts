import { Router, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import ReceiptService from '../lib/receiptService';

const router = Router();

// Admin-only middleware
const adminOnlyMiddleware = async (req: AuthRequest, res: any, next: any) => {
	try {
		if (!req.user?.userId) {
			return res.status(401).json({
				success: false,
				message: "Unauthorized"
			});
		}

		// Check if user is admin
		const user = await prisma.user.findUnique({
			where: { id: req.user.userId },
			select: { role: true }
		});

		if (!user || user.role !== "ADMIN") {
			return res.status(403).json({
				success: false,
				message: "Admin access required"
			});
		}

		next();
	} catch (error) {
		console.error("Admin check error:", error);
		return res.status(500).json({
			success: false,
			message: "Internal server error"
		});
	}
};

/**
 * POST /api/admin/receipts/generate
 * Generate a receipt for a specific repayment
 */
router.post('/generate', authenticateToken, adminOnlyMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { repaymentId, paymentMethod, reference } = req.body;

    if (!repaymentId) {
      return res.status(400).json({
        success: false,
        message: 'Repayment ID is required',
      });
    }

    // TODO: Get admin user from authentication context
    const generatedBy = 'admin'; // Placeholder

    const result = await ReceiptService.generateReceipt({
      repaymentId,
      generatedBy,
      paymentMethod,
      reference,
    });

    return res.json({
      success: true,
      data: result,
      message: 'Receipt generated successfully',
    });
  } catch (error) {
    console.error('Error generating receipt:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to generate receipt',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/admin/receipts/:receiptId/download
 * Download a receipt PDF
 */
router.get('/:receiptId/download', authenticateToken, adminOnlyMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { receiptId } = req.params;

    const receipt = await prisma.paymentReceipt.findUnique({
      where: { id: receiptId },
    });

    if (!receipt) {
      return res.status(404).json({
        success: false,
        message: 'Receipt not found',
      });
    }

    const buffer = await ReceiptService.getReceiptBuffer(receiptId);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${receipt.receiptNumber}.pdf"`);
    return res.send(buffer);
  } catch (error) {
    console.error('Error downloading receipt:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to download receipt',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/admin/receipts/repayment/:repaymentId
 * Get receipt by repayment ID
 */
router.get('/repayment/:repaymentId', authenticateToken, adminOnlyMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { repaymentId } = req.params;

    const receipts = await ReceiptService.getReceiptsByRepaymentId(repaymentId);

    if (!receipts || receipts.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No receipts found for this repayment',
      });
    }

    return res.json({
      success: true,
      data: receipts,
      message: 'Receipts retrieved successfully',
    });
  } catch (error) {
    console.error('Error fetching receipt:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch receipt',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/admin/receipts
 * List all receipts with pagination
 */
router.get('/', authenticateToken, adminOnlyMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;

    const result = await ReceiptService.listReceipts(page, limit);

    return res.json({
      success: true,
      data: result,
      message: 'Receipts retrieved successfully',
    });
  } catch (error) {
    console.error('Error fetching receipts:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch receipts',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * DELETE /api/admin/receipts/:receiptId
 * Delete a receipt
 */
router.delete('/:receiptId', authenticateToken, adminOnlyMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { receiptId } = req.params;

    await ReceiptService.deleteReceipt(receiptId);

    return res.json({
      success: true,
      message: 'Receipt deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting receipt:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete receipt',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
