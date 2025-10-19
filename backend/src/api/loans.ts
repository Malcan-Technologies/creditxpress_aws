import { Router, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { authenticateAndVerifyPhone, AuthRequest } from "../middleware/auth";
import { TimeUtils, SafeMath } from "../lib/precisionUtils";
import fs from "fs";
import path from "path";

// Import grace period function from late fee processor
async function getLateFeeGraceSettings(prismaClient: any = prisma) {
	try {
		const settings = await prismaClient.systemSettings.findMany({
			where: {
				key: {
					in: ['ENABLE_LATE_FEE_GRACE_PERIOD', 'LATE_FEE_GRACE_DAYS']
				},
				isActive: true
			}
		});

		const enableGraceSetting = settings.find((s: any) => s.key === 'ENABLE_LATE_FEE_GRACE_PERIOD');
		const graceDaysSetting = settings.find((s: any) => s.key === 'LATE_FEE_GRACE_DAYS');

		const isGraceEnabled = enableGraceSetting ? JSON.parse(enableGraceSetting.value) : true;
		const graceDays = graceDaysSetting ? JSON.parse(graceDaysSetting.value) : 3;

		// If grace period is disabled, return 0 days
		return isGraceEnabled ? graceDays : 0;
	} catch (error) {
		console.error('Error fetching late fee grace settings:', error);
		// Default fallback: 3 days grace period
		return 3;
	}
}

// Helper function to determine repayment status including grace period
function getRepaymentStatusWithGracePeriod(repayment: any, gracePeriodDays: number) {
	if (repayment.status === 'COMPLETED') {
		return { status: 'COMPLETED', isInGracePeriod: false };
	}
	
	if (repayment.status === 'CANCELLED') {
		return { status: 'CANCELLED', isInGracePeriod: false };
	}
	
	// For PENDING and PARTIAL repayments, check if they're overdue
	const now = new Date();
	const dueDate = new Date(repayment.dueDate);
	const daysOverdue = Math.floor((now.getTime() - dueDate.getTime()) / (24 * 60 * 60 * 1000));
	
	if (daysOverdue <= 0) {
		return { status: repayment.status, isInGracePeriod: false };
	}
	
	// Payment is overdue - check if within grace period
	if (daysOverdue <= gracePeriodDays) {
		return { status: 'GRACE_PERIOD', isInGracePeriod: true, daysIntoGracePeriod: daysOverdue };
	}
	
	// Beyond grace period - truly overdue
	return { status: 'OVERDUE', isInGracePeriod: false, daysOverdue: daysOverdue - gracePeriodDays };
}

const router = Router();
const prisma = new PrismaClient();

// Early settlement settings keys
const ES_KEYS = {
  ENABLED: 'EARLY_SETTLEMENT_ENABLED',
  LOCK_IN_MONTHS: 'EARLY_SETTLEMENT_LOCK_IN_MONTHS',
  DISCOUNT_FACTOR: 'EARLY_SETTLEMENT_DISCOUNT_FACTOR',
  FEE_TYPE: 'EARLY_SETTLEMENT_FEE_TYPE', // FIXED | PERCENT
  FEE_VALUE: 'EARLY_SETTLEMENT_FEE_VALUE',
  INCLUDE_LATE_FEES: 'EARLY_SETTLEMENT_INCLUDE_LATE_FEES',
  ROUNDING_MODE: 'EARLY_SETTLEMENT_ROUNDING_MODE', // HALF_UP | HALF_EVEN
} as const;

type FeeType = 'FIXED' | 'PERCENT';

async function ensureEarlySettlementSettings() {
  const defaults = [
    {
      key: ES_KEYS.ENABLED,
      category: 'EARLY_SETTLEMENT',
      name: 'Enable Early Settlement',
      description: 'Allow users to settle loans early',
      dataType: 'BOOLEAN',
      value: JSON.stringify(false),
      options: null,
    },
    {
      key: ES_KEYS.LOCK_IN_MONTHS,
      category: 'EARLY_SETTLEMENT',
      name: 'Lock-in Period (months)',
      description: 'Number of months after disbursement before early settlement is allowed',
      dataType: 'NUMBER',
      value: JSON.stringify(3),
      options: JSON.stringify({ min: 0, max: 120 }),
    },
    {
      key: ES_KEYS.DISCOUNT_FACTOR,
      category: 'EARLY_SETTLEMENT',
      name: 'Interest Discount Factor',
      description: 'Discount applied to remaining future interest (0.0 – 1.0)',
      dataType: 'NUMBER',
      value: JSON.stringify(0.0),
      options: JSON.stringify({ min: 0, max: 1 }),
    },
    {
      key: ES_KEYS.FEE_TYPE,
      category: 'EARLY_SETTLEMENT',
      name: 'Early Settlement Fee Type',
      description: 'Whether the fee is fixed amount or percent of remaining principal',
      dataType: 'ENUM',
      value: JSON.stringify('FIXED'),
      options: JSON.stringify({ FIXED: 'Fixed', PERCENT: 'Percent' }),
    },
    {
      key: ES_KEYS.FEE_VALUE,
      category: 'EARLY_SETTLEMENT',
      name: 'Early Settlement Fee Value',
      description: 'If FIXED: amount (MYR). If PERCENT: percent value (e.g., 2 for 2%).',
      dataType: 'NUMBER',
      value: JSON.stringify(0),
      options: JSON.stringify({ min: 0, max: 100000 }),
    },
    {
      key: ES_KEYS.INCLUDE_LATE_FEES,
      category: 'EARLY_SETTLEMENT',
      name: 'Include Unpaid Late Fees',
      description: 'Include any accrued but unpaid late fees in settlement amount',
      dataType: 'BOOLEAN',
      value: JSON.stringify(true),
      options: null,
    },
    {
      key: ES_KEYS.ROUNDING_MODE,
      category: 'EARLY_SETTLEMENT',
      name: 'Rounding Mode',
      description: 'Rounding mode for settlement amounts',
      dataType: 'ENUM',
      value: JSON.stringify('HALF_UP'),
      options: JSON.stringify({ HALF_UP: 'Half Up', HALF_EVEN: 'Bankers' }),
    },
  ];

  for (const d of defaults) {
    const existing = await prisma.systemSettings.findUnique({ where: { key: d.key } });
    if (!existing) {
      await prisma.systemSettings.create({
        data: {
          key: d.key,
          category: d.category,
          name: d.name,
          description: d.description,
          dataType: d.dataType,
          value: d.value,
          options: d.options ? (d.options as any) : undefined,
          isActive: true,
          requiresRestart: false,
          affectsExistingLoans: false,
        },
      });
    }
  }
}

async function getESSetting<T>(key: string): Promise<T> {
  const s = await prisma.systemSettings.findUnique({ where: { key } });
  if (!s) throw new Error(`Missing system setting: ${key}`);
  return JSON.parse(s.value) as T;
}

function roundAmount(value: number, mode: 'HALF_UP' | 'HALF_EVEN'): number {
  const safeValue = SafeMath.toNumber(value);
  const factor = 100;
  
  if (mode === 'HALF_EVEN') {
    // Bankers rounding
    const n = safeValue * factor;
    const f = Math.floor(n);
    const frac = n - f;
    if (frac > 0.5) return SafeMath.round(Math.round(n) / factor);
    if (frac < 0.5) return SafeMath.round(f / factor);
    // exactly .5
    return SafeMath.round((f % 2 === 0 ? f : f + 1) / factor);
  }
  // HALF_UP
  return SafeMath.round(safeValue);
}

async function computeEarlySettlementQuote(loanId: string) {
  await ensureEarlySettlementSettings();

  const enabled = await getESSetting<boolean>(ES_KEYS.ENABLED);
  const lockInMonths = await getESSetting<number>(ES_KEYS.LOCK_IN_MONTHS);
  const discountFactor = await getESSetting<number>(ES_KEYS.DISCOUNT_FACTOR);
  const feeType = await getESSetting<string>(ES_KEYS.FEE_TYPE) as FeeType;
  const feeValue = await getESSetting<number>(ES_KEYS.FEE_VALUE);
  const includeLateFees = await getESSetting<boolean>(ES_KEYS.INCLUDE_LATE_FEES);
  const roundingMode = await getESSetting<'HALF_UP'|'HALF_EVEN'>(ES_KEYS.ROUNDING_MODE);

  if (!enabled) {
    return { allowed: false, reason: 'Early settlement is currently disabled.' } as const;
  }

  const loan = await prisma.loan.findUnique({ where: { id: loanId } });
  if (!loan) {
    throw new Error('Loan not found');
  }
  if (!['ACTIVE','OVERDUE','PENDING_DISCHARGE','DEFAULT'].includes(loan.status)) {
    return { allowed: false, reason: `Loan status ${loan.status} not eligible for early settlement.` } as const;
  }

  // Lock-in enforcement
  if (loan.disbursedAt && lockInMonths > 0) {
    const disb = new Date(loan.disbursedAt);
    const unlock = new Date(disb);
    unlock.setMonth(unlock.getMonth() + lockInMonths);
    const now = new Date();
    if (now < unlock) {
      return { allowed: false, reason: `Early settlement available after ${unlock.toISOString().split('T')[0]}.` } as const;
    }
  }

  // Remaining principal: sum of unpaid principalAmount from loan_repayments
  // This accounts for partial payments and excludes already paid principal
  const unpaidRepayments = await prisma.loanRepayment.findMany({
    where: {
      loanId,
      status: { in: ['PENDING', 'PARTIAL'] },
    },
    select: { 
      principalAmount: true,
      principalPaid: true,
    },
  });
  
  const remainingPrincipal = unpaidRepayments.reduce((sum, r) => {
    const unpaidPrincipal = SafeMath.subtract(
      SafeMath.toNumber(r.principalAmount || 0),
      SafeMath.toNumber(r.principalPaid || 0)
    );
    return SafeMath.add(sum, SafeMath.max(0, unpaidPrincipal));
  }, 0);

  // Remaining future interest: sum interestAmount of unpaid repayments with dueDate >= Malaysia start of day
  const todayMY = TimeUtils.malaysiaStartOfDay();
  const futureRepayments = await prisma.loanRepayment.findMany({
    where: {
      loanId,
      status: { in: ['PENDING','PARTIAL'] },
      dueDate: { gte: todayMY },
    },
    select: { interestAmount: true },
  });
  const remainingInterest = futureRepayments.reduce((sum, r) => 
    SafeMath.add(sum, SafeMath.toNumber(r.interestAmount || 0)), 0);
  const discountAmount = SafeMath.multiply(remainingInterest, SafeMath.toNumber(discountFactor));

  // Fee computation (safe math)
  const feeAmount = feeType === 'PERCENT' 
    ? SafeMath.percentage(remainingPrincipal, SafeMath.toNumber(feeValue))
    : SafeMath.toNumber(feeValue);

  // Unpaid late fees (optional)
  let lateFeesAmount = 0;
  if (includeLateFees) {
    const unpaidLF = await prisma.$queryRawUnsafe(
      `SELECT COALESCE(SUM(GREATEST(lr."lateFeeAmount" - COALESCE(lr."lateFeesPaid",0),0)),0) AS unpaid
       FROM loan_repayments lr WHERE lr."loanId" = $1`, loanId
    ) as any[];
    lateFeesAmount = SafeMath.toNumber(unpaidLF[0]?.unpaid || 0);
  }

  // Calculate total settlement: remainingPrincipal + remainingInterest - discountAmount + feeAmount + lateFeesAmount
  const principalPlusInterest = SafeMath.add(remainingPrincipal, remainingInterest);
  const afterDiscount = SafeMath.subtract(principalPlusInterest, discountAmount);
  const withFees = SafeMath.add(afterDiscount, feeAmount);
  const rawTotal = SafeMath.add(withFees, lateFeesAmount);
  const totalSettlement = SafeMath.max(0, roundAmount(rawTotal, roundingMode));

  return {
    allowed: true,
    quote: {
      remainingPrincipal: roundAmount(remainingPrincipal, roundingMode),
      remainingInterest: roundAmount(remainingInterest, roundingMode),
      discountFactor,
      discountAmount: roundAmount(discountAmount, roundingMode),
      feeType,
      feeValue,
      feeAmount: roundAmount(feeAmount, roundingMode),
      includeLateFees,
      lateFeesAmount: roundAmount(lateFeesAmount, roundingMode),
      totalSettlement,
      computedAt: new Date().toISOString(),
    },
  } as const;
}

// Get an early settlement quote
router.post('/:id/early-settlement/quote', authenticateAndVerifyPhone, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const loanId = req.params.id;

    // Validate loan ownership
    const loan = await prisma.loan.findFirst({ where: { id: loanId, userId } });
    if (!loan) return res.status(404).json({ success: false, message: 'Loan not found' });

    const result = await computeEarlySettlementQuote(loanId);
    if (!result.allowed) return res.status(400).json({ success: false, message: result.reason });

    return res.json({ success: true, data: result.quote });
  } catch (err: any) {
    console.error('Early settlement quote error:', err);
    return res.status(500).json({ success: false, message: 'Failed to compute quote' });
  }
});

