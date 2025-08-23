import React from 'react';
import { renderToBuffer } from '@react-pdf/renderer';
import { promises as fs } from 'fs';
import path from 'path';
import { prisma } from './prisma';
import PaymentReceiptDocument, { ReceiptData } from './receiptTemplate';

interface GenerateReceiptParams {
  repaymentId: string;
  generatedBy: string;
  paymentMethod?: string;
  reference?: string;
  actualPaymentAmount?: number;
  transactionId?: string;
}

interface RepaymentWithDetails {
  id: string;
  amount: number;
  principalAmount: number;
  interestAmount: number;
  lateFeeAmount: number;
  lateFeesPaid: number;
  principalPaid: number;
  actualAmount: number;
  installmentNumber?: number;
  dueDate: Date;
  paidAt: Date | null;
  status: string;
  loan: {
    id: string;
    principalAmount: number;
    interestRate: number;
    term: number;
    user: {
      fullName: string;
      email: string;
      phoneNumber: string;
    };
  };
}

export class ReceiptService {
  private static readonly RECEIPTS_DIR = path.join(process.cwd(), 'receipts');

  /**
   * Ensure receipts directory exists
   */
  private static async ensureReceiptsDirectory(): Promise<void> {
    try {
      await fs.access(this.RECEIPTS_DIR);
    } catch {
      await fs.mkdir(this.RECEIPTS_DIR, { recursive: true });
    }
  }

  /**
   * Generate sequential receipt number
   */
  private static async generateReceiptNumber(): Promise<string> {
    const currentYear = new Date().getFullYear();
    const prefix = `RCP-${currentYear}-`;
    
    // Find the highest receipt number for current year
    const lastReceipt = await prisma.paymentReceipt.findFirst({
      where: {
        receiptNumber: {
          startsWith: prefix,
        },
      },
      orderBy: {
        receiptNumber: 'desc',
      },
    });

    let nextNumber = 1;
    if (lastReceipt) {
      const lastNumber = parseInt(lastReceipt.receiptNumber.replace(prefix, ''));
      nextNumber = lastNumber + 1;
    }

    return `${prefix}${nextNumber.toString().padStart(3, '0')}`;
  }

  /**
   * Get company settings for receipt generation
   */
  private static async getCompanySettings() {
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

    return companySettings;
  }

