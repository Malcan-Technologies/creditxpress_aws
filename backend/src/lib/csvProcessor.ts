// CSV processing types and utilities

// Types for CSV processing
export interface RawTransaction {
	refCode: string;
	beneficiary: string;
	amount: number;
	transactionDate: Date | null;
	rawData: Record<string, any>;
}

export interface BankFormatConfig {
	name: string;
	patterns: {
		refCode: string[];
		beneficiary: string[];
		amount: string[];
		date?: string[];
	};
	amountParser: (value: string) => number;
	dateParser?: (value: string) => Date | null;
	detector: (headers: string[]) => boolean;
}

export interface TransactionMatch {
	transaction: RawTransaction;
	payment: {
		id: string;
		amount: number;
		reference?: string;
		user: {
			fullName: string;
		};
		loan: {
			id: string;
			application: {
				product: {
					name: string;
				};
			};
		};
	};
	matchScore: number;
	matchReasons: string[];
}

export interface CSVProcessingResult {
	transactions: RawTransaction[];
	matches: TransactionMatch[];
	unmatchedTransactions: RawTransaction[];
	unmatchedPayments: any[];
	processingErrors: string[];
	bankFormat: string;
	summary: {
		totalTransactions: number;
		totalMatches: number;
		totalAmount: number;
		matchedAmount: number;
	};
}

// Standardized CSV format configuration
const STANDARDIZED_FORMAT: BankFormatConfig = {
	name: "Standardized Format",
	patterns: {
		refCode: ["description_1", "description_2"], // Check both description fields for references
		beneficiary: ["beneficiary"],
		amount: ["cash_in"],
		date: ["transaction_date"]
	},
	amountParser: (value: string) => {
		if (!value || typeof value !== 'string') return 0;
		// Handle various amount formats: "RM 2000.00", "2,000.00", "2000.00"
		const cleaned = value.replace(/RM\s?|,/g, "").trim();
		const amount = parseFloat(cleaned);
		return isNaN(amount) ? 0 : amount;
	},
	dateParser: (value: string) => {
		if (!value || typeof value !== 'string') return null;
		
		// Handle various date formats: "31 Jul 2025", "31/07/2025", "2025-07-31"
		const trimmed = value.trim();
		
		// Try parsing different formats
		let date: Date | null = null;
		
		// Format: "31 Jul 2025"
		if (trimmed.match(/^\d{1,2}\s+[A-Za-z]{3}\s+\d{4}$/)) {
			date = new Date(trimmed);
		}
		// Format: "31/07/2025" or "07/31/2025"
		else if (trimmed.match(/^\d{1,2}\/\d{1,2}\/\d{4}$/)) {
			const parts = trimmed.split('/');
			// Assume DD/MM/YYYY format (common in Malaysia)
			date = new Date(`${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`);
		}
		// Format: "2025-07-31"
		else if (trimmed.match(/^\d{4}-\d{1,2}-\d{1,2}$/)) {
			date = new Date(trimmed);
		}
		// Fallback: try direct parsing
		else {
			date = new Date(trimmed);
		}
		
		// Convert to GMT+8 (Malaysia timezone) and return as UTC
		if (date && !isNaN(date.getTime())) {
			// Adjust for GMT+8 timezone
			const malaysiaOffset = 8 * 60; // 8 hours in minutes
			const utcTime = date.getTime() + (malaysiaOffset * 60 * 1000);
			return new Date(utcTime);
		}
		
		return null;
	},
	detector: (headers: string[]) => {
		const lowerHeaders = headers.map(h => h.toLowerCase().trim());
		const requiredHeaders = ['transaction_date', 'description_1', 'description_2', 'beneficiary', 'account', 'cash_in', 'cash_out'];
		
		// Check if all required headers are present
		return requiredHeaders.every(required => 
			lowerHeaders.includes(required)
		);
	}
};

