import React from 'react';
import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer';

// Define styles for the PDF
const styles = StyleSheet.create({
  page: {
    flexDirection: 'column',
    backgroundColor: '#FFFFFF',
    padding: 20,
    fontFamily: 'Helvetica',
    fontSize: 10,
  },
  header: {
    flexDirection: 'row',
    marginBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#7C3AED',
    paddingBottom: 8,
  },
  logo: {
    width: 40,
    height: 40,
    marginRight: 10,
  },
  companyInfo: {
    flex: 1,
  },
  companyName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#7C3AED',
    marginBottom: 3,
  },
  companyAddress: {
    fontSize: 9,
    color: '#666666',
    marginBottom: 1,
  },
  receiptTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 12,
    color: '#1F2937',
  },
  receiptInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
    backgroundColor: '#F9FAFB',
    padding: 10,
    borderRadius: 4,
  },
  receiptInfoColumn: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 8,
    color: '#6B7280',
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 5,
  },
  customerSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#374151',
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    paddingBottom: 5,
  },
  customerInfo: {
    backgroundColor: '#F9FAFB',
    padding: 15,
    borderRadius: 5,
  },
  customerRow: {
    flexDirection: 'row',
    marginBottom: 5,
  },
  customerLabel: {
    fontSize: 10,
    color: '#6B7280',
    width: 100,
  },
  customerValue: {
    fontSize: 10,
    color: '#1F2937',
    flex: 1,
  },
  paymentSection: {
    marginBottom: 20,
  },
  paymentDetails: {
    backgroundColor: '#F9FAFB',
    padding: 15,
    borderRadius: 5,
  },
  paymentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  paymentLabel: {
    fontSize: 10,
    color: '#6B7280',
  },
  paymentValue: {
    fontSize: 10,
    color: '#1F2937',
    fontWeight: 'bold',
  },
  paymentTable: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 5,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    padding: 10,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    padding: 10,
  },
  tableCell: {
    flex: 1,
    fontSize: 10,
  },
  tableCellHeader: {
    flex: 1,
    fontSize: 10,
    fontWeight: 'bold',
    color: '#374151',
  },
  tableCellRight: {
    flex: 1,
    fontSize: 10,
    textAlign: 'right',
  },
  tableCellHeaderRight: {
    flex: 1,
    fontSize: 10,
    fontWeight: 'bold',
    color: '#374151',
    textAlign: 'right',
  },
  totalSection: {
    marginTop: 10,
    alignItems: 'flex-end',
  },
  totalRow: {
    flexDirection: 'row',
    marginBottom: 5,
    width: 200,
    borderTopWidth: 1,
    borderTopColor: '#7C3AED',
    paddingTop: 5,
    marginTop: 5,
  },
  totalLabel: {
    fontSize: 12,
    color: '#374151',
    flex: 1,
    fontWeight: 'bold',
  },
  totalValue: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#1F2937',
    textAlign: 'right',
    width: 80,
  },
  grandTotalRow: {
    flexDirection: 'row',
    borderTopWidth: 2,
    borderTopColor: '#7C3AED',
    paddingTop: 5,
    marginTop: 5,
    width: 200,
  },
  grandTotalLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#7C3AED',
    flex: 1,
  },
  grandTotalValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#7C3AED',
    textAlign: 'right',
    width: 80,
  },
  footer: {
    marginTop: 30,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingTop: 15,
  },
  footerNote: {
    fontSize: 9,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 10,
  },
  thankYou: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#7C3AED',
    textAlign: 'center',
    marginBottom: 10,
  },
  contactInfo: {
    fontSize: 8,
    color: '#9CA3AF',
    textAlign: 'center',
  },
});

interface ReceiptData {
  receiptNumber: string;
  generatedAt: string;
  customer: {
    id: string;
    name: string;
    email: string;
    phone: string;
  };
  loan: {
    id: string;
    principalAmount: number;
    interestRate: number;
    term: number;
  };
  payment: {
    installmentNumber?: number;
    dueDate: string;
    principalAmount: number;
    interestAmount: number;
    lateFeeAmount: number;
    lateFeesPaid: number;
    totalAmount: number;
    paidAmount: number;
    paymentDate: string;
    paymentMethod?: string;
    reference?: string;
    isLate?: boolean;
  };
  transaction: {
    processedAt?: string;
    createdAt: string;
  };
  company: {
    name: string;
    address: string;
    regNo?: string;
    phone?: string;
    email?: string;
    footerNote?: string;
    taxLabel: string;
    logoPath?: string;
  };
}