// Create an early settlement request (pending payment transaction)
router.post('/:id/early-settlement/request', authenticateAndVerifyPhone, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const loanId = req.params.id;
    const { reference, description } = req.body || {};

    // Validate loan
    const loan = await prisma.loan.findFirst({ where: { id: loanId, userId, status: { in: ['ACTIVE','OVERDUE','PENDING_DISCHARGE','DEFAULT'] } } });
    if (!loan) return res.status(404).json({ success: false, message: 'Loan not found or not eligible' });

    // Compute quote
    const result = await computeEarlySettlementQuote(loanId);
    if (!result.allowed) return res.status(400).json({ success: false, message: result.reason });
    const q = result.quote;

    // Get wallet
    const wallet = await prisma.wallet.findUnique({ where: { userId } });
    if (!wallet) return res.status(404).json({ success: false, message: 'Wallet not found' });

    // Prevent duplicate pending early settlement
    const existingPending = await prisma.walletTransaction.findFirst({
      where: {
        userId,
        loanId,
        status: 'PENDING',
        type: 'LOAN_REPAYMENT',
        description: { contains: 'Early settlement' },
      },
    });
    if (existingPending) return res.status(400).json({ success: false, message: 'There is already a pending early settlement request for this loan.' });

    // Create the wallet transaction and update loan status in a transaction
    const walletTxResult = await prisma.$transaction(async (tx) => {
      // Create the wallet transaction
      const walletTx = await tx.walletTransaction.create({
        data: {
          userId,
          walletId: wallet.id,
          loanId,
          type: 'LOAN_REPAYMENT',
          amount: -q.totalSettlement,
          status: 'PENDING',
          description: description || `Early settlement request for loan ${loanId}`,
          reference: reference || `ES-${Date.now()}`,
          metadata: {
            kind: 'EARLY_SETTLEMENT',
            quote: q,
          },
        },
      });

      // Update loan status to PENDING_EARLY_SETTLEMENT
      const updatedLoan = await tx.loan.update({
        where: { id: loanId },
        data: {
          status: 'PENDING_EARLY_SETTLEMENT',
          updatedAt: new Date(),
        },
        include: {
          application: {
            select: {
              id: true
            }
          }
        }
      });

      // Create audit trail entry for early settlement request
      if (updatedLoan.applicationId) {
        await tx.loanApplicationHistory.create({
          data: {
            applicationId: updatedLoan.applicationId,
            previousStatus: 'ACTIVE',
            newStatus: 'PENDING_EARLY_SETTLEMENT',
            changedBy: userId,
            changeReason: 'Early Settlement Requested',
            notes: `User requested early settlement. Settlement amount: ${q.totalSettlement.toFixed(2)}. Interest discount: ${q.discountAmount.toFixed(2)}. Early settlement fee: ${(q.feeAmount || 0).toFixed(2)}. Net savings: ${(q.discountAmount - (q.feeAmount || 0)).toFixed(2)}.`,
            metadata: {
              kind: 'EARLY_SETTLEMENT_REQUEST',
              transactionId: walletTx.id,
              settlementDetails: {
                totalSettlement: q.totalSettlement,
                remainingPrincipal: q.remainingPrincipal,
                remainingInterest: q.remainingInterest,
                discountAmount: q.discountAmount,
                earlySettlementFee: q.feeAmount || 0,
                lateFeesAmount: q.lateFeesAmount || 0,
                interestSaved: q.discountAmount,
                netSavings: q.discountAmount - (q.feeAmount || 0)
              },
              requestedBy: userId,
              requestedAt: new Date().toISOString()
            }
          }
        });
      }

      return walletTx;
    });

    // Notify user
    await prisma.notification.create({
      data: {
        userId,
        title: 'Early Settlement Submitted',
        message: `Your early settlement request for ${q.totalSettlement.toFixed(2)} has been submitted and is awaiting approval.`,
        type: 'SYSTEM',
        priority: 'HIGH',
        metadata: { loanId, transactionId: walletTxResult.id },
      },
    });

    return res.status(201).json({ success: true, data: { transactionId: walletTxResult.id, quote: q } });
  } catch (err: any) {
    console.error('Early settlement request error:', err);
    return res.status(500).json({ success: false, message: 'Failed to create early settlement request' });
  }
});