// Legacy bank format configurations (kept for backward compatibility)
const LEGACY_BANK_FORMATS: BankFormatConfig[] = [
	{
		name: "Maybank (Legacy)",
		patterns: {
			refCode: ["Transaction Description 1", "Description", "Ref Code", "Reference"],
			beneficiary: ["Transaction Description 2", "Beneficiary", "To Account", "Recipient"],
			amount: ["Cash-out (RM)", "Amount (RM)", "Debit Amount", "Transaction Amount"]
		},
		amountParser: (value: string) => {
			// Handle formats like "RM 1,234.56" or "1,234.56"
			const cleaned = value.replace(/RM\s?|,/g, "").trim();
			return parseFloat(cleaned);
		},
		detector: (headers: string[]) => {
			const lowerHeaders = headers.map(h => h.toLowerCase());
			return lowerHeaders.some(h => h.includes("cash-out")) ||
				   lowerHeaders.some(h => h.includes("maybank"));
		}
	},
	{
		name: "CIMB (Legacy)",
		patterns: {
			refCode: ["Reference", "Transaction ID", "Ref No", "Description"],
			beneficiary: ["Beneficiary Name", "To Account", "Recipient", "Payee"],
			amount: ["Amount", "Debit Amount", "Transaction Amount", "Amount (RM)"]
		},
		amountParser: (value: string) => {
			const cleaned = value.replace(/RM\s?|,/g, "").trim();
			return parseFloat(cleaned);
		},
		detector: (headers: string[]) => {
			const lowerHeaders = headers.map(h => h.toLowerCase());
			return lowerHeaders.some(h => h.includes("cimb")) ||
				   lowerHeaders.some(h => h.includes("beneficiary name"));
		}
	},
	{
		name: "Public Bank (Legacy)",
		patterns: {
			refCode: ["Remarks", "Description", "Reference No", "Transaction Details"],
			beneficiary: ["Beneficiary", "Recipient Name", "To", "Payee Name"],
			amount: ["Amount", "Debit", "Debit Amount", "Amount (RM)"]
		},
		amountParser: (value: string) => {
			const cleaned = value.replace(/RM\s?|,/g, "").trim();
			return parseFloat(cleaned);
		},
		detector: (headers: string[]) => {
			const lowerHeaders = headers.map(h => h.toLowerCase());
			return lowerHeaders.some(h => h.includes("public")) ||
				   lowerHeaders.some(h => h.includes("remarks"));
		}
	},
	{
		name: "Generic (Legacy)",
		patterns: {
			refCode: ["reference", "ref", "description", "remarks", "details", "transaction id", "ref code"],
			beneficiary: ["beneficiary", "recipient", "to", "payee", "account holder", "name"],
			amount: ["amount", "debit", "cash", "withdrawal", "payment", "value"]
		},
		amountParser: (value: string) => {
			// Handle various amount formats
			const cleaned = value.replace(/[^0-9.-]/g, "");
			return parseFloat(cleaned);
		},
		detector: (_headers: string[]) => true // Always matches as fallback
	}
];

// Combined formats array with standardized format first
const BANK_FORMATS: BankFormatConfig[] = [STANDARDIZED_FORMAT, ...LEGACY_BANK_FORMATS];

/**
 * Parse CSV content with various delimiters and encodings
 */
export function parseCSVContent(content: string): string[][] {
	try {
		// Clean up the content
		let cleanContent = content.trim();
		
		// Handle different line endings
		cleanContent = cleanContent.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
		
		// Detect delimiter (comma, semicolon, or tab)
		const delimiters = [',', ';', '\t'];
		let bestDelimiter = ',';
		let maxColumns = 0;
		
		for (const delimiter of delimiters) {
			const testLine = cleanContent.split('\n')[0];
			const columns = testLine.split(delimiter).length;
			if (columns > maxColumns) {
				maxColumns = columns;
				bestDelimiter = delimiter;
			}
		}
		
		// Parse CSV manually to handle quotes and escaping
		const lines = cleanContent.split('\n').filter(line => line.trim());
		const result: string[][] = [];
		
		for (const line of lines) {
			const row: string[] = [];
			let current = '';
			let inQuotes = false;
			let i = 0;
			
			while (i < line.length) {
				const char = line[i];
				const nextChar = line[i + 1];
				
				if (char === '"') {
					if (inQuotes && nextChar === '"') {
						// Escaped quote
						current += '"';
						i += 2;
						continue;
					} else {
						// Toggle quote state
						inQuotes = !inQuotes;
					}
				} else if (char === bestDelimiter && !inQuotes) {
					// End of field
					row.push(current.trim());
					current = '';
				} else {
					current += char;
				}
				i++;
			}
			
			// Add the last field
			row.push(current.trim());
			
			// Only add rows with content
			if (row.some(cell => cell.length > 0)) {
				result.push(row);
			}
		}
		
		return result;
	} catch (error) {
		throw new Error(`Failed to parse CSV: ${error instanceof Error ? error.message : 'Unknown error'}`);
	}
}

