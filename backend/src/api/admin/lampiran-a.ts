import { Router, Response } from "express";
import React from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { requireAdmin } from "../../lib/permissions";
import { AuthRequest, authenticateToken } from "../../middleware/auth";
import { logger } from "../../lib/logger";
import { prisma } from "../../lib/prisma";
import LampiranADocument, { LampiranAData, LampiranARepayment } from "../../lib/lampiranATemplate";

const router = Router();

/**
 * Helper function to get company settings
 */
async function getCompanySettings() {
  const settings = await prisma.companySettings.findFirst();
  return {
    name: settings?.companyName || "Kredit Sdn Bhd",
    address: settings?.companyAddress || "Kuala Lumpur, Malaysia",
    regNo: settings?.companyRegNo || undefined,
    licenseNo: settings?.licenseNo || undefined,
  };
}

/**
 * Helper function to format address from user fields
 */
function formatAddress(user: {
  address1?: string | null;
  address2?: string | null;
  city?: string | null;
  state?: string | null;
  zipCode?: string | null;
  country?: string | null;
}): string {
  const parts = [
    user.address1,
    user.address2,
    user.city,
    user.state,
    user.zipCode,
    user.country,
  ].filter(Boolean);
  return parts.join(", ") || "-";
}

/**
 * Helper function to determine loan status code for Catatan
 * Based on Lampiran A requirements:
 * 1. Pinjaman Selesai - Loan fully paid (including early settlement) and discharged
 * 2. Pinjaman Semasa - Current active loan with normal repayments
 * 3. Dalam Proses Dapat Balik - Loan in remedy/recovery period (overdue but not yet defaulted)
 * 4. Dalam Tindakan Mahkamah - Loan defaulted (legal action)
 */
function getLoanStatusCode(
  loanStatus: string, 
  isEarlySettlement?: boolean,
  hasDefaultRiskFlag?: boolean
): number {
  const status = loanStatus.toUpperCase();
  
  // Status 1: Pinjaman Selesai (Loan Completed)
  // - Discharged loans (normal completion or early settlement)
  // - Early settlement approved and completed
  if (
    status === "DISCHARGED" || 
    status === "COMPLETED" || 
    status === "SETTLED" ||
    (status === "PENDING_DISCHARGE" && isEarlySettlement) ||
    (status === "PENDING_EARLY_SETTLEMENT")
  ) {
    return 1; // Pinjaman Selesai
  }
  
  // Status 4: Dalam Tindakan Mahkamah (In Court Action / Defaulted)
  // - Loan has been formally defaulted
  // - Legal action initiated
  if (
    status === "DEFAULTED" || 
    status === "IN_COURT" || 
    status === "LEGAL_ACTION" ||
    status === "DEFAULT"
  ) {
    return 4; // Dalam Tindakan Mahkamah
  }
  
  // Status 3: Dalam Proses Dapat Balik (In Recovery/Remedy Process)
  // - Loan flagged as potential default
  // - In recovery/collection process
  // - Overdue but not yet formally defaulted
  if (
    status === "POTENTIAL_DEFAULT" || 
    status === "RECOVERY" || 
    status === "COLLECTION" ||
    status === "OVERDUE" ||
    hasDefaultRiskFlag
  ) {
    return 3; // Dalam Proses Dapat Balik
  }
  
  // Status 2: Pinjaman Semasa (Current Active Loan)
  // - Active loans with normal repayments
  // - Pending discharge (normal, not early settlement)
  return 2; // Pinjaman Semasa
}

/**
 * @swagger
 * /api/admin/loans/{loanId}/lampiran-a:
 *   get:
 *     summary: Generate and download Lampiran A (Borrower Account Ledger) PDF
 *     description: Generates a compliance PDF following the Malaysian Moneylenders Act 1951 format
 *     tags: [Admin - Compliance]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: loanId
 *         required: true
 *         schema:
 *           type: string
 *         description: Loan ID
 *     responses:
 *       200:
 *         description: PDF generated successfully
 *         content:
 *           application/pdf:
 *             schema:
 *               type: string
 *               format: binary
 *       404:
 *         description: Loan not found
 *       500:
 *         description: Internal server error
 */
