import React from 'react';
import { Document, Page, Text, View } from '@react-pdf/renderer';
import { pdfStyles as s } from './styles.js';

interface QuotePdfProps {
  number: string;
  date: string;
  company: { name: string; siret: string; address: string | null };
  client: { name: string; email: string | null; address: string | null };
  lines: { description: string; quantity: number; unitPrice: number; total: number }[];
  totalHt: number;
  totalTtc: number;
  tvaRate: number;
}

function formatAmount(cents: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
  }).format(cents / 100);
}

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(iso));
}

export function QuoteTemplate(props: QuotePdfProps) {
  const tvaAmount = props.totalTtc - props.totalHt;

  return (
    <Document>
      <Page size="A4" style={s.page}>
        {/* Header */}
        <View style={s.header}>
          <View>
            <Text style={s.companyName}>{props.company.name}</Text>
            <Text style={s.companyInfo}>SIRET: {props.company.siret}</Text>
            {props.company.address && (
              <Text style={s.companyInfo}>{props.company.address}</Text>
            )}
          </View>
          <View>
            <Text style={s.documentTitle}>DEVIS</Text>
            <Text style={s.documentNumber}>{props.number}</Text>
          </View>
        </View>

        <Text style={s.date}>Date: {formatDate(props.date)}</Text>

        {/* Client */}
        <View style={s.clientBox}>
          <Text style={s.sectionTitle}>Client</Text>
          <Text style={s.clientName}>{props.client.name}</Text>
          {props.client.email && (
            <Text style={s.clientInfo}>{props.client.email}</Text>
          )}
          {props.client.address && (
            <Text style={s.clientInfo}>{props.client.address}</Text>
          )}
        </View>

        {/* Lines table */}
        <View style={s.table}>
          <View style={s.tableHeader}>
            <Text style={s.colDescription}>Description</Text>
            <Text style={s.colQty}>Qté</Text>
            <Text style={s.colUnit}>P.U. HT</Text>
            <Text style={s.colTotal}>Total HT</Text>
          </View>
          {props.lines.map((line, i) => (
            <View key={i} style={s.tableRow}>
              <Text style={s.colDescription}>{line.description}</Text>
              <Text style={s.colQty}>{line.quantity}</Text>
              <Text style={s.colUnit}>{formatAmount(line.unitPrice)}</Text>
              <Text style={s.colTotal}>{formatAmount(line.total)}</Text>
            </View>
          ))}
        </View>

        {/* Totals */}
        <View style={s.totalsBox}>
          <View style={s.totalRow}>
            <Text>Total HT</Text>
            <Text>{formatAmount(props.totalHt)}</Text>
          </View>
          <View style={s.totalRow}>
            <Text>TVA ({props.tvaRate}%)</Text>
            <Text>{formatAmount(tvaAmount)}</Text>
          </View>
          <View style={s.totalRowBold}>
            <Text>Total TTC</Text>
            <Text>{formatAmount(props.totalTtc)}</Text>
          </View>
        </View>

        {/* Legal */}
        <Text style={s.legal}>
          Devis valable 30 jours. Conditions de paiement selon accord.
        </Text>
      </Page>
    </Document>
  );
}