/**
 * Detect bank format from CSV headers
 */
export function detectBankFormat(headers: string[]): BankFormatConfig {
	const normalizedHeaders = headers.map(h => h.toLowerCase().trim());
	
	for (const format of BANK_FORMATS) {
		if (format.name !== "Generic" && format.detector(normalizedHeaders)) {
			return format;
		}
	}
	
	// Return generic format as fallback
	return BANK_FORMATS[BANK_FORMATS.length - 1];
}

/**
 * Find the best matching column for a field type
 */
function findBestColumn(headers: string[], patterns: string[]): string | null {
	const normalizedHeaders = headers.map(h => h.toLowerCase().trim());
	const normalizedPatterns = patterns.map(p => p.toLowerCase().trim());
	
	// First try exact matches
	for (const pattern of normalizedPatterns) {
		const exactMatch = normalizedHeaders.find(h => h === pattern);
		if (exactMatch) {
			return headers[normalizedHeaders.indexOf(exactMatch)];
		}
	}
	
	// Then try partial matches
	for (const pattern of normalizedPatterns) {
		const partialMatch = normalizedHeaders.find(h => h.includes(pattern) || pattern.includes(h));
		if (partialMatch) {
			return headers[normalizedHeaders.indexOf(partialMatch)];
		}
	}
	
	return null;
}

/**
 * Extract transactions from parsed CSV data
 */
export function extractTransactions(
	csvData: string[][],
	bankFormat: BankFormatConfig
): { transactions: RawTransaction[]; errors: string[] } {
	const errors: string[] = [];
	const transactions: RawTransaction[] = [];
	
	if (csvData.length === 0) {
		errors.push("CSV file is empty");
		return { transactions, errors };
	}
	
	// Find header row (skip empty rows at the top)
	let headerRowIndex = 0;
	while (headerRowIndex < csvData.length && csvData[headerRowIndex].every(cell => !cell.trim())) {
		headerRowIndex++;
	}
	
	if (headerRowIndex >= csvData.length) {
		errors.push("No valid header row found");
		return { transactions, errors };
	}
	
	const headers = csvData[headerRowIndex];
	
	// Find column mappings
	const refCodeColumn = findBestColumn(headers, bankFormat.patterns.refCode);
	const beneficiaryColumn = findBestColumn(headers, bankFormat.patterns.beneficiary);
	const amountColumn = findBestColumn(headers, bankFormat.patterns.amount);
	
	if (!refCodeColumn) {
		errors.push(`Could not find reference code column. Expected one of: ${bankFormat.patterns.refCode.join(', ')}`);
	}
	if (!beneficiaryColumn) {
		errors.push(`Could not find beneficiary column. Expected one of: ${bankFormat.patterns.beneficiary.join(', ')}`);
	}
	if (!amountColumn) {
		errors.push(`Could not find amount column. Expected one of: ${bankFormat.patterns.amount.join(', ')}`);
	}
	
	if (!refCodeColumn || !beneficiaryColumn || !amountColumn) {
		return { transactions, errors };
	}
	
	// Get column indices
	const refCodeIndex = headers.indexOf(refCodeColumn);
	const beneficiaryIndex = headers.indexOf(beneficiaryColumn);
	const amountIndex = headers.indexOf(amountColumn);
	
	// Find date column if patterns are defined
	let dateColumn: string | undefined;
	let dateIndex = -1;
	if (bankFormat.patterns.date) {
		for (const pattern of bankFormat.patterns.date) {
			dateColumn = headers.find(h => 
				h.toLowerCase().trim().includes(pattern.toLowerCase()) ||
				pattern.toLowerCase().includes(h.toLowerCase().trim())
			);
			if (dateColumn) {
				dateIndex = headers.indexOf(dateColumn);
				break;
			}
		}
	}
	
	// Process data rows
	for (let i = headerRowIndex + 1; i < csvData.length; i++) {
		const row = csvData[i];
		
		// Skip empty rows
		if (row.every(cell => !cell.trim())) {
			continue;
		}
		
		try {
			let refCode = "";
			const beneficiary = row[beneficiaryIndex]?.trim() || "";
			const amountStr = row[amountIndex]?.trim() || "";
			const dateStr = dateIndex >= 0 ? row[dateIndex]?.trim() || "" : "";
			
			// For standardized format, check both description fields for reference codes
			if (bankFormat.name === "Standardized Format") {
				const desc1Index = headers.findIndex(h => h.toLowerCase().trim() === "description_1");
				const desc2Index = headers.findIndex(h => h.toLowerCase().trim() === "description_2");
				
				const desc1 = desc1Index >= 0 ? row[desc1Index]?.trim() || "" : "";
				const desc2 = desc2Index >= 0 ? row[desc2Index]?.trim() || "" : "";
				
				// Use description_1 as primary reference, fallback to description_2
				refCode = desc1 || desc2;
			} else {
				// Legacy format - use the mapped refCode column
				refCode = row[refCodeIndex]?.trim() || "";
			}
			
			if (!refCode && !beneficiary && !amountStr) {
				continue; // Skip completely empty transaction rows
			}
			
			const amount = bankFormat.amountParser(amountStr);
			
			// Parse transaction date
			let transactionDate: Date | null = null;
			if (dateStr && bankFormat.dateParser) {
				transactionDate = bankFormat.dateParser(dateStr);
				if (!transactionDate) {
					errors.push(`Row ${i + 1}: Invalid date format "${dateStr}"`);
				}
			}
			
			// Skip rows with no meaningful data (no ref code, no beneficiary, and zero amount)
			if (!refCode && !beneficiary && amount === 0) {
				continue; // Skip empty transaction rows
			}
			
			// Only warn about invalid amounts if there's other meaningful data
			if (isNaN(amount) && (refCode || beneficiary)) {
				errors.push(`Row ${i + 1}: Invalid amount "${amountStr}" - defaulting to 0`);
			}
			
			// Create raw data object with all fields
			const rawData: Record<string, any> = {};
			headers.forEach((header, index) => {
				if (row[index] !== undefined) {
					rawData[header] = row[index];
				}
			});
			
			transactions.push({
				refCode,
				beneficiary,
				amount: isNaN(amount) ? 0 : amount, // Default to 0 if amount is invalid
				transactionDate,
				rawData
			});
		} catch (error) {
			errors.push(`Row ${i + 1}: ${error instanceof Error ? error.message : 'Processing error'}`);
		}
	}
	
	return { transactions, errors };
}

