import { StyleSheet } from '@react-pdf/renderer';

export const pdfStyles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    fontFamily: 'Helvetica',
    color: '#1A1A1A',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 30,
  },
  companyName: {
    fontSize: 16,
    fontFamily: 'Helvetica-Bold',
    color: '#1B4D3E',
  },
  companyInfo: {
    fontSize: 9,
    color: '#6B6B6B',
    lineHeight: 1.5,
  },
  documentTitle: {
    fontSize: 20,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 5,
  },
  documentNumber: {
    fontSize: 12,
    color: '#6B6B6B',
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 8,
    color: '#1B4D3E',
  },
  clientBox: {
    marginBottom: 25,
    padding: 12,
    backgroundColor: '#F8F7F4',
    borderRadius: 4,
  },
  clientName: {
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 3,
  },
  clientInfo: {
    fontSize: 9,
    color: '#6B6B6B',
    lineHeight: 1.5,
  },
  table: {
    marginBottom: 25,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#1B4D3E',
    color: '#FFFFFF',
    padding: 8,
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
  },
  tableRow: {
    flexDirection: 'row',
    padding: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E2DC',
    fontSize: 9,
  },
  colDescription: { flex: 3 },
  colQty: { flex: 1, textAlign: 'center' },
  colUnit: { flex: 1, textAlign: 'right' },
  colTotal: { flex: 1, textAlign: 'right' },
  totalsBox: {
    alignSelf: 'flex-end',
    width: 200,
    marginBottom: 30,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
    fontSize: 10,
  },
  totalRowBold: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    fontSize: 13,
    fontFamily: 'Helvetica-Bold',
    borderTopWidth: 2,
    borderTopColor: '#1B4D3E',
    marginTop: 4,
  },
  legal: {
    marginTop: 'auto',
    fontSize: 8,
    color: '#6B6B6B',
    lineHeight: 1.5,
    borderTopWidth: 1,
    borderTopColor: '#E5E2DC',
    paddingTop: 10,
  },
  date: {
    fontSize: 9,
    color: '#6B6B6B',
    marginBottom: 20,
  },
});