/**
 * @swagger
 * tags:
 *   name: Loans
 *   description: API endpoints for managing user loans
 */

/**
 * @swagger
 * /api/loans:
 *   get:
 *     summary: Get user's loans
 *     tags: [Loans]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of user's loans (active, pending discharge, and discharged)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 loans:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       principalAmount:
 *                         type: number
 *                       outstandingBalance:
 *                         type: number
 *                       interestRate:
 *                         type: number
 *                       term:
 *                         type: integer
 *                       monthlyPayment:
 *                         type: number
 *                       nextPaymentDue:
 *                         type: string
 *                         format: date-time
 *                       status:
 *                         type: string
 *                       disbursedAt:
 *                         type: string
 *                         format: date-time
 *                       application:
 *                         type: object
 *                         properties:
 *                           product:
 *                             type: object
 *                             properties:
 *                               name:
 *                                 type: string
 *                               code:
 *                                 type: string
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.get("/", authenticateAndVerifyPhone, async (req: AuthRequest, res: Response) => {
	try {
		const userId = req.user!.userId;

		const loans = await prisma.loan.findMany({
			where: {
				userId,
				status: {
					in: [
						"ACTIVE",
						"OVERDUE",
						"PENDING_DISCHARGE",
						"PENDING_EARLY_SETTLEMENT",
						"DISCHARGED",
						"DEFAULT", // Include DEFAULT loans so they show in user dashboard
					], // Include all loan statuses for dashboard
				},
			},
		include: {
			application: {
				include: {
					product: {
						select: {
							name: true,
							code: true,
						},
					},
					disbursement: {
						select: {
							referenceNumber: true,
							amount: true,
							disbursedAt: true,
							paymentSlipUrl: true,
						}
					},
				},
			},
			repayments: {
					include: {
						receipts: {
							select: {
								id: true,
								receiptNumber: true,
								filePath: true,
								generatedBy: true,
								generatedAt: true,
							},
						},
					},
					orderBy: {
						dueDate: "asc",
					},
				},
				lateFee: {
					select: {
						gracePeriodDays: true,
						gracePeriodRepayments: true,
						totalGracePeriodFees: true,
						totalAccruedFees: true,
						status: true,
					},
				},
			},
			orderBy: {
				createdAt: "desc",
			},
		});

		// Ensure outstanding balances are accurate by recalculating them for all active loans
		// This ensures single source of truth even if there were any inconsistencies
		for (const loan of loans.filter(
			(l) => l.status === "ACTIVE" || l.status === "OVERDUE" || l.status === "PENDING_DISCHARGE" || l.status === "PENDING_EARLY_SETTLEMENT" || l.status === "DEFAULT"
		)) {
			await prisma.$transaction(async (tx) => {
				// Import the calculation function from wallet API
				const { calculateOutstandingBalance } = await import(
					"./wallet"
				);
				await calculateOutstandingBalance(loan.id, tx);
			});
		}

		// Calculate additional loan information including late fees
		const loansWithDetails = await Promise.all(
			loans.map(async (loan) => {
				// Use grace period from late_fees table if available, otherwise fall back to settings
				const gracePeriodDays = loan.lateFee?.gracePeriodDays ?? await getLateFeeGraceSettings();
				const totalRepaid = loan.repayments.reduce(
					(sum, repayment) => sum + repayment.amount,
					0
				);

				const progressPercentage =
					loan.principalAmount > 0
						? ((loan.principalAmount - loan.outstandingBalance) /
								loan.principalAmount) *
						  100
						: 0;

				// Calculate next payment amount considering advance payments and late fees
				let nextPaymentInfo = {
					amount: loan.monthlyPayment,
					isOverdue: false,
					includesLateFees: false,
					description: "Monthly Payment",
					dueDate: loan.nextPaymentDue,
				};

				// Get overdue repayments and late fee information
				let overdueInfo = {
					hasOverduePayments: false,
					totalOverdueAmount: 0,
					totalLateFees: 0,
					overdueRepayments: [] as any[],
				};

				try {
					// Get all pending/partial repayments that are overdue using raw query
					const today = TimeUtils.malaysiaStartOfDay();

					const overdueRepaymentsQuery = `
						SELECT 
							lr.*,
							COALESCE(lr."lateFeeAmount" - lr."lateFeesPaid", 0) as total_late_fees,
							COALESCE(lr."principalPaid", 0) as principal_paid
						FROM loan_repayments lr
						WHERE lr."loanId" = $1
						  AND lr.status IN ('PENDING', 'PARTIAL')
						  AND lr."dueDate" < $2
						ORDER BY lr."dueDate" ASC
					`;

					const overdueRepayments = (await prisma.$queryRawUnsafe(
						overdueRepaymentsQuery,
						loan.id,
						today
					)) as any[];

					if (overdueRepayments.length > 0) {
						console.log(
							`🔍 DEBUG: Overdue repayments for loan ${loan.id}:`,
							overdueRepayments.map((r) => ({
								id: r.id,
								amount: r.amount,
								actualAmount: r.actualAmount,
								status: r.status,
								dueDate: r.dueDate,
								total_late_fees: r.total_late_fees,
							}))
						);

						// Only set hasOverduePayments = true if late fees have been processed
						// Check if any repayment has lateFeeAmount > 0 (late fees have been calculated)
						const hasProcessedLateFees = overdueRepayments.some(r => 
							(r.lateFeeAmount || 0) > 0
						);
						overdueInfo.hasOverduePayments = hasProcessedLateFees;

						// Calculate total overdue amount and late fees
						for (const repayment of overdueRepayments) {
							// Use principalPaid instead of actualAmount for correct calculation
							// actualAmount includes late fees paid, so it's not suitable for calculating remaining scheduled amount
							const principalPaid = repayment.principal_paid || 0;
							const outstandingAmount = Math.max(
								0,
								repayment.amount - principalPaid
							);

							const totalLateFees =
								Number(repayment.total_late_fees) || 0;

							overdueInfo.totalOverdueAmount += outstandingAmount;
							overdueInfo.totalLateFees += totalLateFees;

							overdueInfo.overdueRepayments.push({
								id: repayment.id,
								amount: repayment.amount,
								outstandingAmount,
								totalLateFees,
								totalAmountDue:
									outstandingAmount + totalLateFees,
								dueDate: repayment.dueDate,
								daysOverdue: TimeUtils.daysOverdue(new Date(repayment.dueDate)),
								// Add breakdown of late fees for better frontend tracking
								lateFeeAmount: Number(repayment.lateFeeAmount) || 0,
								lateFeesPaid: Number(repayment.lateFeesPaid) || 0,
							});
						}
					}
				} catch (error) {
					console.error(
						`Error calculating late fees for loan ${loan.id}:`,
						error
					);
					// Continue without late fee info if there's an error
				}

				// Calculate next payment amount based on current situation
				try {
					if (overdueInfo.hasOverduePayments) {
						// If loan has overdue payments, next payment is total overdue + late fees
						nextPaymentInfo = {
							amount:
								overdueInfo.totalOverdueAmount +
								overdueInfo.totalLateFees,
							isOverdue: true,
							includesLateFees: overdueInfo.totalLateFees > 0,
							description:
								overdueInfo.totalLateFees > 0
									? "Overdue Amount + Late Fees"
									: "Overdue Amount",
							dueDate: loan.nextPaymentDue,
						};
					} else if (
						loan.status === "ACTIVE" &&
						loan.nextPaymentDue
					) {
						// Get next pending repayment to calculate balance payment
						const nextRepayment =
							await prisma.loanRepayment.findFirst({
								where: {
									loanId: loan.id,
									status: { in: ["PENDING", "PARTIAL"] },
									dueDate: { gte: new Date() },
								},
								orderBy: { dueDate: "asc" },
							});

						if (nextRepayment) {
							// Calculate remaining balance for next payment using principalPaid
							const principalPaid = nextRepayment.principalPaid || 0;
							const remainingBalance = Math.max(
								0,
								nextRepayment.amount - principalPaid
							);

							// Check for late fees on this specific repayment
							const lateFeeAmount = Math.max(0, 
								nextRepayment.lateFeeAmount - nextRepayment.lateFeesPaid
							);

							nextPaymentInfo = {
								amount: remainingBalance + lateFeeAmount,
								isOverdue: false,
								includesLateFees: lateFeeAmount > 0,
								description:
									lateFeeAmount > 0
										? "Next Payment + Late Fees"
										: "Next Payment",
								dueDate: nextRepayment.dueDate,
							};
						}
					}
				} catch (error) {
					console.error(
						`Error calculating next payment info for loan ${loan.id}:`,
						error
					);
					// Continue with default next payment info if there's an error
				}

				return {
					...loan,
					totalRepaid,
					progressPercentage:
						Math.round(progressPercentage * 100) / 100,
					canRepay: loan.outstandingBalance > 0 && loan.status !== 'PENDING_EARLY_SETTLEMENT' && loan.status !== 'PENDING_DISCHARGE',
					overdueInfo,
					nextPaymentInfo,
					gracePeriodDays, // Include grace period setting for frontend reference
					// Add grace period information from late_fees table
					gracePeriodInfo: loan.lateFee ? {
						gracePeriodDays: loan.lateFee.gracePeriodDays,
						gracePeriodRepayments: loan.lateFee.gracePeriodRepayments,
						totalGracePeriodFees: loan.lateFee.totalGracePeriodFees,
						totalAccruedFees: loan.lateFee.totalAccruedFees,
						status: loan.lateFee.status,
					} : null,
				};
			})
		);

		res.json({ loans: loansWithDetails });
		return;
	} catch (error) {
		console.error("Error fetching loans:", error);
		res.status(500).json({ error: "Internal server error" });
		return;
	}
});

/**
 * @swagger
 * /api/loans/{id}:
 *   get:
 *     summary: Get specific loan details
 *     tags: [Loans]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Loan ID
 *     responses:
 *       200:
 *         description: Loan details
 *       404:
 *         description: Loan not found
 *       500:
 *         description: Server error
 */
