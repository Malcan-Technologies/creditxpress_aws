import fs from 'fs-extra';
import path from 'path';
import moment from 'moment-timezone';
import config from '../config';
import logger, { createCorrelatedLogger } from './logger';

export class StorageManager {
  private signedFilesDir: string;

  constructor() {
    this.signedFilesDir = config.storage.signedFilesDir;
  }

  /**
   * Initialize storage directories
   */
  async initialize(correlationId?: string): Promise<void> {
    const log = correlationId ? createCorrelatedLogger(correlationId) : logger;
    
    try {
      await fs.ensureDir(this.signedFilesDir);
      log.info('Storage directories initialized', { signedFilesDir: this.signedFilesDir });
    } catch (error) {
      log.error('Failed to initialize storage directories', { 
        error: error instanceof Error ? error.message : String(error),
        signedFilesDir: this.signedFilesDir 
      });
      throw error;
    }
  }

  /**
   * Generate file path for signed PDF
   */
  generateSignedPdfPath(packetId: string, signerId: string, extension: string = 'pdf'): string {
    const timestamp = moment().tz(config.app.nodeEnv === 'production' ? 'Asia/Kuala_Lumpur' : 'UTC')
      .format('YYYYMMDD_HHmmss');
    
    const filename = `${timestamp}_${packetId}_${signerId}.${extension}`;
    return path.join(this.signedFilesDir, filename);
  }

  /**
   * Save signed PDF from base64 data
   */
  async saveSignedPdf(
    base64Data: string,
    packetId: string,
    signerId: string,
    correlationId?: string
  ): Promise<string> {
    const log = correlationId ? createCorrelatedLogger(correlationId) : logger;
    
    try {
      await this.initialize(correlationId);
      
      // For progressive signing, use consistent filename without timestamp
      let filePath: string;
      if (signerId === 'progressive') {
        // Use consistent filename for progressive signing (one PDF per loan)
        const filename = `${packetId}_signed.pdf`;
        filePath = path.join(this.signedFilesDir, filename);
      } else {
        // Use timestamped filename for regular signing
        filePath = this.generateSignedPdfPath(packetId, signerId);
      }
      
      const buffer = Buffer.from(base64Data, 'base64');
      
      await fs.writeFile(filePath, buffer);
      
      log.info('Signed PDF saved successfully', { 
        filePath, 
        packetId, 
        signerId,
        fileSize: buffer.length,
        isProgressive: signerId === 'progressive'
      });
      
      return filePath;
    } catch (error) {
      log.error('Failed to save signed PDF', { 
        error: error instanceof Error ? error.message : String(error),
        packetId,
        signerId 
      });
      throw error;
    }
  }

  /**
   * Save stamped PDF from base64 data
   */
  async saveStampedPdf(
    base64Data: string,
    applicationId: string,
    fileName: string,
    correlationId?: string
  ): Promise<string> {
    const log = correlationId ? createCorrelatedLogger(correlationId) : logger;
    
    try {
      // Ensure stamped files directory exists
      const stampedFilesDir = config.storage.stampedFilesDir || '/data/stamped';
      await fs.ensureDir(stampedFilesDir);
      
      const filePath = path.join(stampedFilesDir, fileName);
      const buffer = Buffer.from(base64Data, 'base64');
      
      await fs.writeFile(filePath, buffer);
      
      log.info('Stamped PDF saved successfully', { 
        filePath, 
        applicationId, 
        fileName,
        fileSize: buffer.length
      });
      
      return filePath;
    } catch (error) {
      log.error('Failed to save stamped PDF', { 
        error: error instanceof Error ? error.message : String(error),
        applicationId,
        fileName 
      });
      throw error;
    }
  }

  /**
   * Read PDF file and convert to base64
   */
  async readPdfAsBase64(filePath: string, correlationId?: string): Promise<string> {
    const log = correlationId ? createCorrelatedLogger(correlationId) : logger;
    
    try {
      const buffer = await fs.readFile(filePath);
      const base64Data = buffer.toString('base64');
      
      log.debug('PDF file read and converted to base64', { 
        filePath, 
        fileSize: buffer.length 
      });
      
      return base64Data;
    } catch (error) {
      log.error('Failed to read PDF file', { 
        error: error instanceof Error ? error.message : String(error),
        filePath 
      });
      throw error;
    }
  }

  /**
   * Check if file exists
   */
  async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Read file as buffer
   */
  async readFile(filePath: string): Promise<Buffer> {
    return await fs.readFile(filePath);
  }

