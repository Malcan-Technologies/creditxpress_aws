import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

// Define styles for the Lampiran A PDF - Official compliance document format
const styles = StyleSheet.create({
  page: {
    flexDirection: 'column',
    backgroundColor: '#FFFFFF',
    padding: 30,
    fontFamily: 'Helvetica',
    fontSize: 9,
  },
  // Top right label
  topRightLabel: {
    position: 'absolute',
    top: 15,
    right: 30,
    fontSize: 9,
    fontWeight: 'bold',
  },
  // Header section
  header: {
    marginBottom: 15,
    paddingBottom: 10,
  },
  headerTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 3,
  },
  headerSubtitle: {
    fontSize: 9,
    textAlign: 'center',
    marginBottom: 2,
  },
  // Section titles
  sectionTitle: {
    fontSize: 10,
    fontWeight: 'bold',
    marginTop: 12,
    marginBottom: 8,
    backgroundColor: '#F3F4F6',
    padding: 5,
  },
  sectionNumber: {
    fontWeight: 'bold',
  },
  // Borrower details section
  borrowerSection: {
    marginBottom: 10,
  },
  borrowerTable: {
    borderWidth: 1,
    borderColor: '#000000',
  },
  borrowerRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#000000',
  },
  borrowerRowLast: {
    flexDirection: 'row',
  },
  borrowerLabel: {
    width: '35%',
    padding: 4,
    fontSize: 8,
    borderRightWidth: 1,
    borderRightColor: '#000000',
    backgroundColor: '#F9FAFB',
  },
  borrowerValue: {
    width: '65%',
    padding: 4,
    fontSize: 8,
    fontWeight: 'bold',
  },
  borrowerSubRow: {
    flexDirection: 'row',
    width: '65%',
  },
  borrowerSubLabel: {
    width: '40%',
    padding: 4,
    fontSize: 7,
    borderRightWidth: 1,
    borderRightColor: '#000000',
  },
  borrowerSubValue: {
    width: '60%',
    padding: 4,
    fontSize: 8,
    fontWeight: 'bold',
  },
  // Loan details table
  loanTable: {
    borderWidth: 1,
    borderColor: '#000000',
    marginBottom: 10,
  },
  loanHeaderRow: {
    flexDirection: 'row',
    backgroundColor: '#E5E7EB',
    borderBottomWidth: 1,
    borderBottomColor: '#000000',
  },
  loanDataRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#CCCCCC',
  },
  loanDataRowLast: {
    flexDirection: 'row',
  },
  loanCell: {
    padding: 4,
    fontSize: 7,
    textAlign: 'center',
    borderRightWidth: 1,
    borderRightColor: '#000000',
  },
  loanCellLast: {
    padding: 4,
    fontSize: 7,
    textAlign: 'center',
  },
  loanHeaderCell: {
    padding: 4,
    fontSize: 7,
    fontWeight: 'bold',
    textAlign: 'center',
    borderRightWidth: 1,
    borderRightColor: '#000000',
  },
  loanHeaderCellLast: {
    padding: 4,
    fontSize: 7,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  // Repayment table
  repaymentTable: {
    borderWidth: 1,
    borderColor: '#000000',
  },
  repaymentHeaderRow: {
    flexDirection: 'row',
    backgroundColor: '#E5E7EB',
    borderBottomWidth: 1,
    borderBottomColor: '#000000',
  },
  repaymentDataRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#CCCCCC',
  },
  repaymentDataRowLast: {
    flexDirection: 'row',
  },
  repaymentCell: {
    padding: 3,
    fontSize: 7,
    textAlign: 'center',
    borderRightWidth: 1,
    borderRightColor: '#000000',
  },
  repaymentCellLast: {
    padding: 3,
    fontSize: 7,
    textAlign: 'left',
  },
  repaymentHeaderCell: {
    padding: 3,
    fontSize: 7,
    fontWeight: 'bold',
    textAlign: 'center',
    borderRightWidth: 1,
    borderRightColor: '#000000',
  },
  repaymentHeaderCellLast: {
    padding: 3,
    fontSize: 7,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  // Column widths for loan table
  loanColDate: { width: '10%' },
  loanColPrincipal: { width: '13%' },
  loanColInterest: { width: '13%' },
  loanColTotal: { width: '13%' },
  loanColRate: { width: '13%' },
  loanColSecured: { width: '13%' },
  loanColTerm: { width: '12%' },
  loanColMonthly: { width: '13%' },
  // Column widths for repayment table
  repayColDate: { width: '12%' },
  repayColTotal: { width: '15%' },
  repayColPayment: { width: '18%' },
  repayColBalance: { width: '15%' },
  repayColReceipt: { width: '15%' },
  repayColNotes: { width: '25%' },
  // Footer
  footer: {
    marginTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#CCCCCC',
    paddingTop: 10,
  },
  footerText: {
    fontSize: 7,
    color: '#666666',
    textAlign: 'center',
    marginBottom: 6,
  },
});

