import { Router, Response } from 'express';
import { authenticateToken, AuthRequest } from '../../middleware/auth';
import { requireAdminOrAttestor } from '../../lib/permissions';
import prisma from '../../lib/prisma';
import { signingConfig } from '../../lib/config';

const router = Router();

/**
 * @swagger
 * /api/admin/internal-signers:
 *   get:
 *     summary: List all internal signers
 *     tags: [Admin, Internal Signers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *         description: Filter by status (PENDING, VERIFIED, EXPIRED, REVOKED, INACTIVE)
 *       - in: query
 *         name: signerRole
 *         schema:
 *           type: string
 *         description: Filter by role (ADMIN, ATTESTOR, WITNESS, COMPANY_REP)
 *     responses:
 *       200:
 *         description: List of internal signers
 *       403:
 *         description: Admin access required
 */
router.get('/', authenticateToken, requireAdminOrAttestor, async (req: AuthRequest, res: Response) => {
  try {
    const { status, signerRole } = req.query;
    
    const where: Record<string, string> = {};
    if (status && typeof status === 'string') {
      where.status = status;
    }
    if (signerRole && typeof signerRole === 'string') {
      where.signerRole = signerRole;
    }

    const signers = await prisma.internalSigner.findMany({
      where,
      orderBy: { createdAt: 'desc' }
    });

    return res.json({
      success: true,
      data: signers,
      total: signers.length
    });
  } catch (error) {
    console.error('Error fetching internal signers:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch internal signers'
    });
  }
});

/**
 * @swagger
 * /api/admin/internal-signers/lookup/{icNumber}:
 *   get:
 *     summary: Lookup certificate info for an IC number
 *     tags: [Admin, Internal Signers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: icNumber
 *         required: true
 *         schema:
 *           type: string
 *         description: IC number to lookup
 *     responses:
 *       200:
 *         description: Certificate and user info
 *       403:
 *         description: Admin access required
 */
router.get('/lookup/:icNumber', authenticateToken, requireAdminOrAttestor, async (req: AuthRequest, res: Response) => {
  try {
    const { icNumber } = req.params;
    
    if (!icNumber || !/^\d{12}$/.test(icNumber)) {
      return res.status(400).json({
        success: false,
        message: 'Valid 12-digit IC number is required'
      });
    }

    // Check if already in internal signers table
    const existingSigner = await prisma.internalSigner.findUnique({
      where: { icNumber }
    });

    if (existingSigner) {
      return res.json({
        success: true,
        alreadyExists: true,
        signer: existingSigner,
        message: 'This IC number is already registered as an internal signer'
      });
    }

    // Check if user exists in User table
    const user = await prisma.user.findFirst({
      where: { icNumber },
      select: {
        id: true,
        fullName: true,
        email: true,
        phoneNumber: true,
        role: true
      }
    });

    // Call signing orchestrator to get cert info
    const certResponse = await fetch(`${signingConfig.url}/api/cert/${icNumber}`, {
      method: 'GET',
      headers: {
        'X-API-Key': signingConfig.apiKey,
        'Content-Type': 'application/json',
      },
    });

    const certData = await certResponse.json();

    return res.json({
      success: true,
      alreadyExists: false,
      userInfo: user ? {
        userId: user.id,
        fullName: user.fullName,
        email: user.email,
        phoneNumber: user.phoneNumber,
        role: user.role
      } : null,
      certificateInfo: certData.success ? {
        certStatus: certData.data?.certStatus,
        certSerialNo: certData.data?.certSerialNo,
        certValidFrom: certData.data?.certValidFrom || certData.data?.validFrom,
        certValidTo: certData.data?.certValidTo || certData.data?.validTo,
      } : null,
      hasCertificate: certData.success && certData.data?.certStatus === 'Valid',
      message: certData.success 
        ? `Certificate found: ${certData.data?.certStatus}` 
        : 'No certificate found for this IC number'
    });
  } catch (error) {
    console.error('Error looking up IC number:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to lookup IC number'
    });
  }
});