router.get(
	"/:id",
	authenticateAndVerifyPhone,
	async (req: AuthRequest, res: Response) => {
		try {
			const userId = req.user!.userId;
			const { id } = req.params;

			const loan = await prisma.loan.findFirst({
				where: {
					id,
					userId,
				},
				include: {
					application: {
						include: {
							product: true,
						},
					},
					repayments: {
						orderBy: {
							createdAt: "desc",
						},
					},
					walletTransactions: {
						where: {
							type: "LOAN_REPAYMENT",
						},
						orderBy: {
							createdAt: "desc",
						},
					},
					lateFee: {
						select: {
							gracePeriodDays: true,
							gracePeriodRepayments: true,
							totalGracePeriodFees: true,
							totalAccruedFees: true,
							status: true,
						},
					},
				},
			});

			if (!loan) {
				return res.status(404).json({ error: "Loan not found" });
			}

			const totalRepaid = loan.repayments
				.filter((r) => r.status === "COMPLETED")
				.reduce((sum, repayment) => sum + repayment.amount, 0);

			const progressPercentage =
				loan.principalAmount > 0
					? ((loan.principalAmount - loan.outstandingBalance) /
							loan.principalAmount) *
					  100
					: 0;

			// Use grace period from late_fees table if available, otherwise fall back to settings
			const gracePeriodDays = loan.lateFee?.gracePeriodDays ?? await getLateFeeGraceSettings();

			// Add grace period status to each repayment
			const repaymentsWithGraceStatus = loan.repayments.map(repayment => {
				const graceStatus = getRepaymentStatusWithGracePeriod(repayment, gracePeriodDays);
				return {
					...repayment,
					graceStatus: graceStatus.status,
					isInGracePeriod: graceStatus.isInGracePeriod,
					daysIntoGracePeriod: graceStatus.daysIntoGracePeriod,
					effectiveDaysOverdue: graceStatus.daysOverdue
				};
			});

			const loanWithDetails = {
				...loan,
				repayments: repaymentsWithGraceStatus,
				totalRepaid,
				progressPercentage: Math.round(progressPercentage * 100) / 100,
				canRepay: loan.outstandingBalance > 0,
				gracePeriodDays, // Include grace period setting for frontend reference
				// Add grace period information from late_fees table
				gracePeriodInfo: loan.lateFee ? {
					gracePeriodDays: loan.lateFee.gracePeriodDays,
					gracePeriodRepayments: loan.lateFee.gracePeriodRepayments,
					totalGracePeriodFees: loan.lateFee.totalGracePeriodFees,
					totalAccruedFees: loan.lateFee.totalAccruedFees,
					status: loan.lateFee.status,
				} : null,
			};

			res.json(loanWithDetails);
			return;
		} catch (error) {
			console.error("Error fetching loan details:", error);
			res.status(500).json({ error: "Internal server error" });
			return;
		}
	}
);

