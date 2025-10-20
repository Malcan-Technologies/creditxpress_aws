import { Router, Response } from 'express';
import { prisma } from '../../lib/prisma';
import { authenticateToken, AuthRequest } from '../../middleware/auth';
import { parseUserAgent } from '../../lib/accessLogger';

const router = Router();

/**
 * Get admin access logs with filtering and pagination
 * GET /api/admin/access-logs
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
    const userRole = req.query.userRole as string;
    const userId = req.query.userId as string;
    const search = req.query.search as string;
    const startDate = req.query.startDate as string;
    const endDate = req.query.endDate as string;

    // Build where clause
    const where: any = {};

    if (year && year !== 'all') {
      const yearNum = parseInt(year);
      where.loginTimestamp = {
        gte: new Date(`${yearNum}-01-01`),
        lt: new Date(`${yearNum + 1}-01-01`),
      };
    }

    if (startDate && endDate) {
      where.loginTimestamp = {
        gte: new Date(startDate),
        lte: new Date(endDate),
      };
    }

    if (userRole && userRole !== 'ALL') {
      where.userRole = userRole;
    }

    if (userId) {
      where.userId = userId;
    }

    if (search) {
      where.OR = [
        { userName: { contains: search, mode: 'insensitive' } },
        { phoneNumber: { contains: search } },
      ];
    }

    // Get total count
    const total = await prisma.adminAccessLog.count({ where });

    // Get logs
    const logs = await prisma.adminAccessLog.findMany({
      where,
      orderBy: { loginTimestamp: 'desc' },
      skip,
      take: limit,
    });

    // Parse user agents for each log
    const logsWithParsedUA = logs.map((log) => {
      const parsed = parseUserAgent(log.userAgent || '');
      return {
        ...log,
        parsedUserAgent: parsed,
      };
    });

    return res.json({
      success: true,
      data: logsWithParsedUA,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching access logs:', error);
    return res.status(500).json({
      error: 'Failed to fetch access logs',
    });
  }
});

/**
 * Export access logs as CSV
 * GET /api/admin/access-logs/export
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
    const userRole = req.query.userRole as string;
    const userId = req.query.userId as string;
    const search = req.query.search as string;
    const startDate = req.query.startDate as string;
    const endDate = req.query.endDate as string;

    // Build where clause
    const where: any = {};

    if (year && year !== 'all') {
      const yearNum = parseInt(year);
      where.loginTimestamp = {
        gte: new Date(`${yearNum}-01-01`),
        lt: new Date(`${yearNum + 1}-01-01`),
      };
    }

    if (startDate && endDate) {
      where.loginTimestamp = {
        gte: new Date(startDate),
        lte: new Date(endDate),
      };
    }

    if (userRole && userRole !== 'ALL') {
      where.userRole = userRole;
    }

    if (userId) {
      where.userId = userId;
    }

    if (search) {
      where.OR = [
        { userName: { contains: search, mode: 'insensitive' } },
        { phoneNumber: { contains: search } },
      ];
    }

    // Get all logs (no pagination for export)
    const logs = await prisma.adminAccessLog.findMany({
      where,
      orderBy: { loginTimestamp: 'desc' },
    });

    // Generate CSV
    const csvHeader = 'Timestamp,User Name,Phone Number,Role,IP Address,Browser,OS,Device,User Agent\n';
    
    const csvRows = logs.map((log) => {
      const parsed = parseUserAgent(log.userAgent || '');
      const timestamp = log.loginTimestamp.toISOString();
      const userName = `"${(log.userName || '').replace(/"/g, '""')}"`;
      const phoneNumber = log.phoneNumber || '';
      const role = log.userRole || '';
      const ipAddress = log.ipAddress || '';
      const browser = parsed.browser;
      const os = parsed.os;
      const device = parsed.device;
      const userAgent = `"${(log.userAgent || '').replace(/"/g, '""')}"`;

      return `${timestamp},${userName},${phoneNumber},${role},${ipAddress},${browser},${os},${device},${userAgent}`;
    }).join('\n');

    const csv = csvHeader + csvRows;

    // Set headers for CSV download
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="admin-access-logs-${new Date().toISOString()}.csv"`);
    
    return res.send(csv);
  } catch (error) {
    console.error('Error exporting access logs:', error);
    return res.status(500).json({
      error: 'Failed to export access logs',
    });
  }
});

export default router;

