import React from 'react';
import { renderToBuffer } from '@react-pdf/renderer';
import { prisma } from './prisma';
import PaymentReceiptDocument, { ReceiptData } from './receiptTemplate';
import { uploadToS3Organized, getS3ObjectStream, deleteFromS3, S3_FOLDERS } from './storage';

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

  /**
   * Generate sequential receipt number
   */
  private static async generateReceiptNumber(): Promise<string> {
    const currentYear = new Date().getFullYear();
    const prefix = `RCP-${currentYear}-`;
    
    // Find all receipts for current year and get the highest numeric value
    const receiptsThisYear = await prisma.paymentReceipt.findMany({
      where: {
        receiptNumber: {
          startsWith: prefix,
        },
      },
      select: {
        receiptNumber: true,
      },
    });

    let nextNumber = 1;
    if (receiptsThisYear.length > 0) {
      // Extract numeric parts and find the maximum
      const numbers = receiptsThisYear
        .map(receipt => {
          const numericPart = receipt.receiptNumber.replace(prefix, '');
          const parsed = parseInt(numericPart);
          return isNaN(parsed) ? 0 : parsed;
        })
        .filter(num => num > 0);
      
      if (numbers.length > 0) {
        nextNumber = Math.max(...numbers) + 1;
      }
    }

    // Dynamic padding: use at least 3 digits, but expand as needed
    const minDigits = 3;
    const requiredDigits = Math.max(minDigits, nextNumber.toString().length);
    
    return `${prefix}${nextNumber.toString().padStart(requiredDigits, '0')}`;
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

    if (repayment.status !== 'COMPLETED' && repayment.status !== 'PARTIAL' && repayment.status !== 'PAID') {
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
          licenseNo: companySettings.licenseNo || undefined,
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

      // Upload PDF to S3 with organized folder structure
      const fileName = `${receiptNumber}.pdf`;
      const uploadResult = await uploadToS3Organized(
        Buffer.from(pdfBuffer),
        fileName,
        'application/pdf',
        {
          folder: S3_FOLDERS.RECEIPTS,
          subFolder: repayment.loan.id.substring(0, 8), // Organize by loan ID prefix
        }
      );

      if (!uploadResult.success || !uploadResult.key) {
        throw new Error(`Failed to upload receipt to S3: ${uploadResult.error}`);
      }

      const s3Key = uploadResult.key;

      // Save receipt record to database
      const receiptRecord = await prisma.paymentReceipt.create({
        data: {
          repaymentId: params.repaymentId,
          receiptNumber,
          filePath: s3Key,
          generatedBy: params.generatedBy,
          metadata: {
            transactionId: params.transactionId, // Store transaction ID for duplicate prevention
            companySettings: {
              name: companySettings.companyName,
              address: companySettings.companyAddress,
              regNo: companySettings.companyRegNo,
              licenseNo: companySettings.licenseNo,
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
      const { stream } = await getS3ObjectStream(receipt.filePath);
      
      // Convert stream to buffer
      const chunks: Buffer[] = [];
      for await (const chunk of stream) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      return Buffer.concat(chunks);
    } catch (error) {
      throw new Error(`Failed to read receipt file from S3: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
   * Generate PDF receipt for early settlement
   */
  static async generateEarlySettlementReceipt(
    transactionId: string,
    quote: any,
    generatedBy: string
  ): Promise<{
    receiptId: string;
    receiptNumber: string;
    filePath: string;
  }> {
    try {
      // Get transaction details
      const transaction = await prisma.walletTransaction.findUnique({
        where: { id: transactionId },
        include: {
          user: true,
          loan: {
            include: {
              application: {
                include: {
                  product: true
                }
              }
            }
          }
        }
      });

      if (!transaction) {
        throw new Error(`Transaction ${transactionId} not found`);
      }

      // Check if receipt already exists
      const existingReceipt = await prisma.paymentReceipt.findFirst({
        where: {
          metadata: {
            path: ['earlySettlementTransactionId'],
            equals: transactionId
          }
        }
      });

      if (existingReceipt) {
        console.log(`Early settlement receipt already exists for transaction ${transactionId}: ${existingReceipt.receiptNumber}`);
        return {
          receiptId: existingReceipt.id,
          receiptNumber: existingReceipt.receiptNumber,
          filePath: existingReceipt.filePath,
        };
      }

      // Get company settings
      const companySettings = await this.getCompanySettings();

      // Generate receipt number
      const receiptNumber = await this.generateReceiptNumber();

      // Prepare receipt data for early settlement
      const receiptData: ReceiptData = {
        receiptNumber,
        generatedAt: new Date().toISOString(),
        customer: {
          id: transaction.userId,
          name: transaction.user.fullName || 'N/A',
          email: transaction.user.email || 'N/A',
          phone: transaction.user.phoneNumber || 'N/A',
        },
        loan: {
          id: transaction.loan?.id || 'N/A',
          principalAmount: transaction.loan?.principalAmount || 0,
          interestRate: transaction.loan?.interestRate || 0,
          term: transaction.loan?.term || 0,
        },
        payment: {
          dueDate: new Date().toISOString(),
          principalAmount: quote.remainingPrincipal,
          interestAmount: quote.remainingInterest,
          lateFeeAmount: quote.lateFeesAmount || 0,
          lateFeesPaid: 0,
          totalAmount: quote.totalSettlement,
          paidAmount: Math.abs(transaction.amount),
          paymentDate: new Date().toISOString(),
          paymentMethod: 'Early Settlement',
          reference: transaction.reference || 'N/A',
        },
        transaction: {
          processedAt: new Date().toISOString(),
          createdAt: transaction.createdAt.toISOString(),
        },
        company: {
          name: companySettings.companyName,
          address: companySettings.companyAddress,
          regNo: companySettings.companyRegNo ?? undefined,
          licenseNo: companySettings.licenseNo ?? undefined,
          phone: companySettings.contactPhone ?? undefined,
          email: companySettings.contactEmail ?? undefined,
          taxLabel: companySettings.taxLabel,
          footerNote: companySettings.footerNote ?? undefined,
        },
      };

      // Generate PDF
      const receiptDocument = PaymentReceiptDocument({ data: receiptData }) as React.ReactElement;
      const pdfBuffer = await renderToBuffer(receiptDocument);
      
      // Upload PDF to S3 with organized folder structure
      const fileName = `early-settlement-${receiptNumber}.pdf`;
      const uploadResult = await uploadToS3Organized(
        Buffer.from(pdfBuffer),
        fileName,
        'application/pdf',
        {
          folder: S3_FOLDERS.RECEIPTS,
          subFolder: transaction.loanId!.substring(0, 8), // Organize by loan ID prefix
        }
      );

      if (!uploadResult.success || !uploadResult.key) {
        throw new Error(`Failed to upload early settlement receipt to S3: ${uploadResult.error}`);
      }

      const s3Key = uploadResult.key;

      // Create database record (create a dummy repayment record for early settlement)
      const dummyRepayment = await prisma.loanRepayment.create({
        data: {
          loanId: transaction.loanId!,
          amount: quote.totalSettlement,
          principalAmount: quote.remainingPrincipal,
          interestAmount: 0, // No interest for early settlement
          status: 'COMPLETED',
          dueDate: new Date(),
          paidAt: new Date(),
          actualAmount: quote.totalSettlement,
          principalPaid: quote.remainingPrincipal,
          paymentType: 'EARLY_SETTLEMENT',
          scheduledAmount: quote.totalSettlement,
          lateFeeAmount: quote.lateFeesAmount || 0,
          lateFeesPaid: quote.lateFeesAmount || 0,
          installmentNumber: 999 // Special number for early settlement
        }
      });

      // Create receipt record
      const receipt = await prisma.paymentReceipt.create({
        data: {
          repaymentId: dummyRepayment.id,
          receiptNumber,
          filePath: s3Key,
          generatedBy,
          metadata: {
            earlySettlementTransactionId: transactionId,
            quote: quote,
            paymentMethod: 'Early Settlement',
            companyInfo: companySettings,
            isEarlySettlement: true
          },
        },
      });

      console.log(`Early settlement receipt generated: ${receiptNumber} for transaction ${transactionId}`);

      return {
        receiptId: receipt.id,
        receiptNumber: receipt.receiptNumber,
        filePath: receipt.filePath,
      };
    } catch (error) {
      console.error('Error generating early settlement receipt:', error);
      throw error;
    }
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

    // Delete the file from S3
    try {
      await deleteFromS3(receipt.filePath);
    } catch (error) {
      console.warn(`Failed to delete receipt file from S3: ${error}`);
    }

    // Delete the database record
    await prisma.paymentReceipt.delete({
      where: { id: receiptId },
    });
  }
}

export default ReceiptService;