/**
 * @swagger
 * /api/loans/{id}/repayments:
 *   get:
 *     summary: Get loan repayment history
 *     tags: [Loans]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Loan ID
 *     responses:
 *       200:
 *         description: Loan repayment history
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 repayments:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       amount:
 *                         type: number
 *                       principalAmount:
 *                         type: number
 *                       interestAmount:
 *                         type: number
 *                       status:
 *                         type: string
 *                       dueDate:
 *                         type: string
 *                         format: date-time
 *                       paidAt:
 *                         type: string
 *                         format: date-time
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *       404:
 *         description: Loan not found
 *       500:
 *         description: Server error
 */
router.get(
	"/:id/repayments",
	authenticateAndVerifyPhone,
	async (req: AuthRequest, res: Response) => {
		try {
			const userId = req.user!.userId;
			const { id } = req.params;

			// First verify the loan belongs to the user
			const loan = await prisma.loan.findFirst({
				where: {
					id,
					userId,
				},
			});

			if (!loan) {
				return res.status(404).json({ error: "Loan not found" });
			}

			// Get repayment history
			const repayments = await prisma.loanRepayment.findMany({
				where: {
					loanId: id,
				},
				include: {
					receipts: {
						select: {
							id: true,
							receiptNumber: true,
							filePath: true,
							generatedBy: true,
							generatedAt: true,
						},
					},
				},
				orderBy: {
					createdAt: "desc",
				},
			});

			res.json({ repayments });
			return;
		} catch (error) {
			console.error("Error fetching loan repayments:", error);
			res.status(500).json({ error: "Internal server error" });
			return;
		}
	}
);