/**
 * Calculate match score between transaction and payment
 */
function calculateMatchScore(
	transaction: RawTransaction,
	payment: any
): { score: number; reasons: string[] } {
	let score = 0;
	const reasons: string[] = [];
	
	console.log('Matching transaction:', {
		refCode: transaction.refCode,
		beneficiary: transaction.beneficiary,
		amount: transaction.amount,
		transactionDate: transaction.transactionDate
	});
	console.log('Against payment:', {
		reference: payment.reference,
		fullName: payment.user?.fullName,
		amount: payment.amount,
		id: payment.id
	});
	
	// Exact reference match (highest priority)
	if (transaction.refCode && payment.reference) {
		if (transaction.refCode.toLowerCase() === payment.reference.toLowerCase()) {
			score += 50;
			reasons.push("Exact reference match");
		} else if (transaction.refCode.toLowerCase().includes(payment.reference.toLowerCase()) ||
				   payment.reference.toLowerCase().includes(transaction.refCode.toLowerCase())) {
			score += 30;
			reasons.push("Partial reference match");
		}
	} else {
		console.log('No reference match - transaction.refCode:', transaction.refCode, 'payment.reference:', payment.reference);
	}
	
	// Amount match (critical - exact match required)
	const amountDiff = Math.abs(transaction.amount - Math.abs(payment.amount));
	
	if (amountDiff === 0) {
		score += 40;
		reasons.push("Exact amount match");
	} else {
		// No points for non-exact amounts - this is now a hard requirement
		console.log(`Amount mismatch - transaction: ${transaction.amount}, payment: ${Math.abs(payment.amount)}, diff: ${amountDiff}`);
		return { score: 0, reasons: ["Amount must match exactly"] };
	}
	
	// Beneficiary name match (if available) - Case-insensitive matching
	if (transaction.beneficiary && payment.user?.fullName) {
		// Normalize names: lowercase, trim, remove extra spaces
		const transactionName = transaction.beneficiary.toLowerCase().trim().replace(/\s+/g, ' ');
		const paymentName = payment.user.fullName.toLowerCase().trim().replace(/\s+/g, ' ');
		
		console.log('Name matching:', {
			transactionName,
			paymentName
		});
		
		// Check for exact match first (after normalization)
		if (transactionName === paymentName) {
			score += 20;
			reasons.push("Exact beneficiary name match (case-insensitive)");
		} else {
			// Split names into words for partial matching
			const transactionWords = transactionName.split(/\s+/);
			const paymentWords = paymentName.split(/\s+/);
			
			// Check for word matches
			let wordMatches = 0;
			for (const tWord of transactionWords) {
				for (const pWord of paymentWords) {
					if (tWord.length > 2 && pWord.length > 2) {
						if (tWord === pWord) {
							wordMatches++;
						} else if (tWord.includes(pWord) || pWord.includes(tWord)) {
							wordMatches += 0.5;
						}
					}
				}
			}
			
			if (wordMatches >= 2) {
				score += 15; // Slightly less than exact match
				reasons.push("Strong beneficiary name match");
			} else if (wordMatches >= 1) {
				score += 8; // Slightly less than strong match
				reasons.push("Partial beneficiary name match");
			}
		}
	}
	
	// Loan ID in reference (bonus criteria) - Check first 8 digits only
	if (transaction.refCode && payment.loan?.id) {
		const loanIdFirst8 = payment.loan.id.substring(0, 8);
		if (transaction.refCode.includes(loanIdFirst8)) {
			score += 15;
			reasons.push("✨ Bonus: Loan ID found in reference");
		}
	}
	
	// Date match (transaction date vs payment due date or creation date)
	if (transaction.transactionDate && payment.dueDate) {
		const transactionDate = transaction.transactionDate;
		const dueDate = new Date(payment.dueDate);
		
		// Calculate difference in days
		const daysDiff = Math.abs((transactionDate.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
		
		if (daysDiff <= 1) {
			score += 15;
			reasons.push("✨ Bonus: Transaction date matches due date");
		} else if (daysDiff <= 7) {
			score += 10;
			reasons.push("✨ Bonus: Transaction date within 1 week of due date");
		} else if (daysDiff <= 30) {
			score += 5;
			reasons.push("✨ Bonus: Transaction date within 1 month of due date");
		}
	}
	
	// Normalize score to 100% maximum
	// Core criteria: 50 (ref) + 40 (amount) + 20 (name) = 110 points for "perfect match"
	// Bonus criteria: 15 (loan ID) + 15 (date) = 30 points extra
	// Use 110 as base for 100%, allowing bonus to exceed 100%
	const coreMaxScore = 110; // ref + amount + name = practical "perfect match"
	const normalizedScore = Math.min(100, Math.round((score / coreMaxScore) * 100));
	
	console.log('Match score breakdown:', {
		rawScore: score,
		coreMaxScore: coreMaxScore,
		normalizedScore: normalizedScore,
		reasons: reasons
	});
	return { score: normalizedScore, reasons };
}

/**
 * Match transactions against pending payments
 */
export function matchTransactions(
	transactions: RawTransaction[],
	pendingPayments: any[]
): TransactionMatch[] {
	const matches: TransactionMatch[] = [];
	const usedPaymentIds = new Set<string>();
	const usedTransactionIndices = new Set<number>();
	
	// First pass: Find high-confidence matches (score >= 40%) - Amount match is now required baseline
	for (let i = 0; i < transactions.length; i++) {
		if (usedTransactionIndices.has(i)) continue;
		
		const transaction = transactions[i];
		let bestMatch: TransactionMatch | null = null;
		
		for (const payment of pendingPayments) {
			if (usedPaymentIds.has(payment.id)) continue;
			
			const { score, reasons } = calculateMatchScore(transaction, payment);
			
			// Score > 0 means amount matched exactly, then check for additional criteria
			if (score >= 40) {
				if (!bestMatch || score > bestMatch.matchScore) {
					bestMatch = {
						transaction,
						payment,
						matchScore: score,
						matchReasons: reasons
					};
				}
			}
		}
		
		if (bestMatch) {
			matches.push(bestMatch);
			usedPaymentIds.add(bestMatch.payment.id);
			usedTransactionIndices.add(i);
		}
	}
	
	// Second pass: Find any remaining matches with exact amount (score > 0, ~29% minimum for amount-only match)
	for (let i = 0; i < transactions.length; i++) {
		if (usedTransactionIndices.has(i)) continue;
		
		const transaction = transactions[i];
		let bestMatch: TransactionMatch | null = null;
		
		for (const payment of pendingPayments) {
			if (usedPaymentIds.has(payment.id)) continue;
			
			const { score, reasons } = calculateMatchScore(transaction, payment);
			
			// Any score > 0 means amount matched exactly
			if (score > 0) {
				if (!bestMatch || score > bestMatch.matchScore) {
					bestMatch = {
						transaction,
						payment,
						matchScore: score,
						matchReasons: reasons
					};
				}
			}
		}
		
		if (bestMatch) {
			matches.push(bestMatch);
			usedPaymentIds.add(bestMatch.payment.id);
			usedTransactionIndices.add(i);
		}
	}
	
	// Sort matches by score (highest first)
	matches.sort((a, b) => b.matchScore - a.matchScore);
	
	return matches;
}

/**
 * Process uploaded CSV file and match against pending payments
 */
export function processCSVFile(
	csvContent: string,
	pendingPayments: any[]
): CSVProcessingResult {
	const processingErrors: string[] = [];
	
	try {
		// Parse CSV content
		const csvData = parseCSVContent(csvContent);
		
		if (csvData.length === 0) {
			processingErrors.push("CSV file is empty or could not be parsed");
			return {
				transactions: [],
				matches: [],
				unmatchedTransactions: [],
				unmatchedPayments: pendingPayments,
				processingErrors,
				bankFormat: "Unknown",
				summary: {
					totalTransactions: 0,
					totalMatches: 0,
					totalAmount: 0,
					matchedAmount: 0
				}
			};
		}
		
		// Detect bank format
		const bankFormat = detectBankFormat(csvData[0]);
		
		// Extract transactions
		const { transactions, errors } = extractTransactions(csvData, bankFormat);
		processingErrors.push(...errors);
		
		console.log('Extracted transactions:', transactions.length);
		console.log('Sample transactions:', transactions.slice(0, 3));
		console.log('Pending payments:', pendingPayments.length);
		console.log('Sample pending payments:', pendingPayments.slice(0, 3).map(p => ({
			id: p.id,
			reference: p.reference,
			amount: p.amount,
			fullName: p.user?.fullName
		})));
		
		if (transactions.length === 0) {
			return {
				transactions: [],
				matches: [],
				unmatchedTransactions: [],
				unmatchedPayments: pendingPayments,
				processingErrors,
				bankFormat: bankFormat.name,
				summary: {
					totalTransactions: 0,
					totalMatches: 0,
					totalAmount: 0,
					matchedAmount: 0
				}
			};
		}
		
		// Match transactions against pending payments
		const matches = matchTransactions(transactions, pendingPayments);
		
		// Calculate unmatched items
		const matchedTransactionIndices = new Set(
			matches.map(m => transactions.indexOf(m.transaction))
		);
		const matchedPaymentIds = new Set(matches.map(m => m.payment.id));
		
		const unmatchedTransactions = transactions.filter(
			(_, index) => !matchedTransactionIndices.has(index)
		);
		const unmatchedPayments = pendingPayments.filter(
			p => !matchedPaymentIds.has(p.id)
		);
		
		// Calculate summary
		const matchedAmount = matches.reduce((sum, m) => sum + m.transaction.amount, 0);
		
		return {
			transactions,
			matches,
			unmatchedTransactions,
			unmatchedPayments,
			processingErrors,
			bankFormat: bankFormat.name,
			summary: {
				totalTransactions: transactions.length,
				totalMatches: matches.length,
				totalAmount: matchedAmount, // Show only matched amounts in summary
				matchedAmount
			}
		};
	} catch (error) {
		processingErrors.push(`Processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
		
		return {
			transactions: [],
			matches: [],
			unmatchedTransactions: [],
			unmatchedPayments: pendingPayments,
			processingErrors,
			bankFormat: "Unknown",
			summary: {
				totalTransactions: 0,
				totalMatches: 0,
				totalAmount: 0,
				matchedAmount: 0
			}
		};
	}
}