// Interfaces for the data structure
export interface LampiranABorrower {
  fullName: string;
  icNumber?: string;
  idNumber?: string;
  nationality?: string;
  employmentStatus?: string;
  monthlyIncome?: string;
  employerName?: string;
  address: string;
  // Demographics
  race?: string;
  gender?: string;
  occupation?: string;
}

export interface LampiranALoan {
  disbursedAt: string;
  principalAmount: number;
  totalInterest: number;
  totalAmount: number;
  interestRateMonthly: number;
  isSecured: boolean;
  term: number;
  monthlyPayment: number;
}

export interface LampiranARepayment {
  date: string;
  totalAmount: number;
  paymentAmount: number;
  balanceAfter: number;
  receiptNumber?: string;
  status: number; // 1-4 based on catatan codes
}

export interface LampiranACollateral {
  type?: string;
  estimatedValue?: number;
}

export interface LampiranACompany {
  name: string;
  address: string;
  regNo?: string;
  licenseNo?: string;
}

export interface LampiranAData {
  borrower: LampiranABorrower;
  loan: LampiranALoan;
  repayments: LampiranARepayment[];
  collateral?: LampiranACollateral;
  company: LampiranACompany;
  generatedAt: string;
  loanStatus: string;
}

// Helper functions
const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-MY', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
};