/**
 * @swagger
 * /api/loans/receipt/{receiptId}:
 *   get:
 *     summary: Download receipt PDF by receipt ID (public endpoint for WhatsApp)
 *     tags: [Loans]
 *     parameters:
 *       - in: path
 *         name: receiptId
 *         required: true
 *         schema:
 *           type: string
 *         description: Receipt ID
 *       - in: query
 *         name: phone
 *         required: false
 *         schema:
 *           type: string
 *         description: User's phone number for validation (optional)
 *     responses:
 *       200:
 *         description: Receipt PDF file
 *         content:
 *           application/pdf:
 *             schema:
 *               type: string
 *               format: binary
 *       404:
 *         description: Receipt not found
 *       500:
 *         description: Internal server error
 */
router.get(
	"/receipt/:receiptId",
	async (req: any, res: any) => {
		try {
			const { receiptId } = req.params;
			const { phone } = req.query;

			// Get the receipt with user and loan information
			const receipt = await prisma.paymentReceipt.findFirst({
				where: {
					id: receiptId,
				},
				include: {
					repayment: {
						include: {
							loan: {
								include: {
									user: {
										select: {
											phoneNumber: true,
											fullName: true,
										}
									}
								}
							}
						}
					}
				}
			});

			if (!receipt) {
				return res.status(404).json({ error: "Receipt not found" });
			}

			// Optional phone number validation for extra security
			if (phone && receipt.repayment.loan.user.phoneNumber !== phone) {
				return res.status(403).json({ error: "Access denied" });
			}

			// Import the receipt service dynamically
			const ReceiptService = await import("../lib/receiptService");
			const buffer = await ReceiptService.default.getReceiptBuffer(receiptId);

			res.setHeader('Content-Type', 'application/pdf');
			res.setHeader('Content-Disposition', `attachment; filename="${receipt.receiptNumber}.pdf"`);
			return res.send(buffer);
		} catch (error) {
			console.error("Error downloading receipt:", error);
			return res.status(500).json({ error: "Internal server error" });
		}
	}
);

/**
 * @swagger
 * /api/loans/{loanId}/receipts/{receiptId}/download:
 *   get:
 *     summary: Download receipt PDF for a loan repayment
 *     tags: [Loans]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: loanId
 *         required: true
 *         schema:
 *           type: string
 *         description: Loan ID
 *       - in: path
 *         name: receiptId
 *         required: true
 *         schema:
 *           type: string
 *         description: Receipt ID
 *     responses:
 *       200:
 *         description: Receipt PDF file
 *         content:
 *           application/pdf:
 *             schema:
 *               type: string
 *               format: binary
 *       404:
 *         description: Receipt not found or access denied
 *       500:
 *         description: Server error
 */
router.get(
	"/:loanId/receipts/:receiptId/download",
	authenticateAndVerifyPhone,
	async (req: AuthRequest, res: Response) => {
		try {
			const userId = req.user!.userId;
			const { loanId, receiptId } = req.params;

			// First verify the loan belongs to the user
			const loan = await prisma.loan.findFirst({
				where: {
					id: loanId,
					userId: userId,
				},
			});

			if (!loan) {
				return res.status(404).json({ error: "Loan not found" });
			}

			// Get the receipt and verify it belongs to this loan
			const receipt = await prisma.paymentReceipt.findFirst({
				where: {
					id: receiptId,
					repayment: {
						loanId: loanId,
					},
				},
			});

			if (!receipt) {
				return res.status(404).json({ error: "Receipt not found" });
			}

			// Import the receipt service dynamically
			const ReceiptService = await import("../lib/receiptService");
			const buffer = await ReceiptService.default.getReceiptBuffer(receiptId);

			res.setHeader('Content-Type', 'application/pdf');
			res.setHeader('Content-Disposition', `attachment; filename="${receipt.receiptNumber}.pdf"`);
			return res.send(buffer);
		} catch (error) {
			console.error("Error downloading receipt:", error);
			return res.status(500).json({ error: "Internal server error" });
		}
	}
);

/**
 * @swagger
 * /api/loans/{id}/transactions:
 *   get:
 *     summary: Get loan payment transactions from wallet
 *     tags: [Loans]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Loan ID
 *     responses:
 *       200:
 *         description: Loan payment transactions
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 walletTransactions:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       amount:
 *                         type: number
 *                       type:
 *                         type: string
 *                       status:
 *                         type: string
 *                       description:
 *                         type: string
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *                       updatedAt:
 *                         type: string
 *                         format: date-time
 *       404:
 *         description: Loan not found
 *       500:
 *         description: Server error
 */
router.get(
	"/:id/transactions",
	authenticateAndVerifyPhone,
	async (req: AuthRequest, res: Response) => {
		try {
			const userId = req.user!.userId;
			const { id } = req.params;

			// First verify the loan belongs to the user
			const loan = await prisma.loan.findFirst({
				where: {
					id,
					userId,
				},
			});

			if (!loan) {
				return res.status(404).json({ error: "Loan not found" });
			}

			// Get wallet transactions related to this loan
			const walletTransactions = await prisma.walletTransaction.findMany({
				where: {
					userId,
					loanId: id,
					type: "LOAN_REPAYMENT",
				},
				orderBy: {
					createdAt: "desc",
				},
			});

			res.json({ walletTransactions });
			return;
		} catch (error) {
			console.error("Error fetching loan transactions:", error);
			res.status(500).json({ error: "Internal server error" });
			return;
		}
	}
);

/**
 * @swagger
 * /api/loans/{id}/late-fees:
 *   get:
 *     summary: Get late fee information for a loan
 *     tags: [Loans]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Loan ID
 *     responses:
 *       200:
 *         description: Late fee information for the loan
 *       404:
 *         description: Loan not found
 *       500:
 *         description: Server error
 */