/**
 * @swagger
 * /api/admin/internal-signers:
 *   post:
 *     summary: Add a new internal signer
 *     tags: [Admin, Internal Signers]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - icNumber
 *               - fullName
 *               - email
 *               - signerRole
 *             properties:
 *               icNumber:
 *                 type: string
 *               fullName:
 *                 type: string
 *               email:
 *                 type: string
 *               phoneNumber:
 *                 type: string
 *               signerRole:
 *                 type: string
 *                 enum: [ADMIN, ATTESTOR, WITNESS, COMPANY_REP]
 *               certSerialNo:
 *                 type: string
 *               certStatus:
 *                 type: string
 *               certValidFrom:
 *                 type: string
 *               certValidTo:
 *                 type: string
 *               notes:
 *                 type: string
 *     responses:
 *       200:
 *         description: Internal signer added
 *       403:
 *         description: Admin access required
 */
router.post('/', authenticateToken, requireAdminOrAttestor, async (req: AuthRequest, res: Response) => {
  try {
    const { 
      icNumber, 
      fullName, 
      email, 
      phoneNumber, 
      signerRole,
      certSerialNo,
      certStatus,
      certValidFrom,
      certValidTo,
      notes,
      userId
    } = req.body;

    if (!icNumber || !fullName || !email || !signerRole) {
      return res.status(400).json({
        success: false,
        message: 'IC number, full name, email, and signer role are required'
      });
    }

    const validRoles = ['ADMIN', 'ATTESTOR', 'WITNESS', 'COMPANY_REP'];
    if (!validRoles.includes(signerRole)) {
      return res.status(400).json({
        success: false,
        message: `Invalid signer role. Valid values: ${validRoles.join(', ')}`
      });
    }

    // Check if already exists
    const existing = await prisma.internalSigner.findUnique({
      where: { icNumber }
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        message: 'An internal signer with this IC number already exists'
      });
    }

    // Get current admin's IC for enrolledBy
    const currentUser = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: { icNumber: true, fullName: true }
    });

    const signer = await prisma.internalSigner.create({
      data: {
        icNumber,
        fullName,
        email,
        phoneNumber,
        signerRole,
        userId,
        certSerialNo,
        certStatus,
        certValidFrom: certValidFrom ? new Date(certValidFrom) : null,
        certValidTo: certValidTo ? new Date(certValidTo) : null,
        lastCertCheck: new Date(),
        status: 'PENDING', // Always starts as PENDING until PIN verified
        enrolledAt: new Date(),
        enrolledBy: currentUser?.icNumber || currentUser?.fullName || req.user!.userId,
        notes
      }
    });

    return res.json({
      success: true,
      data: signer,
      message: 'Internal signer added successfully. PIN verification required.'
    });
  } catch (error) {
    console.error('Error adding internal signer:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to add internal signer'
    });
  }
});

/**
 * @swagger
 * /api/admin/internal-signers/{id}/verify-pin:
 *   post:
 *     summary: Verify PIN for an internal signer
 *     tags: [Admin, Internal Signers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - pin
 *             properties:
 *               pin:
 *                 type: string
 *                 description: 8-digit PIN
 *     responses:
 *       200:
 *         description: PIN verification result
 *       403:
 *         description: Admin access required
 */
router.post('/:id/verify-pin', authenticateToken, requireAdminOrAttestor, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { pin } = req.body;

    if (!pin || !/^\d{8}$/.test(pin)) {
      return res.status(400).json({
        success: false,
        message: 'Valid 8-digit PIN is required'
      });
    }

    // Get the signer
    const signer = await prisma.internalSigner.findUnique({
      where: { id }
    });

    if (!signer) {
      return res.status(404).json({
        success: false,
        message: 'Internal signer not found'
      });
    }

    if (!signer.certSerialNo) {
      return res.status(400).json({
        success: false,
        message: 'No certificate serial number found. Cannot verify PIN.'
      });
    }

    // Call signing orchestrator to verify PIN
    const response = await fetch(`${signingConfig.url}/api/verify-cert-pin`, {
      method: 'POST',
      headers: {
        'X-API-Key': signingConfig.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId: signer.icNumber,
        certSerialNo: signer.certSerialNo,
        pin
      }),
    });

    const result = await response.json();

    if (result.success && result.data?.pinVerified) {
      // Update status to VERIFIED
      const updated = await prisma.internalSigner.update({
        where: { id },
        data: {
          status: 'VERIFIED',
          pinVerifiedAt: new Date()
        }
      });

      return res.json({
        success: true,
        data: updated,
        message: 'PIN verified successfully. Signer is now VERIFIED.'
      });
    } else {
      return res.json({
        success: false,
        message: result.message || 'PIN verification failed'
      });
    }
  } catch (error) {
    console.error('Error verifying PIN:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to verify PIN'
    });
  }
});