  /**
   * Get repayment details with loan and user information
   */
  private static async getRepaymentDetails(repaymentId: string, transactionId?: string): Promise<{
    repayment: RepaymentWithDetails;
    walletTransaction: any;
  }> {
    const repayment = await prisma.loanRepayment.findUnique({
      where: { id: repaymentId },
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
          },
        },
      },
    });

    if (!repayment) {
      throw new Error(`Repayment with ID ${repaymentId} not found`);
    }

    if (repayment.status !== 'COMPLETED' && repayment.status !== 'PARTIAL') {
      throw new Error(`Cannot generate receipt for repayment with status: ${repayment.status}`);
    }

    // Get wallet transaction details if transactionId is provided
    let walletTransaction = null;
    if (transactionId) {
      walletTransaction = await prisma.walletTransaction.findUnique({
        where: { id: transactionId },
      });
    }

    return { 
      repayment: repayment as RepaymentWithDetails, 
      walletTransaction 
    };
  }

  /**
   * Generate PDF receipt for a payment
   */
  static async generateReceipt(params: GenerateReceiptParams): Promise<{
    receiptId: string;
    receiptNumber: string;
    filePath: string;
  }> {
    try {
      // Ensure receipts directory exists
      await this.ensureReceiptsDirectory();

      // Check if receipt already exists for this specific transaction
      // Allow multiple receipts for the same repayment if they're from different transactions
      const existingReceipt = await prisma.paymentReceipt.findFirst({
        where: {
          repaymentId: params.repaymentId,
          metadata: {
            path: ['transactionId'],
            equals: params.transactionId
          }
        }
      });

      if (existingReceipt) {
        console.log(`Receipt already exists for transaction ${params.transactionId}: ${existingReceipt.receiptNumber}`);
        return {
          receiptId: existingReceipt.id,
          receiptNumber: existingReceipt.receiptNumber,
          filePath: existingReceipt.filePath,
        };
      }

      // Get repayment details
      const { repayment, walletTransaction } = await this.getRepaymentDetails(params.repaymentId, params.transactionId);
      
      // Get company settings
      const companySettings = await this.getCompanySettings();

      // Generate receipt number
      const receiptNumber = await this.generateReceiptNumber();

      // Check if payment is late (paid after due date)
      const paymentDate = repayment.paidAt || new Date();
      const isLate = paymentDate > repayment.dueDate;

      // Prepare receipt data
      const receiptData: ReceiptData = {
        receiptNumber,
        generatedAt: new Date().toISOString(),
        customer: {
          id: repayment.loan.id.substring(0, 8), // Use loan ID instead
          name: repayment.loan.user.fullName || 'N/A',
          email: repayment.loan.user.email || 'N/A',
          phone: repayment.loan.user.phoneNumber || 'N/A',
        },
        loan: {
          id: repayment.loan.id,
          principalAmount: repayment.loan.principalAmount,
          interestRate: repayment.loan.interestRate,
          term: repayment.loan.term,
        },
        payment: {
          installmentNumber: repayment.installmentNumber || undefined,
          dueDate: repayment.dueDate.toISOString(),
          principalAmount: repayment.principalAmount,
          interestAmount: repayment.interestAmount,
          lateFeeAmount: repayment.lateFeeAmount,
          lateFeesPaid: repayment.lateFeesPaid,
          totalAmount: repayment.amount,
          paidAmount: params.actualPaymentAmount || repayment.actualAmount || repayment.amount,
          paymentDate: repayment.paidAt?.toISOString() || new Date().toISOString(),
          paymentMethod: params.paymentMethod === 'FRESH_FUNDS' ? 'Bank Transfer' : params.paymentMethod,
          reference: params.reference,
          isLate: isLate,
        },
        transaction: {
          processedAt: walletTransaction?.processedAt?.toISOString(),
          createdAt: walletTransaction?.createdAt?.toISOString() || new Date().toISOString(),
        },
        company: {
          name: companySettings.companyName,
          address: companySettings.companyAddress,
          regNo: companySettings.companyRegNo || undefined,
          phone: companySettings.contactPhone || undefined,
          email: companySettings.contactEmail || undefined,
          footerNote: companySettings.footerNote || undefined,
          taxLabel: companySettings.taxLabel,
          logoPath: companySettings.companyLogo || undefined,
        },
      };

      // Generate PDF
      const receiptDocument = PaymentReceiptDocument({ data: receiptData }) as React.ReactElement;
      const pdfBuffer = await renderToBuffer(receiptDocument);

      // Save PDF to file
      const fileName = `${receiptNumber}.pdf`;
      const filePath = path.join(this.RECEIPTS_DIR, fileName);
      await fs.writeFile(filePath, pdfBuffer);

      // Save receipt record to database
      const receiptRecord = await prisma.paymentReceipt.create({
        data: {
          repaymentId: params.repaymentId,
          receiptNumber,
          filePath,
          generatedBy: params.generatedBy,
          metadata: {
            transactionId: params.transactionId, // Store transaction ID for duplicate prevention
            companySettings: {
              name: companySettings.companyName,
              address: companySettings.companyAddress,
              regNo: companySettings.companyRegNo,
              phone: companySettings.contactPhone,
              email: companySettings.contactEmail,
              footerNote: companySettings.footerNote,
              taxLabel: companySettings.taxLabel,
            },
            paymentDetails: {
              paymentMethod: params.paymentMethod,
              reference: params.reference,
            },
          },
        },
      });

      return {
        receiptId: receiptRecord.id,
        receiptNumber: receiptRecord.receiptNumber,
        filePath: receiptRecord.filePath,
      };
    } catch (error) {
      console.error('Error generating receipt:', error);
      throw new Error(`Failed to generate receipt: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get receipt file buffer for download
   */
  static async getReceiptBuffer(receiptId: string): Promise<Buffer> {
    const receipt = await prisma.paymentReceipt.findUnique({
      where: { id: receiptId },
    });

    if (!receipt) {
      throw new Error(`Receipt with ID ${receiptId} not found`);
    }

    try {
      const buffer = await fs.readFile(receipt.filePath);
      return buffer;
    } catch (error) {
      throw new Error(`Failed to read receipt file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get receipts by repayment ID (now returns multiple receipts)
   */
  static async getReceiptsByRepaymentId(repaymentId: string) {
    return await prisma.paymentReceipt.findMany({
      where: { repaymentId },
      orderBy: { generatedAt: 'desc' }
    });
  }

  /**
   * List all receipts with pagination
   */
  static async listReceipts(page: number = 1, limit: number = 50) {
    const skip = (page - 1) * limit;
    
    const [receipts, total] = await Promise.all([
      prisma.paymentReceipt.findMany({
        skip,
        take: limit,
        orderBy: { generatedAt: 'desc' },
        include: {
          repayment: {
            include: {
              loan: {
                include: {
                  user: {
                    select: {
                      fullName: true,
                      email: true,
                    },
                  },
                },
              },
            },
          },
        },
      }),
      prisma.paymentReceipt.count(),
    ]);

    return {
      receipts,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Delete receipt (soft delete - mark as inactive)
   */
  static async deleteReceipt(receiptId: string): Promise<void> {
    const receipt = await prisma.paymentReceipt.findUnique({
      where: { id: receiptId },
    });

    if (!receipt) {
      throw new Error(`Receipt with ID ${receiptId} not found`);
    }

    // Delete the physical file
    try {
      await fs.unlink(receipt.filePath);
    } catch (error) {
      console.warn(`Failed to delete receipt file: ${error}`);
    }

    // Delete the database record
    await prisma.paymentReceipt.delete({
      where: { id: receiptId },
    });
  }
}

export default ReceiptService;
