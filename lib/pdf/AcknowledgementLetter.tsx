import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'
import type { LetterData } from './letter-data'

const styles = StyleSheet.create({
  page: {
    paddingTop: 64,
    paddingBottom: 64,
    paddingHorizontal: 72,
    fontSize: 11,
    fontFamily: 'Helvetica',
    lineHeight: 1.5,
    color: '#1a1a1a',
  },
  orgHeader: {
    marginBottom: 24,
    textAlign: 'center',
  },
  orgName: {
    fontSize: 16,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 4,
  },
  orgAddress: {
    fontSize: 9,
    color: '#555555',
  },
  date: {
    marginBottom: 18,
  },
  block: {
    marginBottom: 14,
  },
  signature: {
    marginTop: 36,
  },
  footer: {
    position: 'absolute',
    bottom: 36,
    left: 72,
    right: 72,
    fontSize: 8,
    color: '#888888',
    textAlign: 'center',
  },
})

export default function AcknowledgementLetter({ data }: { data: LetterData }) {
  return (
    <Document
      title={`Contribution acknowledgement - ${data.donorName}`}
      author={data.orgLegalName}
    >
      <Page size="LETTER" style={styles.page}>
        <View style={styles.orgHeader}>
          <Text style={styles.orgName}>{data.orgLegalName}</Text>
          {data.orgAddressLines.map((line) => (
            <Text key={line} style={styles.orgAddress}>
              {line}
            </Text>
          ))}
          <Text style={styles.orgAddress}>EIN: {data.ein}</Text>
        </View>

        <Text style={styles.date}>{data.letterDate}</Text>

        <View style={styles.block}>
          <Text>{data.donorName}</Text>
          {data.donorAddressLines.map((line) => (
            <Text key={line}>{line}</Text>
          ))}
        </View>

        <View style={styles.block}>
          <Text>Dear {data.donorName},</Text>
        </View>

        <View style={styles.block}>
          {data.amountFormatted ? (
            <Text>
              On behalf of {data.orgLegalName}, thank you for your generous contribution of{' '}
              {data.amountFormatted}, received on {data.receivedDate}.
            </Text>
          ) : (
            <Text>
              On behalf of {data.orgLegalName}, thank you for your generous non-cash contribution,
              received on {data.receivedDate}, of the following property:{' '}
              {data.nonCashDescription}
            </Text>
          )}
        </View>

        <View style={styles.block}>
          <Text>{data.goodsServicesStatement}</Text>
        </View>

        <View style={styles.block}>
          <Text>{data.deductibilityStatement}</Text>
        </View>

        <View style={styles.block}>
          <Text>{data.closingText}</Text>
        </View>

        <View style={styles.signature}>
          <Text>Sincerely,</Text>
          <Text style={{ marginTop: 24, fontFamily: 'Helvetica-Bold' }}>{data.signatoryName}</Text>
          {data.signatoryTitle ? <Text>{data.signatoryTitle}</Text> : null}
          <Text>{data.orgLegalName}</Text>
        </View>

        <Text style={styles.footer}>
          {data.orgLegalName} · EIN {data.ein}
        </Text>
      </Page>
    </Document>
  )
}