  /**
   * Get file stats
   */
  async getFileStats(filePath: string): Promise<fs.Stats | null> {
    try {
      return await fs.stat(filePath);
    } catch {
      return null;
    }
  }

  /**
   * List signed PDFs for a packet
   */
  async listSignedPdfs(packetId: string, correlationId?: string): Promise<string[]> {
    const log = correlationId ? createCorrelatedLogger(correlationId) : logger;
    
    try {
      const files = await fs.readdir(this.signedFilesDir);
      const matchingFiles = files.filter(file => 
        file.includes(`_${packetId}_`) && file.endsWith('.pdf')
      );
      
      const fullPaths = matchingFiles.map(file => path.join(this.signedFilesDir, file));
      
      log.debug('Listed signed PDFs for packet', { 
        packetId, 
        count: matchingFiles.length,
        files: matchingFiles 
      });
      
      return fullPaths;
    } catch (error) {
      log.error('Failed to list signed PDFs', { 
        error: error instanceof Error ? error.message : String(error),
        packetId 
      });
      return [];
    }
  }

  /**
   * Clean up old files (older than specified days)
   */
  async cleanupOldFiles(daysOld: number = 30, correlationId?: string): Promise<number> {
    const log = correlationId ? createCorrelatedLogger(correlationId) : logger;
    
    try {
      const files = await fs.readdir(this.signedFilesDir);
      const cutoffDate = moment().subtract(daysOld, 'days');
      let deletedCount = 0;
      
      for (const file of files) {
        const filePath = path.join(this.signedFilesDir, file);
        const stats = await fs.stat(filePath);
        
        if (moment(stats.mtime).isBefore(cutoffDate)) {
          await fs.unlink(filePath);
          deletedCount++;
          log.debug('Deleted old file', { filePath, age: moment().diff(stats.mtime, 'days') });
        }
      }
      
      log.info('Cleanup completed', { deletedCount, daysOld });
      return deletedCount;
    } catch (error) {
      log.error('Failed to cleanup old files', { 
        error: error instanceof Error ? error.message : String(error),
        daysOld 
      });
      return 0;
    }
  }

  /**
   * Health check - verify storage is writable
   */
  async healthCheck(correlationId?: string): Promise<boolean> {
    const log = correlationId ? createCorrelatedLogger(correlationId) : logger;
    
    try {
      await this.initialize(correlationId);
      
      // Try to write a test file
      const testFile = path.join(this.signedFilesDir, '.health-check');
      const testData = `health-check-${Date.now()}`;
      
      await fs.writeFile(testFile, testData);
      const readData = await fs.readFile(testFile, 'utf8');
      await fs.unlink(testFile);
      
      const isHealthy = readData === testData;
      log.debug('Storage health check completed', { isHealthy });
      
      return isHealthy;
    } catch (error) {
      log.warn('Storage health check failed', { 
        error: error instanceof Error ? error.message : String(error) 
      });
      return false;
    }
  }

  /**
   * Get storage usage statistics
   */
  async getStorageStats(correlationId?: string): Promise<{
    totalFiles: number;
    totalSize: number;
    oldestFile?: string;
    newestFile?: string;
  }> {
    const log = correlationId ? createCorrelatedLogger(correlationId) : logger;
    
    try {
      const files = await fs.readdir(this.signedFilesDir);
      let totalSize = 0;
      let oldestTime = Number.MAX_SAFE_INTEGER;
      let newestTime = 0;
      let oldestFile = '';
      let newestFile = '';
      
      for (const file of files) {
        if (file.startsWith('.')) continue; // Skip hidden files
        
        const filePath = path.join(this.signedFilesDir, file);
        const stats = await fs.stat(filePath);
        
        totalSize += stats.size;
        
        if (stats.mtime.getTime() < oldestTime) {
          oldestTime = stats.mtime.getTime();
          oldestFile = file;
        }
        
        if (stats.mtime.getTime() > newestTime) {
          newestTime = stats.mtime.getTime();
          newestFile = file;
        }
      }
      
      const stats = {
        totalFiles: files.filter(f => !f.startsWith('.')).length,
        totalSize,
        ...(oldestFile && { oldestFile }),
        ...(newestFile && { newestFile }),
      };
      
      log.debug('Storage statistics calculated', stats);
      return stats;
    } catch (error) {
      log.error('Failed to get storage statistics', { 
        error: error instanceof Error ? error.message : String(error) 
      });
      return { totalFiles: 0, totalSize: 0 };
    }
  }
}

// Export singleton instance
export const storageManager = new StorageManager();