const PaymentReceiptDocument: React.FC<{ data: ReceiptData }> = ({ data }) => {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-MY', {
      style: 'currency',
      currency: 'MYR',
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-MY', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-MY', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
      timeZone: 'Asia/Kuala_Lumpur',
    });
  };

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          {data.company.logoPath && (
            <Image style={styles.logo} src={data.company.logoPath} />
          )}
          <View style={styles.companyInfo}>
            <Text style={styles.companyName}>{data.company.name}</Text>
            <Text style={styles.companyAddress}>{data.company.address}</Text>
            {data.company.regNo && (
              <Text style={styles.companyAddress}>
                Registration No: {data.company.regNo}
              </Text>
            )}
            {data.company.phone && (
              <Text style={styles.companyAddress}>
                Phone: {data.company.phone}
              </Text>
            )}
            {data.company.email && (
              <Text style={styles.companyAddress}>
                Email: {data.company.email}
              </Text>
            )}
          </View>
        </View>

        {/* Receipt Title */}
        <Text style={styles.receiptTitle}>PAYMENT RECEIPT</Text>

        {/* Receipt Information */}
        <View style={styles.receiptInfo}>
          <View style={styles.receiptInfoColumn}>
            <Text style={styles.infoLabel}>Receipt Number</Text>
            <Text style={styles.infoValue}>{data.receiptNumber}</Text>
            <Text style={styles.infoLabel}>Receipt Date</Text>
            <Text style={styles.infoValue}>{formatDate(data.generatedAt)}</Text>
          </View>
          <View style={styles.receiptInfoColumn}>
            <Text style={styles.infoLabel}>Loan ID</Text>
            <Text style={styles.infoValue}>{data.loan.id.substring(0, 8)}</Text>
          </View>
        </View>

        {/* Customer Information */}
        <View style={styles.customerSection}>
          <Text style={styles.sectionTitle}>Customer Information</Text>
          <View style={styles.customerInfo}>
            <View style={styles.customerRow}>
              <Text style={styles.customerLabel}>Name:</Text>
              <Text style={styles.customerValue}>{data.customer.name}</Text>
            </View>
            <View style={styles.customerRow}>
              <Text style={styles.customerLabel}>Email:</Text>
              <Text style={styles.customerValue}>{data.customer.email}</Text>
            </View>
            <View style={styles.customerRow}>
              <Text style={styles.customerLabel}>Phone:</Text>
              <Text style={styles.customerValue}>{data.customer.phone}</Text>
            </View>
          </View>
        </View>

        {/* Payment Details */}
        <View style={styles.paymentSection}>
          <Text style={styles.sectionTitle}>
            Payment Details{data.payment.isLate ? ' (LATE PAYMENT)' : ''}
          </Text>
          <View style={styles.paymentDetails}>
            {data.payment.installmentNumber && (
              <View style={styles.paymentRow}>
                <Text style={styles.paymentLabel}>
                  Installment {data.payment.installmentNumber} / {data.loan.term}
                </Text>
                <Text style={styles.paymentValue}>
                  Due: {formatDate(data.payment.dueDate)}
                </Text>
              </View>
            )}
            
            {data.payment.paymentMethod && (
              <View style={styles.paymentRow}>
                <Text style={styles.paymentLabel}>Payment Method:</Text>
                <Text style={styles.paymentValue}>{data.payment.paymentMethod}</Text>
              </View>
            )}
            
            {data.payment.reference && (
              <View style={styles.paymentRow}>
                <Text style={styles.paymentLabel}>Reference:</Text>
                <Text style={styles.paymentValue}>{data.payment.reference}</Text>
              </View>
            )}

            {/* Payment Breakdown */}
            <View style={styles.paymentRow}>
              <Text style={styles.paymentLabel}>Loan Payment:</Text>
              <Text style={styles.paymentValue}>
                {formatCurrency(data.payment.paidAmount - data.payment.lateFeesPaid)}
              </Text>
            </View>

            <View style={styles.paymentRow}>
              <Text style={styles.paymentLabel}>Late Fees:</Text>
              <Text style={styles.paymentValue}>
                {formatCurrency(data.payment.lateFeesPaid)}
              </Text>
            </View>

            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total Amount Paid</Text>
              <Text style={styles.totalValue}>
                {formatCurrency(data.payment.paidAmount)}
              </Text>
            </View>

            {/* Transaction Timestamps - More subtle with extra spacing */}
            <View style={{...styles.paymentRow, marginTop: 15}}>
              <Text style={{...styles.paymentLabel, fontSize: 9, color: '#9CA3AF'}}>Payment Date:</Text>
              <Text style={{...styles.paymentValue, fontSize: 9, color: '#6B7280'}}>
                {formatDateTime(data.transaction.createdAt)}
              </Text>
            </View>

            {data.transaction.processedAt && (
              <View style={styles.paymentRow}>
                <Text style={{...styles.paymentLabel, fontSize: 9, color: '#9CA3AF'}}>Payment Processed:</Text>
                <Text style={{...styles.paymentValue, fontSize: 9, color: '#6B7280'}}>
                  {formatDateTime(data.transaction.processedAt)}
                </Text>
              </View>
            )}
          </View>
        </View>



        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.thankYou}>Thank you for your payment!</Text>
          
          {data.company.footerNote && (
            <Text style={styles.footerNote}>{data.company.footerNote}</Text>
          )}
          
          <Text style={styles.contactInfo}>
            This is a computer-generated receipt and does not require a signature.
          </Text>
          
          {(data.company.phone || data.company.email) && (
            <Text style={styles.contactInfo}>
              For inquiries, please contact us at{' '}
              {data.company.phone && `${data.company.phone}`}
              {data.company.phone && data.company.email && ' or '}
              {data.company.email && `${data.company.email}`}
            </Text>
          )}
        </View>
      </Page>
    </Document>
  );
};

export default PaymentReceiptDocument;
export type { ReceiptData };