router.get(
	"/:id/late-fees",
	authenticateAndVerifyPhone,
	async (req: AuthRequest, res: Response) => {
		try {
			const userId = req.user!.userId;
			const { id } = req.params;

			// First verify the loan belongs to the user
			const loan = await prisma.loan.findFirst({
				where: {
					id,
					userId,
				},
			});

			if (!loan) {
				return res.status(404).json({ error: "Loan not found" });
			}

			// Get all overdue repayments with late fees
			const today = TimeUtils.malaysiaStartOfDay();

			const overdueRepaymentsQuery = `
				SELECT 
					lr.id,
					lr.amount,
					lr."actualAmount",
					lr."dueDate",
					lr.status,
					lr."installmentNumber",
					COALESCE(lr."lateFeeAmount" - lr."lateFeesPaid", 0) as total_late_fees,
					CASE WHEN lr."lateFeeAmount" > 0 THEN 1 ELSE 0 END as late_fee_entries,
					lr."updatedAt" as latest_calculation_date
				FROM loan_repayments lr
				WHERE lr."loanId" = $1
				  AND lr.status IN ('PENDING', 'PARTIAL')
				  AND lr."dueDate" < $2
				ORDER BY lr."dueDate" ASC
			`;

			const overdueRepayments = (await prisma.$queryRawUnsafe(
				overdueRepaymentsQuery,
				id,
				today
			)) as any[];

			// Calculate detailed information for each overdue repayment
			const detailedOverdueInfo = overdueRepayments.map((repayment) => {
				const outstandingAmount = repayment.actualAmount
					? Math.max(0, repayment.amount - repayment.actualAmount)
					: repayment.amount;

				const totalLateFees = Number(repayment.total_late_fees) || 0;
				const totalAmountDue = outstandingAmount + totalLateFees;

				const daysOverdue = TimeUtils.daysOverdue(new Date(repayment.dueDate));

				return {
					repaymentId: repayment.id,
					installmentNumber: repayment.installmentNumber,
					originalAmount: repayment.amount,
					outstandingAmount,
					totalLateFees,
					totalAmountDue,
					dueDate: repayment.dueDate,
					daysOverdue,
					status: repayment.status,
					lateFeeEntries: Number(repayment.late_fee_entries),
					latestCalculationDate: repayment.latest_calculation_date,
				};
			});

			// Calculate summary
			const summary = {
				totalOverdueAmount: detailedOverdueInfo.reduce(
					(sum, item) => sum + item.outstandingAmount,
					0
				),
				totalLateFees: detailedOverdueInfo.reduce(
					(sum, item) => sum + item.totalLateFees,
					0
				),
				totalAmountDue: detailedOverdueInfo.reduce(
					(sum, item) => sum + item.totalAmountDue,
					0
				),
				overdueRepaymentCount: detailedOverdueInfo.length,
				hasOverduePayments: detailedOverdueInfo.length > 0,
			};

			res.json({
				summary,
				overdueRepayments: detailedOverdueInfo,
			});
			return;
		} catch (error) {
			console.error("Error fetching late fee information:", error);
			res.status(500).json({ error: "Internal server error" });
			return;
		}
	}
);

/**
 * GET /api/loans/:loanId/download-agreement
 * Download signed loan agreement PDF (user-facing)
 */
router.get("/:loanId/download-agreement", authenticateAndVerifyPhone, async (req: AuthRequest, res: Response) => {
	try {
		const { loanId } = req.params;
		const userId = req.user!.userId;

		// Verify the loan belongs to the authenticated user
		const loan = await prisma.loan.findFirst({
			where: { 
				id: loanId,
				userId: userId
			},
			include: {
				user: true,
				application: {
					include: {
						product: true
					}
				}
			}
		});

		if (!loan) {
			return res.status(404).json({
				success: false,
				message: 'Loan not found'
			});
		}

		// Check if agreement is signed
		if (loan.agreementStatus !== 'SIGNED') {
			return res.status(400).json({
				success: false,
				message: 'Agreement is not yet signed'
			});
		}

		// Download PKI-signed PDF from signing orchestrator
		if (!loan.applicationId) {
			return res.status(400).json({
				success: false,
				message: 'No application ID found for this loan'
			});
		}

		try {
			const orchestratorUrl = process.env.SIGNING_ORCHESTRATOR_URL || 'https://sign.creditxpress.com.my';
			const signedPdfUrl = `${orchestratorUrl}/api/signed/${loan.applicationId}/download`;
			
			console.log('User downloading PKI PDF from:', signedPdfUrl);
			
			const response = await fetch(signedPdfUrl, {
				method: 'GET',
				headers: {
					'X-API-Key': process.env.SIGNING_ORCHESTRATOR_API_KEY || 'dev-api-key'
				}
			});

			if (!response.ok) {
				throw new Error(`Signing orchestrator responded with status: ${response.status}`);
			}

			// PKI-signed PDF is available
			const pdfBuffer = await response.arrayBuffer();
			
			// Set headers for PDF response
			res.setHeader('Content-Type', 'application/pdf');
			res.setHeader('Content-Disposition', `attachment; filename="loan-agreement-${loanId.substring(0, 8)}.pdf"`);
			res.setHeader('Content-Length', pdfBuffer.byteLength);
			
			// Send the PDF buffer
			return res.send(Buffer.from(pdfBuffer));
			
		} catch (error) {
			console.error('Failed to download PKI-signed PDF:', error);
			return res.status(500).json({
				success: false,
				message: 'Failed to download signed agreement from signing orchestrator',
				error: error instanceof Error ? error.message : 'Unknown error'
			});
		}

	} catch (error) {
		console.error('Error downloading signed agreement:', error);
		return res.status(500).json({
			success: false,
			message: 'Failed to download signed agreement',
			error: error instanceof Error ? error.message : 'Unknown error'
		});
	}
});

/**
 * GET /api/loans/:loanId/download-stamped-agreement
 * Download stamped loan agreement PDF (user-facing)
 */