router.get("/:loanId/lampiran-a", authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { loanId } = req.params;
    const adminUserId = req.user?.userId || "SYSTEM";

    logger.info(`Generating Lampiran A for loan ${loanId} by admin ${adminUserId}`);

    // Fetch loan with all related data
    const loan = await prisma.loan.findUnique({
      where: { id: loanId },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            icNumber: true,
            idNumber: true,
            nationality: true,
            employmentStatus: true,
            monthlyIncome: true,
            employerName: true,
            address1: true,
            address2: true,
            city: true,
            state: true,
            zipCode: true,
            country: true,
            // Demographics
            race: true,
            gender: true,
            occupation: true,
          },
        },
        application: {
          include: {
            product: {
              select: {
                name: true,
                collateralRequired: true,
              },
            },
          },
        },
        // Fetch actual wallet transactions (payments made by user)
        walletTransactions: {
          where: {
            status: "APPROVED",
            type: {
              in: ["LOAN_PAYMENT", "LOAN_REPAYMENT", "PAYMENT", "REPAYMENT"],
            },
          },
          orderBy: { createdAt: "asc" },
        },
        // Also fetch repayments to get receipt numbers
        repayments: {
          orderBy: { dueDate: "asc" },
          include: {
            receipts: {
              select: {
                receiptNumber: true,
                generatedAt: true,
                metadata: true, // Include metadata to get transactionId for matching
              },
              orderBy: { generatedAt: "desc" },
            },
          },
        },
      },
    });

    if (!loan) {
      return res.status(404).json({
        success: false,
        message: "Loan not found",
      });
    }

    // Check if this is an early settlement by looking at loan application history
    const earlySettlementHistory = await prisma.loanApplicationHistory.findFirst({
      where: {
        applicationId: loan.applicationId,
        newStatus: {
          in: ["EARLY_SETTLEMENT_APPROVED", "PENDING_EARLY_SETTLEMENT", "EARLY_SETTLEMENT_COMPLETED"],
        },
      },
      orderBy: { createdAt: "desc" },
    });
    const isEarlySettlement = !!earlySettlementHistory;

    // Check if loan has default risk flag
    const hasDefaultRiskFlag = !!loan.defaultRiskFlaggedAt || !!loan.defaultedAt;

    // Get company settings
    const company = await getCompanySettings();

    // Calculate total interest (excluding any fees - just loan amount minus principal)
    const totalInterest = loan.totalAmount - loan.principalAmount;

    // Calculate the effective annual interest rate based on actual interest charged
    // Formula: (Total Interest / Principal) / (Term in Years) * 100
    // Then divide by 12 to get monthly rate
    // Example: Principal 150,000, Interest 27,000, Term 12 months
    //   Annual Rate = (27,000 / 150,000) / (12/12) * 100 = 18%
    //   Monthly Rate = 18% / 12 = 1.5%
    const termInYears = loan.term / 12;
    const effectiveAnnualRate = (totalInterest / loan.principalAmount) / termInYears * 100;
    const interestRateMonthly = effectiveAnnualRate / 12;

    // Determine overall loan status code for Catatan
    const loanStatusCode = getLoanStatusCode(loan.status, isEarlySettlement, hasDefaultRiskFlag);

    // Build a map of receipt numbers by transaction ID
    // Receipts store the transactionId in their metadata field, allowing us to match
    // each wallet transaction to its specific receipt
    const receiptsByTransactionId = new Map<string, string>();
    loan.repayments.forEach((repayment) => {
      repayment.receipts.forEach((receipt) => {
        // Extract transactionId from receipt metadata
        const metadata = receipt.metadata as { transactionId?: string } | null;
        if (metadata?.transactionId) {
          receiptsByTransactionId.set(metadata.transactionId, receipt.receiptNumber);
        }
      });
    });

    // Build payment data from actual wallet transactions (what user actually paid)
    // This tracks real payments, not scheduled repayments
    // Note: Wallet transactions for loan repayments are stored with NEGATIVE amounts
    // (representing money going out of the wallet), so we filter for amount < 0
    // and use Math.abs() to get the positive payment amount
    let runningBalance = loan.totalAmount;
    const filteredTransactions = loan.walletTransactions.filter((tx) => tx.amount < 0);
    const totalPayments = filteredTransactions.length;
    
    const repayments: LampiranARepayment[] = filteredTransactions.map((transaction, index) => {
        // Convert negative wallet transaction amount to positive payment amount
        const paymentAmount = Math.abs(transaction.amount);
        
        // Jumlah Besar = Balance BEFORE this payment (same as previous row's Baki Pinjaman)
        const balanceBeforePayment = runningBalance;
        
        // Subtract the payment to get balance after
        runningBalance -= paymentAmount;
        const isLastPayment = index === totalPayments - 1;
        
        // Baki Pinjaman = Balance AFTER this payment
        const balanceAfterPayment = Math.max(0, runningBalance);
        
        // Find the matching receipt by transaction ID
        // This directly links each wallet transaction to its specific receipt
        const receiptNumber = receiptsByTransactionId.get(transaction.id) || 
          // Fallback: Try to extract from transaction reference if available
          (transaction.reference || undefined);
        
        // Determine Catatan status for this specific payment row:
        // - If this is the last payment AND loan is discharged/settled -> "Pinjaman Selesai" (1)
        // - If this is the last payment AND balance is 0 -> "Pinjaman Selesai" (1)
        // - If loan is defaulted -> "Dalam Tindakan Mahkamah" (4)
        // - If loan has default risk flag -> "Dalam Proses Dapat Balik" (3)
        // - Otherwise -> "Pinjaman Semasa" (2) for ongoing payments
        let paymentStatusCode: number;
        
        if (loanStatusCode === 4) {
          // Loan is defaulted - all payments show defaulted status
          paymentStatusCode = 4;
        } else if (loanStatusCode === 3) {
          // Loan is in remedy/recovery - show that status
          paymentStatusCode = 3;
        } else if (isLastPayment && (loanStatusCode === 1 || balanceAfterPayment === 0)) {
          // Last payment and loan is settled OR balance is zero
          paymentStatusCode = 1; // Pinjaman Selesai
        } else if (loanStatusCode === 1) {
          // Loan is discharged but this isn't the last payment - show as completed
          paymentStatusCode = 1;
        } else {
          // Active loan with ongoing payments
          paymentStatusCode = 2; // Pinjaman Semasa
        }
        
        return {
          date: (transaction.processedAt || transaction.createdAt).toISOString(),
          // Jumlah Besar = Balance before this payment (previous row's Baki Pinjaman)
          totalAmount: balanceBeforePayment,
          paymentAmount: paymentAmount,
          balanceAfter: balanceAfterPayment,
          receiptNumber: receiptNumber,
          status: paymentStatusCode,
        };
      });

    // Prepare Lampiran A data
    const lampiranAData: LampiranAData = {
      borrower: {
        fullName: loan.user.fullName || "-",
        icNumber: loan.user.icNumber || undefined,
        idNumber: loan.user.idNumber || undefined,
        nationality: loan.user.nationality || undefined,
        employmentStatus: loan.user.employmentStatus || undefined,
        monthlyIncome: loan.user.monthlyIncome || undefined,
        employerName: loan.user.employerName || undefined,
        address: formatAddress(loan.user),
        // Demographics
        race: loan.user.race || undefined,
        gender: loan.user.gender || undefined,
        occupation: loan.user.occupation || undefined,
      },
      loan: {
        disbursedAt: loan.disbursedAt?.toISOString() || loan.createdAt.toISOString(),
        principalAmount: loan.principalAmount,
        totalInterest: totalInterest,
        totalAmount: loan.totalAmount,
        interestRateMonthly: interestRateMonthly,
        isSecured: loan.application?.product?.collateralRequired || false,
        term: loan.term,
        monthlyPayment: loan.monthlyPayment,
      },
      repayments: repayments,
      collateral: loan.application?.product?.collateralRequired
        ? { type: "Cagaran", estimatedValue: undefined }
        : undefined,
      company: company,
      generatedAt: new Date().toISOString(),
      loanStatus: loan.status,
    };

    // Generate PDF buffer
    const lampiranDocument = LampiranADocument({ data: lampiranAData }) as React.ReactElement;
    const pdfBuffer = await renderToBuffer(lampiranDocument);

    // Create audit trail entry
    if (loan.applicationId) {
      await prisma.loanApplicationHistory.create({
        data: {
          applicationId: loan.applicationId,
          previousStatus: null,
          newStatus: "LAMPIRAN_A_GENERATED",
          changedBy: adminUserId,
          changeReason: "COMPLIANCE_REPORT_GENERATED",
          notes: `Lampiran A (Borrower Account Ledger) generated for compliance purposes`,
          metadata: {
            loanId: loan.id,
            documentType: "LAMPIRAN_A",
            generatedBy: adminUserId,
            generatedAt: new Date().toISOString(),
            borrowerName: loan.user.fullName,
            borrowerIc: loan.user.icNumber || loan.user.idNumber,
            loanStatus: loan.status,
            principalAmount: loan.principalAmount,
            totalAmount: loan.totalAmount,
            repaymentsIncluded: repayments.length,
          },
        },
      });
    }

    logger.info(`Lampiran A generated successfully for loan ${loanId}`);

    // Generate filename
    const icNumber = (loan.user.icNumber || loan.user.idNumber || "unknown").replace(/[\s-]/g, "");
    const dateStr = new Date().toISOString().split("T")[0];
    const filename = `Lampiran-A-${icNumber}-${dateStr}.pdf`;

    // Set response headers
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Length", pdfBuffer.length.toString());

    // Send PDF buffer
    return res.send(Buffer.from(pdfBuffer));
  } catch (error) {
    logger.error("Error generating Lampiran A:", error);
    return res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to generate Lampiran A",
    });
  }
});

export default router;
