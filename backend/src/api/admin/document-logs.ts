import { Router, Response } from 'express';
import { prisma } from '../../lib/prisma';
import { authenticateToken, AuthRequest } from '../../middleware/auth';
import { scanAndIndexDocuments } from '../../lib/documentScanner';

const router = Router();

/**
 * Trigger document scan
 * POST /api/admin/document-logs/scan
 */
router.post('/scan', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    // Check if user is ADMIN
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: { role: true },
    });

    if (!user || user.role !== 'ADMIN') {
      return res.status(403).json({
        error: 'Access denied. Admin privileges required.',
      });
    }

    console.log('Starting document scan triggered by admin:', req.user!.userId);

    // Run the scan
    const stats = await scanAndIndexDocuments();

    return res.json({
      success: true,
      message: 'Document scan completed',
      stats,
    });
  } catch (error) {
    console.error('Error triggering document scan:', error);
    return res.status(500).json({
      error: 'Failed to scan documents',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * Get document logs with filtering and pagination
 * GET /api/admin/document-logs
 */
router.get('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    // Check if user is ADMIN
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: { role: true },
    });

    if (!user || user.role !== 'ADMIN') {
      return res.status(403).json({
        error: 'Access denied. Admin privileges required.',
      });
    }

    // Parse query parameters
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const skip = (page - 1) * limit;

    const year = req.query.year as string;
    const documentType = req.query.documentType as string;
    const source = req.query.source as string;
    const isOrphaned = req.query.isOrphaned as string;
    const search = req.query.search as string;

    // Build where clause
    const where: any = {};

    if (year && year !== 'all') {
      const yearNum = parseInt(year);
      where.uploadedAt = {
        gte: new Date(`${yearNum}-01-01`),
        lt: new Date(`${yearNum + 1}-01-01`),
      };
    }

    if (documentType && documentType !== 'ALL') {
      where.documentType = documentType;
    }

    if (source && source !== 'ALL') {
      if (source === 'S3') {
        where.source = 'S3';
      } else if (source === 'ONPREM') {
        where.source = 'ONPREM';
      }
    }

    if (isOrphaned && isOrphaned !== 'ALL') {
      where.isOrphaned = isOrphaned === 'true';
    }

    if (search) {
      where.OR = [
        { fileName: { contains: search, mode: 'insensitive' } },
        { userName: { contains: search, mode: 'insensitive' } },
        { userId: { contains: search } },
      ];
    }

    // Get total count
    const total = await prisma.documentAuditLog.count({ where });

    // Get logs
    const logs = await prisma.documentAuditLog.findMany({
      where,
      orderBy: { uploadedAt: 'desc' },
      skip,
      take: limit,
    });

    return res.json({
      success: true,
      data: logs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching document logs:', error);
    return res.status(500).json({
      error: 'Failed to fetch document logs',
    });
  }
});

/**
 * Export document logs as CSV
 * GET /api/admin/document-logs/export
 */
router.get('/export', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    // Check if user is ADMIN
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: { role: true },
    });

    if (!user || user.role !== 'ADMIN') {
      return res.status(403).json({
        error: 'Access denied. Admin privileges required.',
      });
    }

    // Parse query parameters (same filters as list endpoint)
    const year = req.query.year as string;
    const documentType = req.query.documentType as string;
    const source = req.query.source as string;
    const isOrphaned = req.query.isOrphaned as string;
    const search = req.query.search as string;

    // Build where clause
    const where: any = {};

    if (year && year !== 'all') {
      const yearNum = parseInt(year);
      where.uploadedAt = {
        gte: new Date(`${yearNum}-01-01`),
        lt: new Date(`${yearNum + 1}-01-01`),
      };
    }

    if (documentType && documentType !== 'ALL') {
      where.documentType = documentType;
    }

    if (source && source !== 'ALL') {
      if (source === 'S3') {
        where.source = 'S3';
      } else if (source === 'ONPREM') {
        where.source = 'ONPREM';
      }
    }

    if (isOrphaned && isOrphaned !== 'ALL') {
      where.isOrphaned = isOrphaned === 'true';
    }

    if (search) {
      where.OR = [
        { fileName: { contains: search, mode: 'insensitive' } },
        { userName: { contains: search, mode: 'insensitive' } },
        { userId: { contains: search } },
      ];
    }

    // Get all logs (no pagination for export)
    const logs = await prisma.documentAuditLog.findMany({
      where,
      orderBy: { uploadedAt: 'desc' },
    });

    // Generate CSV
    const csvHeader = 'File Name,File Path,Type,User Name,User ID,Loan ID,Upload Date,Size (KB),Source,Status\n';
    
    const csvRows = logs.map((log) => {
      const fileName = `"${log.fileName.replace(/"/g, '""')}"`;
      const filePath = `"${log.filePath.replace(/"/g, '""')}"`;
      const type = log.documentType;
      const userName = log.userName ? `"${log.userName.replace(/"/g, '""')}"` : '';
      const userId = log.userId || '';
      const loanId = log.loanId || '';
      const uploadDate = log.uploadedAt.toISOString();
      const sizeKB = (log.fileSize / 1024).toFixed(2);
      const source = log.source;
      const status = log.isOrphaned ? 'Orphaned' : 'Matched';

      return `${fileName},${filePath},${type},${userName},${userId},${loanId},${uploadDate},${sizeKB},${source},${status}`;
    }).join('\n');

    const csv = csvHeader + csvRows;

    // Set headers for CSV download
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="document-logs-${new Date().toISOString()}.csv"`);
    
    return res.send(csv);
  } catch (error) {
    console.error('Error exporting document logs:', error);
    return res.status(500).json({
      error: 'Failed to export document logs',
    });
  }
});

export default router;

