/**
 * Precision and Timezone Utilities
 * 
 * This module provides consistent decimal precision handling and timezone utilities
 * to ensure all financial calculations are accurate to 2 decimal places and
 * all dates are handled consistently in UTC.
 */

/**
 * Round a number to exactly 2 decimal places
 * Handles floating point precision issues
 */
export function roundTo2Decimals(value: number): number {
    if (typeof value !== 'number' || isNaN(value)) {
        return 0;
    }
    return Math.round(value * 100) / 100;
}

/**
 * Round a number to specified decimal places for high precision calculations
 * Used for late fee percentage calculations that need higher precision
 */
export function roundToDecimals(value: number, decimals: number): number {
    if (typeof value !== 'number' || isNaN(value)) {
        return 0;
    }
    const factor = Math.pow(10, decimals);
    return Math.round(value * factor) / factor;
}

/**
 * Calculate late fee with high precision during calculation, round final result to 2 decimals
 * This preserves precision for small percentage calculations like 0.022% per day
 */
export function calculateLateFeeHighPrecision(
    principal: number, 
    dailyRate: number, 
    days: number
): number {
    if (typeof principal !== 'number' || typeof dailyRate !== 'number' || typeof days !== 'number') {
        return 0;
    }
    if (isNaN(principal) || isNaN(dailyRate) || isNaN(days)) {
        return 0;
    }
    
    // Use high precision during calculation (8 decimal places)
    const highPrecisionResult = principal * dailyRate * days;
    
    // Only round the final result to 2 decimal places
    return roundTo2Decimals(highPrecisionResult);
}

/**
 * Add two numbers with precise 2 decimal rounding
 */
export function addPrecise(a: number, b: number): number {
    return roundTo2Decimals(a + b);
}

/**
 * Subtract two numbers with precise 2 decimal rounding
 */
export function subtractPrecise(a: number, b: number): number {
    return roundTo2Decimals(a - b);
}

/**
 * Multiply two numbers with precise 2 decimal rounding
 */
export function multiplyPrecise(a: number, b: number): number {
    return roundTo2Decimals(a * b);
}

/**
 * Divide two numbers with precise 2 decimal rounding
 */
export function dividePrecise(a: number, b: number): number {
    if (b === 0) {
        throw new Error('Division by zero');
    }
    return roundTo2Decimals(a / b);
}

/**
 * Convert any value to a safe number with 2 decimal precision
 */
export function toSafeNumber(value: any): number {
    const num = Number(value);
    return isNaN(num) ? 0 : roundTo2Decimals(num);
}

/**
 * Calculate percentage with 2 decimal precision
 */
export function calculatePercentage(value: number, percentage: number): number {
    return multiplyPrecise(value, percentage / 100);
}

/**
 * Get current date in UTC with time set to start of day (00:00:00.000Z)
 */
export function getUTCStartOfDay(date?: Date): Date {
    const targetDate = date || new Date();
    const utcDate = new Date(targetDate);
    utcDate.setUTCHours(0, 0, 0, 0);
    return utcDate;
}

/**
 * Get current date in Malaysia timezone (UTC+8) with time set to start of day,
 * then convert to UTC for database storage
 */
export function getMalaysiaStartOfDay(date?: Date): Date {
    const targetDate = date || new Date();
    
    // Convert to Malaysia timezone (UTC+8)
    const malaysiaTime = new Date(targetDate.getTime() + (8 * 60 * 60 * 1000));
    
    // Get start of day in Malaysia timezone
    const malaysiaStartOfDay = new Date(malaysiaTime);
    malaysiaStartOfDay.setUTCHours(0, 0, 0, 0);
    
    // Convert back to UTC for database storage
    const utcEquivalent = new Date(malaysiaStartOfDay.getTime() - (8 * 60 * 60 * 1000));
    
    return utcEquivalent;
}

/**
 * Get current date in UTC with time set to end of day (23:59:59.999Z)
 */
