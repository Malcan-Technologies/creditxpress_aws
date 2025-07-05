/**
 * Cleanup Duplicate Late Fees Script
 *
 * This script removes duplicate late fee entries that may have been created
 * before the upsert logic was implemented. It keeps the latest entry for each
 * unique combination of loanRepaymentId, calculationDate, and feeType.
 */

const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function cleanupDuplicateLateFees() {
	console.log("🧹 Starting duplicate late fee cleanup...");

	try {
		// Find duplicates using a window function to identify rows to keep
		const duplicateQuery = `
			WITH duplicate_fees AS (
				SELECT 
					id,
					"loanRepaymentId",
					"calculationDate",
					"feeType",
					"updatedAt",
					ROW_NUMBER() OVER (
						PARTITION BY "loanRepaymentId", "calculationDate", "feeType" 
						ORDER BY "updatedAt" DESC, "createdAt" DESC
					) as row_num
				FROM late_fees
				WHERE status = 'ACTIVE'
			)
			SELECT id FROM duplicate_fees WHERE row_num > 1
		`;

		const duplicateIds = await prisma.$queryRawUnsafe(duplicateQuery);

		if (duplicateIds.length === 0) {
			console.log("✅ No duplicate late fees found. Database is clean!");
			return;
		}

		console.log(
			`🔍 Found ${duplicateIds.length} duplicate late fee entries to remove`
		);

		// Delete the duplicate entries
		const deleteQuery = `
			DELETE FROM late_fees 
			WHERE id = ANY($1::text[])
		`;

		const idsToDelete = duplicateIds.map((row) => row.id);
		await prisma.$executeRawUnsafe(deleteQuery, idsToDelete);

		console.log(
			`🗑️  Successfully removed ${duplicateIds.length} duplicate late fee entries`
		);

		// Show summary of remaining entries
		const summaryQuery = `
			SELECT 
				COUNT(*) as total_entries,
				COUNT(DISTINCT "loanRepaymentId") as unique_repayments,
				COUNT(DISTINCT "calculationDate") as unique_dates
			FROM late_fees
			WHERE status = 'ACTIVE'
		`;

		const summary = await prisma.$queryRawUnsafe(summaryQuery);
		console.log("📊 Cleanup Summary:");
		console.log(
			`   - Total active late fee entries: ${summary[0].total_entries}`
		);
		console.log(
			`   - Unique repayments with late fees: ${summary[0].unique_repayments}`
		);
		console.log(
			`   - Unique calculation dates: ${summary[0].unique_dates}`
		);

		console.log("✅ Duplicate late fee cleanup completed successfully!");
	} catch (error) {
		console.error("❌ Error during duplicate cleanup:", error);
		throw error;
	} finally {
		await prisma.$disconnect();
	}
}

// Run the cleanup
cleanupDuplicateLateFees()
	.then(() => {
		console.log("🎉 Cleanup process finished");
		process.exit(0);
	})
	.catch((error) => {
		console.error("💥 Cleanup process failed:", error);
		process.exit(1);
	});
