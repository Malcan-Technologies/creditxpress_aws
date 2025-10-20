import { Request } from 'express';
import { prisma } from './prisma';

/**
 * Parse User-Agent string to extract browser, OS, and device information
 */
export function parseUserAgent(userAgent: string): {
  browser: string;
  os: string;
  device: string;
} {
  if (!userAgent) {
    return { browser: 'Unknown', os: 'Unknown', device: 'Unknown' };
  }

  // Browser detection
  let browser = 'Unknown';
  if (userAgent.includes('Chrome') && !userAgent.includes('Edge')) {
    browser = 'Chrome';
  } else if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) {
    browser = 'Safari';
  } else if (userAgent.includes('Firefox')) {
    browser = 'Firefox';
  } else if (userAgent.includes('Edge') || userAgent.includes('Edg/')) {
    browser = 'Edge';
  } else if (userAgent.includes('Opera') || userAgent.includes('OPR')) {
    browser = 'Opera';
  } else if (userAgent.includes('MSIE') || userAgent.includes('Trident')) {
    browser = 'Internet Explorer';
  }

  // OS detection
  let os = 'Unknown';
  if (userAgent.includes('Windows NT 10.0')) {
    os = 'Windows 10';
  } else if (userAgent.includes('Windows NT 6.3')) {
    os = 'Windows 8.1';
  } else if (userAgent.includes('Windows NT 6.2')) {
    os = 'Windows 8';
  } else if (userAgent.includes('Windows NT 6.1')) {
    os = 'Windows 7';
  } else if (userAgent.includes('Windows')) {
    os = 'Windows';
  } else if (userAgent.includes('Mac OS X')) {
    const match = userAgent.match(/Mac OS X (\d+[._]\d+)/);
    os = match ? `macOS ${match[1].replace('_', '.')}` : 'macOS';
  } else if (userAgent.includes('Linux')) {
    os = 'Linux';
  } else if (userAgent.includes('Android')) {
    const match = userAgent.match(/Android (\d+(\.\d+)?)/);
    os = match ? `Android ${match[1]}` : 'Android';
  } else if (userAgent.includes('iOS') || userAgent.includes('iPhone') || userAgent.includes('iPad')) {
    const match = userAgent.match(/OS (\d+[._]\d+)/);
    os = match ? `iOS ${match[1].replace('_', '.')}` : 'iOS';
  }

  // Device detection
  let device = 'Desktop';
  if (userAgent.includes('Mobile') || userAgent.includes('Android')) {
    device = 'Mobile';
  } else if (userAgent.includes('Tablet') || userAgent.includes('iPad')) {
    device = 'Tablet';
  }

  return { browser, os, device };
}

/**
 * Extract IP address from request
 * Handles X-Forwarded-For header for reverse proxy setups
 */
export function extractIpAddress(req: Request): string {
  // Check X-Forwarded-For header first (for nginx reverse proxy)
  const forwardedFor = req.headers['x-forwarded-for'];
  
  if (forwardedFor) {
    // X-Forwarded-For can be a comma-separated list, take the first one
    const ips = typeof forwardedFor === 'string' 
      ? forwardedFor.split(',') 
      : forwardedFor;
    let clientIp = ips[0].trim();
    // Clean up IPv6-mapped IPv4 addresses (::ffff:192.168.1.1 -> 192.168.1.1)
    clientIp = clientIp.replace(/^::ffff:/i, '');
    return clientIp;
  }

  // Fallback to direct connection IP and clean up IPv6 format
  let ip = req.ip || req.connection?.remoteAddress || 'Unknown';
  ip = ip.replace(/^::ffff:/i, '');
  return ip;
}

/**
 * Log admin access for audit purposes
 */
export async function logAdminAccess(
  userId: string,
  userName: string,
  phoneNumber: string,
  userRole: string,
  req: Request
): Promise<string> {
  try {
    const ipAddress = extractIpAddress(req);
    const userAgent = req.headers['user-agent'] || '';
    
    // Log the raw user agent for debugging
    console.log('User-Agent received:', userAgent);
    const parsed = parseUserAgent(userAgent);
    console.log('Parsed User-Agent:', parsed);

    const accessLog = await prisma.adminAccessLog.create({
      data: {
        userId,
        userName,
        phoneNumber,
        userRole,
        ipAddress,
        userAgent,
        loginTimestamp: new Date(),
      },
    });

    console.log('Admin access logged:', {
      logId: accessLog.id,
      userId,
      userName,
      userRole,
      ipAddress,
    });

    return accessLog.id;
  } catch (error) {
    console.error('Failed to log admin access:', error);
    // Don't throw - logging failure shouldn't prevent login
    return '';
  }
}

/**
 * Update admin access log on logout
 */
export async function logAdminLogout(
  userId: string,
  loginTimestamp: Date
): Promise<void> {
  try {
    // Find the most recent access log for this user
    const accessLog = await prisma.adminAccessLog.findFirst({
      where: {
        userId,
        loginTimestamp,
        logoutTimestamp: null,
      },
      orderBy: {
        loginTimestamp: 'desc',
      },
    });

    if (accessLog) {
      const now = new Date();
      const sessionDuration = Math.floor(
        (now.getTime() - accessLog.loginTimestamp.getTime()) / (1000 * 60)
      ); // Duration in minutes

      await prisma.adminAccessLog.update({
        where: { id: accessLog.id },
        data: {
          logoutTimestamp: now,
          sessionDuration,
        },
      });

      console.log('Admin logout logged:', {
        logId: accessLog.id,
        userId,
        sessionDuration,
      });
    }
  } catch (error) {
    console.error('Failed to log admin logout:', error);
    // Don't throw - logging failure shouldn't prevent logout
  }
}