router.get("/:loanId/download-stamped-agreement", authenticateAndVerifyPhone, async (req: AuthRequest, res: Response) => {
	try {
		const { loanId } = req.params;
		const userId = req.user!.userId;

		// Verify the loan belongs to the authenticated user
		const loan = await prisma.loan.findFirst({
			where: {
				id: loanId,
				application: {
					userId: userId
				}
			},
			include: {
				user: true,
				application: {
					include: {
						product: true
					}
				}
			}
		});

		if (!loan) {
			return res.status(404).json({
				success: false,
				message: 'Loan not found or access denied'
			});
		}

		// Check if stamped agreement exists
		if (!loan.pkiStampedPdfUrl) {
			return res.status(400).json({
				success: false,
				message: 'No stamped agreement available for download'
			});
		}

		// Download stamped PDF from signing orchestrator
		if (!loan.applicationId) {
			return res.status(400).json({
				success: false,
				message: 'No application ID found for this loan'
			});
		}

		try {
			const orchestratorUrl = process.env.SIGNING_ORCHESTRATOR_URL || 'https://sign.creditxpress.com.my';
			const stampedPdfUrl = `${orchestratorUrl}/api/admin/agreements/${loan.applicationId}/download/stamped`;
			
			console.log('User downloading stamped PDF from:', stampedPdfUrl);
			
			const response = await fetch(stampedPdfUrl, {
				method: 'GET',
				headers: {
					'X-API-Key': process.env.SIGNING_ORCHESTRATOR_API_KEY || 'dev-api-key'
				}
			});

			if (!response.ok) {
				throw new Error(`Signing orchestrator responded with status: ${response.status}`);
			}

			// Stamped PDF is available
			const pdfBuffer = await response.arrayBuffer();
			
			// Set headers for PDF response
			res.setHeader('Content-Type', 'application/pdf');
			res.setHeader('Content-Disposition', `attachment; filename="stamped-loan-agreement-${loan.user.fullName?.replace(/[^a-zA-Z0-9]/g, '_') || 'unknown'}-${loanId.substring(0, 8)}.pdf"`);
			res.setHeader('Content-Length', pdfBuffer.byteLength);
			
			// Send the PDF buffer
			return res.send(Buffer.from(pdfBuffer));
			
		} catch (error) {
			console.error('Failed to download stamped PDF:', error);
			return res.status(500).json({
				success: false,
				message: 'Failed to download stamped agreement from signing orchestrator',
				error: error instanceof Error ? error.message : 'Unknown error'
			});
		}

	} catch (error) {
		console.error('Error downloading stamped agreement:', error);
		return res.status(500).json({
			success: false,
			message: 'Failed to download stamped agreement',
			error: error instanceof Error ? error.message : 'Unknown error'
		});
	}
});

/**
 * GET /api/loans/:loanId/download-stamp-certificate
 * Download stamp certificate PDF (user-facing)
 */
router.get("/:loanId/download-stamp-certificate", authenticateAndVerifyPhone, async (req: AuthRequest, res: Response) => {
	try {
		const { loanId } = req.params;
		const userId = req.user!.userId;

		// Verify the loan belongs to the authenticated user
		const loan = await prisma.loan.findFirst({
			where: {
				id: loanId,
				application: {
					userId: userId
				}
			},
			include: {
				user: true,
				application: {
					include: {
						product: true
					}
				}
			}
		});

		if (!loan) {
			return res.status(404).json({
				success: false,
				message: 'Loan not found or access denied'
			});
		}

	// Check if certificate exists
	if (!loan.pkiStampCertificateUrl) {
		return res.status(400).json({
			success: false,
			message: 'Stamp certificate is not yet available for download'
		});
	}

	// Read certificate from local file system
	const certificatePath = path.join(__dirname, '../../', loan.pkiStampCertificateUrl);
	console.log(`📁 Reading stamp certificate from: ${certificatePath}`);

	if (!fs.existsSync(certificatePath)) {
		console.error(`❌ Stamp certificate file not found at: ${certificatePath}`);
		return res.status(404).json({
			success: false,
			message: 'Stamp certificate file not found on server'
		});
	}

	try {
		// Send the file
		res.setHeader('Content-Type', 'application/pdf');
		res.setHeader('Content-Disposition', `attachment; filename="stamp-certificate-${loanId.substring(0, 8)}.pdf"`);
		
		const fileStream = fs.createReadStream(certificatePath);
		fileStream.on('error', (error: Error) => {
			console.error('❌ Error streaming file:', error);
			if (!res.headersSent) {
				res.status(500).json({
					success: false,
					message: "Error streaming certificate file",
					error: error.message
				});
			}
		});
		fileStream.pipe(res);
		return;

	} catch (fileError) {
		console.error('❌ Error reading certificate file:', fileError);
		throw new Error(`Failed to read certificate file: ${fileError instanceof Error ? fileError.message : 'Unknown error'}`);
	}

	} catch (error) {
		console.error('❌ Error downloading stamp certificate:', error);

		return res.status(500).json({
			success: false,
			message: 'Failed to download stamp certificate',
			error: error instanceof Error ? error.message : 'Unknown error'
		});
	}
});

/**
 * @route GET /api/loans/:loanId/download-disbursement-slip
 * @description Download payment slip for loan disbursement (user-facing)
 */
router.get("/:loanId/download-disbursement-slip", authenticateAndVerifyPhone, async (req: AuthRequest, res: Response) => {
	try {
		const { loanId } = req.params;
		const userId = req.user!.userId;

		console.log(`📥 User ${userId} requesting disbursement slip for loan ${loanId}`);

		// Verify the loan belongs to the authenticated user
		const loan = await prisma.loan.findFirst({
			where: {
				id: loanId,
				application: {
					userId: userId
				}
			},
			include: {
				application: {
					include: {
						disbursement: {
							select: {
								paymentSlipUrl: true,
								referenceNumber: true
							}
						}
					}
				}
			}
		});

		if (!loan) {
			console.error(`❌ Loan not found or access denied for user ${userId}, loan ${loanId}`);
			return res.status(404).json({
				success: false,
				message: 'Loan not found or access denied'
			});
		}

		// Check if disbursement exists and has payment slip
		if (!loan.application.disbursement?.paymentSlipUrl) {
			console.log(`⚠️ No payment slip available for loan ${loanId}`);
			return res.status(404).json({
				success: false,
				message: 'Payment slip is not yet available for this loan'
			});
		}

		// Read payment slip from local file system
		const slipPath = path.join(__dirname, '../../', loan.application.disbursement.paymentSlipUrl);
		console.log(`📁 Reading payment slip from: ${slipPath}`);

		if (!fs.existsSync(slipPath)) {
			console.error(`❌ Payment slip file not found at: ${slipPath}`);
			return res.status(404).json({
				success: false,
				message: 'Payment slip file not found on server'
			});
		}

		// Send the file
		res.setHeader('Content-Type', 'application/pdf');
		res.setHeader('Content-Disposition', `attachment; filename="payment-slip-${loan.application.disbursement.referenceNumber}.pdf"`);
		
		const fileStream = fs.createReadStream(slipPath);
		fileStream.on('error', (error: Error) => {
			console.error('❌ Error streaming payment slip file:', error);
			if (!res.headersSent) {
				res.status(500).json({
					success: false,
					message: "Error streaming payment slip file",
					error: error.message
				});
			}
		});
		fileStream.pipe(res);
		console.log(`✅ Payment slip sent successfully to user ${userId}`);
		return;

	} catch (error) {
		console.error('❌ Error downloading payment slip:', error);

		return res.status(500).json({
			success: false,
			message: 'Failed to download payment slip',
			error: error instanceof Error ? error.message : 'Unknown error'
		});
	}
});

export default router;
