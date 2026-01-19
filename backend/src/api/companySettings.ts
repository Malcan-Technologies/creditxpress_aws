import { Router, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authenticateToken, AuthRequest } from '../middleware/auth';

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

interface CompanySettingsRequest {
  companyName: string;
  companyAddress: string;
  companyRegNo?: string;
  licenseNo?: string;
  contactPhone?: string;
  contactEmail?: string;
  footerNote?: string;
  taxLabel: string;
  companyLogo?: string;
  // Signing configuration
  signUrl?: string;
  serverPublicIp?: string;
}

/**
 * GET /api/admin/company-settings
 * Get current company settings
 */
router.get('/', authenticateToken, adminOnlyMiddleware, async (_req: AuthRequest, res: Response) => {
  try {
    let companySettings = await prisma.companySettings.findFirst({
      where: { isActive: true },
    });

    // Create default settings if none exist
    if (!companySettings) {
      companySettings = await prisma.companySettings.create({
        data: {
          companyName: 'Kredit.my',
          companyAddress: 'Kuala Lumpur, Malaysia',
          taxLabel: 'SST 6%',
          isActive: true,
        },
      });
    }

    res.json({
      success: true,
      data: companySettings,
      message: 'Company settings retrieved successfully',
    });
  } catch (error) {
    console.error('Error fetching company settings:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch company settings',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/admin/company-settings
 * Create or update company settings
 */
router.post('/', authenticateToken, adminOnlyMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const {
      companyName,
      companyAddress,
      companyRegNo,
      licenseNo,
      contactPhone,
      contactEmail,
      footerNote,
      taxLabel,
      companyLogo,
      signUrl,
      serverPublicIp,
    }: CompanySettingsRequest = req.body;

    // Validation
    if (!companyName || !companyAddress || !taxLabel) {
      return res.status(400).json({
        success: false,
        message: 'Company name, address, and tax label are required',
      });
    }

    // Check if settings already exist
    const existingSettings = await prisma.companySettings.findFirst({
      where: { isActive: true },
    });

    let companySettings;

    if (existingSettings) {
      // Update existing settings
      companySettings = await prisma.companySettings.update({
        where: { id: existingSettings.id },
        data: {
          companyName,
          companyAddress,
          companyRegNo: companyRegNo || null,
          licenseNo: licenseNo || null,
          contactPhone: contactPhone || null,
          contactEmail: contactEmail || null,
          footerNote: footerNote || null,
          taxLabel,
          companyLogo: companyLogo || null,
          signUrl: signUrl || null,
          serverPublicIp: serverPublicIp || null,
          updatedAt: new Date(),
          // TODO: Add createdBy field when admin user context is available
        },
      });
    } else {
      // Create new settings
      companySettings = await prisma.companySettings.create({
        data: {
          companyName,
          companyAddress,
          companyRegNo: companyRegNo || null,
          licenseNo: licenseNo || null,
          contactPhone: contactPhone || null,
          contactEmail: contactEmail || null,
          footerNote: footerNote || null,
          taxLabel,
          companyLogo: companyLogo || null,
          signUrl: signUrl || null,
          serverPublicIp: serverPublicIp || null,
          isActive: true,
          // TODO: Add createdBy field when admin user context is available
        },
      });
    }

    return res.json({
      success: true,
      data: companySettings,
      message: 'Company settings saved successfully',
    });
  } catch (error) {
    console.error('Error saving company settings:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to save company settings',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * DELETE /api/admin/company-settings/:id
 * Delete company settings (soft delete by setting isActive to false)
 */
router.delete('/:id', authenticateToken, adminOnlyMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const companySettings = await prisma.companySettings.update({
      where: { id },
      data: {
        isActive: false,
        updatedAt: new Date(),
      },
    });

    res.json({
      success: true,
      data: companySettings,
      message: 'Company settings deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting company settings:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete company settings',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