export function getUTCEndOfDay(date?: Date): Date {
    const targetDate = date || new Date();
    const utcDate = new Date(targetDate);
    utcDate.setUTCHours(23, 59, 59, 999);
    return utcDate;
}

/**
 * Calculate days between two dates (always positive, UTC-based)
 */
export function calculateDaysBetween(startDate: Date, endDate: Date): number {
    const start = getUTCStartOfDay(startDate);
    const end = getUTCStartOfDay(endDate);
    const diffMs = end.getTime() - start.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays);
}

/**
 * Calculate days overdue from due date to today (UTC)
 */
export function calculateDaysOverdue(dueDate: Date): number {
    const today = getUTCStartOfDay();
    const due = getUTCStartOfDay(dueDate);
    const diffMs = today.getTime() - due.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays);
}

/**
 * Calculate days overdue from due date to today (Malaysia timezone)
 */
export function calculateDaysOverdueMalaysia(dueDate: Date): number {
    const today = getMalaysiaStartOfDay();
    const due = getMalaysiaStartOfDay(dueDate);
    const diffMs = today.getTime() - due.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays);
}

/**
 * Determine payment type based on payment date vs due date (UTC)
 */
export function determinePaymentType(paymentDate: Date, dueDate: Date): {
    paymentType: 'EARLY' | 'ON_TIME' | 'LATE';
    daysEarly: number;
    daysLate: number;
} {
    const payment = getUTCStartOfDay(paymentDate);
    const due = getUTCStartOfDay(dueDate);
    const diffMs = payment.getTime() - due.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
        return {
            paymentType: 'EARLY',
            daysEarly: Math.abs(diffDays),
            daysLate: 0
        };
    } else if (diffDays === 0) {
        return {
            paymentType: 'ON_TIME',
            daysEarly: 0,
            daysLate: 0
        };
    } else {
        return {
            paymentType: 'LATE',
            daysEarly: 0,
            daysLate: diffDays
        };
    }
}

/**
 * Determine payment type based on payment date vs due date (Malaysia timezone)
 */
export function determinePaymentTypeMalaysia(paymentDate: Date, dueDate: Date): {
    paymentType: 'EARLY' | 'ON_TIME' | 'LATE';
    daysEarly: number;
    daysLate: number;
} {
    const payment = getMalaysiaStartOfDay(paymentDate);
    const due = getMalaysiaStartOfDay(dueDate);
    const diffMs = payment.getTime() - due.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
        return {
            paymentType: 'EARLY',
            daysEarly: Math.abs(diffDays),
            daysLate: 0
        };
    } else if (diffDays === 0) {
        return {
            paymentType: 'ON_TIME',
            daysEarly: 0,
            daysLate: 0
        };
    } else {
        return {
            paymentType: 'LATE',
            daysEarly: 0,
            daysLate: diffDays
        };
    }
}

/**
 * Safe math operations with error handling
 */
export const SafeMath = {
    add: addPrecise,
    subtract: subtractPrecise,
    multiply: multiplyPrecise,
    divide: dividePrecise,
    round: roundTo2Decimals,
    toNumber: toSafeNumber,
    percentage: calculatePercentage,
    max: (...values: number[]) => roundTo2Decimals(Math.max(...values.map(toSafeNumber))),
    min: (...values: number[]) => roundTo2Decimals(Math.min(...values.map(toSafeNumber))),
    lateFeeCalculation: calculateLateFeeHighPrecision,
    roundToDecimals: roundToDecimals
};

/**
 * Timezone utilities
 */
export const TimeUtils = {
    utcStartOfDay: getUTCStartOfDay,
    utcEndOfDay: getUTCEndOfDay,
    daysBetween: calculateDaysBetween,
    daysOverdue: calculateDaysOverdueMalaysia,
    daysOverdueUTC: calculateDaysOverdue,
    malaysiaStartOfDay: getMalaysiaStartOfDay,
    paymentType: determinePaymentTypeMalaysia,
    paymentTypeUTC: determinePaymentType
}; 