const formatDate = (dateString: string): string => {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleDateString('en-MY', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};

/**
 * Get Pekerjaan (Occupation/Job title) - e.g., Manager, Salesman
 * If not provided, return "Tiada Maklumat"
 */
const getPekerjaan = (occupation?: string): string => {
  return occupation || 'Tiada Maklumat';
};

/**
 * Get Bangsa (Race) for Lampiran A
 */
const getBangsa = (race?: string): string => {
  if (!race) return '-';
  const r = race.toUpperCase();
  if (r.includes('MALAY') || r === 'MELAYU') return 'Melayu';
  if (r.includes('CHINESE') || r === 'CINA') return 'Cina';
  if (r.includes('INDIAN') || r === 'INDIA') return 'India';
  if (r.includes('SABAH') || r.includes('SARAWAK') || r.includes('BUMIPUTRA') || r.includes('KADAZAN') || r.includes('IBAN') || r.includes('BIDAYUH')) return 'Bumiputra (Sabah/Sarawak)';
  if (r.includes('OTHER') || r.includes('LAIN')) return 'Lain-lain';
  return race; // Return as-is if already in BM or unknown
};

/**
 * Get Majikan (Employer type) for Lampiran A
 * Valid values: Kerajaan, Swasta, Berniaga, Kerja Sendiri, Tidak Bekerja
 */
const getMajikan = (employmentStatus?: string): string => {
  if (!employmentStatus) return 'Tiada Maklumat';
  const status = employmentStatus.toUpperCase();
  // Check UNEMPLOYED first before EMPLOYED (since UNEMPLOYED contains EMPLOYED)
  // Student, Retired, Unemployed, Not Working all fall under Tidak Bekerja
  if (status.includes('UNEMPLOYED') || status.includes('NOT WORKING') || status.includes('TIDAK BEKERJA') || 
      status.includes('STUDENT') || status.includes('PELAJAR') || status.includes('RETIRED') || status.includes('PENCEN')) {
    return 'Tidak Bekerja';
  }
  if (status.includes('GOVERNMENT') || status.includes('KERAJAAN')) return 'Kerajaan';
  if (status.includes('PRIVATE') || status.includes('SWASTA') || status.includes('EMPLOYED')) return 'Swasta';
  if (status.includes('BUSINESS') || status.includes('BERNIAGA')) return 'Berniaga';
  if (status.includes('SELF') || status.includes('FREELANCE') || status.includes('SENDIRI')) return 'Kerja Sendiri';
  return 'Tiada Maklumat';
};

const getStatusNote = (status: number): string => {
  switch (status) {
    case 1: return '1. Pinjaman Selesai';
    case 2: return '2. Pinjaman Semasa';
    case 3: return '3. Dalam Proses Dapat Balik';
    case 4: return '4. Dalam Tindakan Mahkamah';
    default: return '2. Pinjaman Semasa';
  }
};

// Main document component
const LampiranADocument: React.FC<{ data: LampiranAData }> = ({ data }) => {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Top right label */}
        <Text style={styles.topRightLabel}>Lampiran A</Text>

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>AKTA PEMBERI PINJAM WANG 1951</Text>
          <Text style={styles.headerSubtitle}>[Subseksyen 18(1)]</Text>
          <Text style={[styles.headerTitle, { marginTop: 8 }]}>LEJAR AKAUN PEMINJAM</Text>
        </View>

        {/* Section 1: Borrower Details */}
        <Text style={styles.sectionTitle}>
          <Text style={styles.sectionNumber}>1. </Text>BUTIRAN PEMINJAM
        </Text>
        <View style={styles.borrowerTable}>
          {/* Name */}
          <View style={styles.borrowerRow}>
            <Text style={styles.borrowerLabel}>Nama</Text>
            <Text style={styles.borrowerValue}>{data.borrower.fullName || '-'}</Text>
          </View>
          
          {/* Individual details */}
          <View style={styles.borrowerRow}>
            <Text style={styles.borrowerLabel}>Jika Individu</Text>
            <View style={styles.borrowerSubRow}>
              <Text style={styles.borrowerSubLabel}>No. K/P:</Text>
              <Text style={styles.borrowerSubValue}>
                {data.borrower.icNumber || data.borrower.idNumber || '-'}
              </Text>
            </View>
          </View>
          <View style={styles.borrowerRow}>
            <Text style={styles.borrowerLabel}></Text>
            <View style={styles.borrowerSubRow}>
              <Text style={styles.borrowerSubLabel}>Bangsa:</Text>
              <Text style={styles.borrowerSubValue}>{getBangsa(data.borrower.race) || data.borrower.nationality || '-'}</Text>
            </View>
          </View>
          <View style={styles.borrowerRow}>
            <Text style={styles.borrowerLabel}></Text>
            <View style={styles.borrowerSubRow}>
              <Text style={styles.borrowerSubLabel}>Pekerjaan:</Text>
              <Text style={styles.borrowerSubValue}>{getPekerjaan(data.borrower.occupation)}</Text>
            </View>
          </View>
          <View style={styles.borrowerRow}>
            <Text style={styles.borrowerLabel}></Text>
            <View style={styles.borrowerSubRow}>
              <Text style={styles.borrowerSubLabel}>Pendapatan:</Text>
              <Text style={styles.borrowerSubValue}>
                {data.borrower.monthlyIncome ? `RM ${data.borrower.monthlyIncome}` : '-'}
              </Text>
            </View>
          </View>
          <View style={styles.borrowerRow}>
            <Text style={styles.borrowerLabel}></Text>
            <View style={styles.borrowerSubRow}>
              <Text style={styles.borrowerSubLabel}>Majikan:</Text>
              <Text style={styles.borrowerSubValue}>
                {getMajikan(data.borrower.employmentStatus)}
              </Text>
            </View>
          </View>
          <View style={styles.borrowerRow}>
            <Text style={styles.borrowerLabel}></Text>
            <View style={styles.borrowerSubRow}>
              <Text style={styles.borrowerSubLabel}>Alamat Rumah:</Text>
              <Text style={styles.borrowerSubValue}>{data.borrower.address || '-'}</Text>
            </View>
          </View>

          {/* Collateral */}
          <View style={styles.borrowerRow}>
            <Text style={styles.borrowerLabel}>Jenis Cagaran (Jika Berkaitan)</Text>
            <Text style={styles.borrowerValue}>{data.collateral?.type || 'Tidak Bercagar'}</Text>
          </View>
          <View style={styles.borrowerRowLast}>
            <Text style={styles.borrowerLabel}>Anggaran Nilai Semasa (RM)</Text>
            <Text style={styles.borrowerValue}>
              {data.collateral?.estimatedValue ? formatCurrency(data.collateral.estimatedValue) : '-'}
            </Text>
          </View>
        </View>

        {/* Section 2: Loan Details */}
        <Text style={styles.sectionTitle}>
          <Text style={styles.sectionNumber}>2. </Text>BUTIRAN PINJAMAN
        </Text>
        <View style={styles.loanTable}>
          {/* Header row */}
          <View style={styles.loanHeaderRow}>
            <Text style={[styles.loanHeaderCell, styles.loanColDate]}>Tarikh</Text>
            <Text style={[styles.loanHeaderCell, styles.loanColPrincipal]}>Pinjaman Pokok (RM)</Text>
            <Text style={[styles.loanHeaderCell, styles.loanColInterest]}>Jumlah Faedah (RM)</Text>
            <Text style={[styles.loanHeaderCell, styles.loanColTotal]}>Jumlah Besar (RM)</Text>
            <Text style={[styles.loanHeaderCell, styles.loanColRate]}>Kadar Faedah (Sebulan)</Text>
            <Text style={[styles.loanHeaderCell, styles.loanColSecured]}>Bercagar/ Tidak Bercagar</Text>
            <Text style={[styles.loanHeaderCell, styles.loanColTerm]}>Tempoh Bayaran (Bulan)</Text>
            <Text style={[styles.loanHeaderCellLast, styles.loanColMonthly]}>Bayaran Sebulan (RM)</Text>
          </View>
          {/* Data row */}
          <View style={styles.loanDataRowLast}>
            <Text style={[styles.loanCell, styles.loanColDate]}>{formatDate(data.loan.disbursedAt)}</Text>
            <Text style={[styles.loanCell, styles.loanColPrincipal]}>{formatCurrency(data.loan.principalAmount)}</Text>
            <Text style={[styles.loanCell, styles.loanColInterest]}>{formatCurrency(data.loan.totalInterest)}</Text>
            <Text style={[styles.loanCell, styles.loanColTotal]}>{formatCurrency(data.loan.totalAmount)}</Text>
            <Text style={[styles.loanCell, styles.loanColRate]}>{data.loan.interestRateMonthly.toFixed(2)}%</Text>
            <Text style={[styles.loanCell, styles.loanColSecured]}>{data.loan.isSecured ? 'Bercagar' : 'Tidak Bercagar'}</Text>
            <Text style={[styles.loanCell, styles.loanColTerm]}>{data.loan.term}</Text>
            <Text style={[styles.loanCellLast, styles.loanColMonthly]}>{formatCurrency(data.loan.monthlyPayment)}</Text>
          </View>
        </View>

        {/* Section 3: Repayment Details */}
        <Text style={styles.sectionTitle}>
          <Text style={styles.sectionNumber}>3. </Text>BUTIRAN BAYARAN BALIK
        </Text>
        <View style={styles.repaymentTable}>
          {/* Header row with Catatan legend embedded in header */}
          <View style={styles.repaymentHeaderRow}>
            <Text style={[styles.repaymentHeaderCell, styles.repayColDate]}>Tarikh</Text>
            <Text style={[styles.repaymentHeaderCell, styles.repayColTotal]}>Jumlah Besar (RM)</Text>
            <Text style={[styles.repaymentHeaderCell, styles.repayColPayment]}>Bayaran Balik Pinjaman (RM)</Text>
            <Text style={[styles.repaymentHeaderCell, styles.repayColBalance]}>Baki Pinjaman (RM)</Text>
            <Text style={[styles.repaymentHeaderCell, styles.repayColReceipt]}>No. Resit</Text>
            <View style={[styles.repaymentHeaderCellLast, styles.repayColNotes, { flexDirection: 'column', alignItems: 'flex-start' }]}>
              <Text style={{ fontWeight: 'bold', fontSize: 7, marginBottom: 2 }}>Catatan:</Text>
              <Text style={{ fontSize: 6 }}>1. Pinjaman Selesai</Text>
              <Text style={{ fontSize: 6 }}>2. Pinjaman Semasa</Text>
              <Text style={{ fontSize: 6 }}>3. Dalam Proses Dapat Balik</Text>
              <Text style={{ fontSize: 6 }}>4. Dalam Tindakan Mahkamah</Text>
            </View>
          </View>
          {/* Data rows */}
          {data.repayments.length > 0 ? (
            data.repayments.map((repayment, index) => (
              <View 
                key={index} 
                style={index === data.repayments.length - 1 ? styles.repaymentDataRowLast : styles.repaymentDataRow}
              >
                <Text style={[styles.repaymentCell, styles.repayColDate]}>{formatDate(repayment.date)}</Text>
                <Text style={[styles.repaymentCell, styles.repayColTotal]}>{formatCurrency(repayment.totalAmount)}</Text>
                <Text style={[styles.repaymentCell, styles.repayColPayment]}>{formatCurrency(repayment.paymentAmount)}</Text>
                <Text style={[styles.repaymentCell, styles.repayColBalance]}>{formatCurrency(repayment.balanceAfter)}</Text>
                <Text style={[styles.repaymentCell, styles.repayColReceipt]}>{repayment.receiptNumber || '-'}</Text>
                <Text style={[styles.repaymentCellLast, styles.repayColNotes]}>{getStatusNote(repayment.status)}</Text>
              </View>
            ))
          ) : (
            <View style={styles.repaymentDataRowLast}>
              <Text style={[styles.repaymentCell, styles.repayColDate]}>-</Text>
              <Text style={[styles.repaymentCell, styles.repayColTotal]}>-</Text>
              <Text style={[styles.repaymentCell, styles.repayColPayment]}>-</Text>
              <Text style={[styles.repaymentCell, styles.repayColBalance]}>-</Text>
              <Text style={[styles.repaymentCell, styles.repayColReceipt]}>-</Text>
              <Text style={[styles.repaymentCellLast, styles.repayColNotes]}>-</Text>
            </View>
          )}
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Dokumen ini dijana secara automatik pada {formatDate(data.generatedAt)} untuk tujuan pematuhan Akta Pemberi Pinjam Wang 1951 [Subseksyen 18(1)]
          </Text>
        </View>
      </Page>
    </Document>
  );
};

export default LampiranADocument;
