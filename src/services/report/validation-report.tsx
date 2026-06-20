import { Document, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import type { ValidationRun } from "@/domain/validation";
import { statusCopy, validationTypeCopy } from "@/lib/validation-copy";

const styles = StyleSheet.create({
  page: { padding: 32, fontSize: 9, color: "#18212f", fontFamily: "Helvetica" },
  header: { marginBottom: 18, borderBottom: "1px solid #CBD5E1", paddingBottom: 12 },
  brand: { fontSize: 18, fontWeight: 700, marginBottom: 4 },
  subtitle: { color: "#475569" },
  summary: { flexDirection: "row", gap: 8, marginBottom: 16 },
  summaryCard: { flexGrow: 1, border: "1px solid #CBD5E1", padding: 8 },
  summaryValue: { fontSize: 14, fontWeight: 700, marginBottom: 3 },
  warning: { marginBottom: 12, padding: 8, backgroundColor: "#FEF3C7", color: "#92400E" },
  row: { flexDirection: "row", borderBottom: "1px solid #E2E8F0", paddingVertical: 6 },
  head: { backgroundColor: "#F1F5F9", fontWeight: 700 },
  field: { width: "23%", paddingRight: 6 },
  value: { width: "24%", paddingRight: 6 },
  status: { width: "17%", paddingRight: 6 },
  confidence: { width: "12%" },
});

export async function renderValidationReport(run: ValidationRun) {
  return renderToBuffer(<ValidationReportDocument run={run} />);
}

function ValidationReportDocument({ run }: { run: ValidationRun }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.brand}>ConferIA</Text>
          <Text style={styles.subtitle}>{validationTypeCopy[run.validationType].title}</Text>
          <Text style={styles.subtitle}>Relatório estático de conferência documental</Text>
        </View>

        {run.usedPdfVisionFallback ? (
          <Text style={styles.warning}>PDF sem texto suficiente. A conferência usou fallback de visão para extração.</Text>
        ) : null}

        <View style={styles.summary}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryValue}>{run.summary.totalChecked}</Text>
            <Text>Total de campos conferidos</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryValue}>{run.summary.divergences}</Text>
            <Text>Total de divergências</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryValue}>{run.summary.reviewRequired}</Text>
            <Text>Total pendente de revisão</Text>
          </View>
        </View>

        <View style={[styles.row, styles.head]}>
          <Text style={styles.field}>Campo</Text>
          <Text style={styles.value}>Origem</Text>
          <Text style={styles.value}>Destino</Text>
          <Text style={styles.status}>Status</Text>
          <Text style={styles.confidence}>Conf.</Text>
        </View>

        {run.results.map((result) => (
          <View key={result.field.id} style={styles.row}>
            <Text style={styles.field}>{result.field.label}</Text>
            <Text style={styles.value}>{result.sourceValue}</Text>
            <Text style={styles.value}>{result.targetValue}</Text>
            <Text style={styles.status}>{statusCopy[result.status]}</Text>
            <Text style={styles.confidence}>{Math.min(result.sourceConfidence, result.targetConfidence)}%</Text>
          </View>
        ))}
      </Page>
    </Document>
  );
}
