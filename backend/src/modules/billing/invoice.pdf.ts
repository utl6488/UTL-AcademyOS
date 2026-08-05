import PDFDocument from 'pdfkit';

interface InvoiceInput {
  invoiceId: string;
  createdAt: Date;
  paidAt: Date | null;
  status: string;
  amountCents: number;
  currency: string;
  gstNumber: string | null;
  gstRateBps: number | null;
  periodStart: Date | null;
  periodEnd: Date | null;
  tenant: { name: string; address: string | null; email: string | null; gstNumber?: string | null };
  plan: { name: string; interval: string };
}

/**
 * Render an invoice to PDF and resolve with the full byte buffer. Streams
 * internally so peak memory stays bounded — the final concat is unavoidable
 * because we return a Buffer to callers (S3 upload / HTTP body).
 */
export function renderInvoicePdf(input: InvoiceInput): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const amount = input.amountCents / 100;
    const gstRate = input.gstRateBps ? input.gstRateBps / 100 : 0;
    const gstAmount = gstRate > 0 ? (amount * gstRate) / (100 + gstRate) : 0;
    const netAmount = amount - gstAmount;

    // Header
    doc.fontSize(22).text('INVOICE', { align: 'right' });
    doc
      .fontSize(10)
      .fillColor('#666')
      .text(`#${input.invoiceId}`, { align: 'right' })
      .text(fmtDate(input.createdAt), { align: 'right' })
      .moveDown();

    doc.fillColor('#000').fontSize(16).text('UTL ExamPro', 50, 50);
    doc.fontSize(9).fillColor('#666').text('utl.academy', 50, 72);

    doc.moveDown(3);

    // Bill To
    doc.fillColor('#000').fontSize(11).text('Bill To:', 50, doc.y);
    doc
      .fontSize(10)
      .fillColor('#333')
      .text(input.tenant.name)
      .text(input.tenant.address ?? '')
      .text(input.tenant.email ?? '');
    if (input.tenant.gstNumber) doc.text(`GSTIN: ${input.tenant.gstNumber}`);
    doc.moveDown();

    // Period & status
    doc
      .fontSize(10)
      .fillColor('#000')
      .text(`Status: ${input.status.toUpperCase()}`)
      .text(`Plan: ${input.plan.name} (${input.plan.interval.toLowerCase()})`);
    if (input.periodStart && input.periodEnd) {
      doc.text(`Period: ${fmtDate(input.periodStart)} – ${fmtDate(input.periodEnd)}`);
    }
    if (input.paidAt) doc.text(`Paid: ${fmtDate(input.paidAt)}`);
    doc.moveDown();

    // Line-item table (single line — sub only)
    const tableTop = doc.y + 10;
    doc.rect(50, tableTop, 500, 24).fill('#f4f4f5');
    doc
      .fillColor('#111')
      .fontSize(10)
      .text('Description', 60, tableTop + 7)
      .text('Amount', 460, tableTop + 7, { width: 80, align: 'right' });
    const rowY = tableTop + 30;
    doc
      .fillColor('#333')
      .fontSize(10)
      .text(`${input.plan.name} subscription`, 60, rowY)
      .text(fmtCurrency(netAmount, input.currency), 460, rowY, { width: 80, align: 'right' });

    // Totals
    let y = rowY + 40;
    if (gstRate > 0) {
      doc
        .text(`GST @ ${gstRate}%`, 350, y, { width: 100, align: 'right' })
        .text(fmtCurrency(gstAmount, input.currency), 460, y, { width: 80, align: 'right' });
      y += 18;
    }
    doc
      .fontSize(12)
      .fillColor('#000')
      .text('Total', 350, y, { width: 100, align: 'right' })
      .text(fmtCurrency(amount, input.currency), 460, y, { width: 80, align: 'right' });

    // Footer
    doc
      .fontSize(8)
      .fillColor('#666')
      .text('Thank you for your business. Contact billing@utl.academy for any queries.', 50, 760, {
        align: 'center',
        width: 500,
      });

    doc.end();
  });
}

function fmtDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function fmtCurrency(amount: number, currency: string): string {
  const symbol = currency === 'INR' ? '₹' : currency === 'USD' ? '$' : `${currency} `;
  return `${symbol}${amount.toFixed(2)}`;
}