/**
 * @swagger
 * /api/admin/internal-signers/{id}:
 *   put:
 *     summary: Update an internal signer
 *     tags: [Admin, Internal Signers]
 *     security:
 *       - bearerAuth: []
 */
router.put('/:id', authenticateToken, requireAdminOrAttestor, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { signerRole, notes, status, fullName, email, phoneNumber } = req.body;

    const updateData: Record<string, unknown> = {};
    
    if (signerRole) {
      const validRoles = ['ADMIN', 'ATTESTOR', 'WITNESS', 'COMPANY_REP'];
      if (!validRoles.includes(signerRole)) {
        return res.status(400).json({
          success: false,
          message: `Invalid signer role. Valid values: ${validRoles.join(', ')}`
        });
      }
      updateData.signerRole = signerRole;
    }
    
    if (status) {
      const validStatuses = ['PENDING', 'VERIFIED', 'EXPIRED', 'REVOKED', 'INACTIVE'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          message: `Invalid status. Valid values: ${validStatuses.join(', ')}`
        });
      }
      updateData.status = status;
    }
    
    if (notes !== undefined) updateData.notes = notes;
    if (fullName) updateData.fullName = fullName;
    if (email) updateData.email = email;
    if (phoneNumber !== undefined) updateData.phoneNumber = phoneNumber;

    const updated = await prisma.internalSigner.update({
      where: { id },
      data: updateData
    });

    return res.json({
      success: true,
      data: updated,
      message: 'Internal signer updated successfully'
    });
  } catch (error) {
    console.error('Error updating internal signer:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update internal signer'
    });
  }
});

/**
 * @swagger
 * /api/admin/internal-signers/refresh:
 *   post:
 *     summary: Refresh certificate status for all internal signers
 *     tags: [Admin, Internal Signers]
 *     security:
 *       - bearerAuth: []
 */
router.post('/refresh', authenticateToken, requireAdminOrAttestor, async (_req: AuthRequest, res: Response) => {
  try {
    const signers = await prisma.internalSigner.findMany({
      where: {
        status: { in: ['PENDING', 'VERIFIED'] }
      }
    });

    const results = [];

    for (const signer of signers) {
      try {
        // Call signing orchestrator to get cert info
        const certResponse = await fetch(`${signingConfig.url}/api/cert/${signer.icNumber}`, {
          method: 'GET',
          headers: {
            'X-API-Key': signingConfig.apiKey,
            'Content-Type': 'application/json',
          },
        });

        const certData = await certResponse.json();

        const updateData: Record<string, unknown> = {
          lastCertCheck: new Date()
        };

        if (certData.success && certData.data) {
          updateData.certStatus = certData.data.certStatus;
          updateData.certSerialNo = certData.data.certSerialNo;
          if (certData.data.certValidFrom || certData.data.validFrom) {
            updateData.certValidFrom = new Date(certData.data.certValidFrom || certData.data.validFrom);
          }
          if (certData.data.certValidTo || certData.data.validTo) {
            updateData.certValidTo = new Date(certData.data.certValidTo || certData.data.validTo);
          }

          // Update status based on cert status
          if (certData.data.certStatus === 'Expired') {
            updateData.status = 'EXPIRED';
          } else if (certData.data.certStatus === 'Revoked') {
            updateData.status = 'REVOKED';
          }
        }

        await prisma.internalSigner.update({
          where: { id: signer.id },
          data: updateData
        });

        results.push({ id: signer.id, icNumber: signer.icNumber, success: true });
      } catch (err) {
        results.push({ id: signer.id, icNumber: signer.icNumber, success: false, error: String(err) });
      }
    }

    return res.json({
      success: true,
      message: `Refreshed ${results.length} signers`,
      data: results
    });
  } catch (error) {
    console.error('Error refreshing internal signers:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to refresh internal signers'
    });
  }
});

/**
 * @swagger
 * /api/admin/internal-signers/{id}:
 *   delete:
 *     summary: Delete an internal signer
 *     tags: [Admin, Internal Signers]
 *     security:
 *       - bearerAuth: []
 */
router.delete('/:id', authenticateToken, requireAdminOrAttestor, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    await prisma.internalSigner.delete({
      where: { id }
    });

    return res.json({
      success: true,
      message: 'Internal signer removed successfully'
    });
  } catch (error) {
    console.error('Error deleting internal signer:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete internal signer'
    });
  }
});

export default router;
