import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { BidPacketInput, BidPricingInput } from './bids.dto';

const TURF_RATE_PER_SQFT = 0.02;
const BED_RATE_PER_SQFT = 0.05;
const TREE_RATE_PER_COUNT = 15;

export class BidsService {
  calculateMaintenancePriceCents(input: BidPricingInput): number {
    const margin = this.normalizeMargin(input.margin);

    const basePrice =
      input.turfAreaSqft * TURF_RATE_PER_SQFT +
      input.bedAreaSqft * BED_RATE_PER_SQFT +
      input.treeCount * TREE_RATE_PER_COUNT;

    const total = basePrice * (1 + margin);

    return Math.round(total * 100);
  }

  generateBidPacketPdf(input: BidPacketInput): jsPDF {
    const doc = new jsPDF({ unit: 'pt', format: 'letter' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    const pages = input.pages.length > 0 ? input.pages : this.defaultPages();

    pages.forEach((page, index) => {
      if (index > 0) doc.addPage();
      this.renderPageHeader(doc, page.title, input, pageWidth);
      this.renderPageSections(doc, page.sections, pageWidth, pageHeight);
      this.renderFooter(doc, pageWidth, pageHeight, index + 1);
    });

    doc.addPage();
    this.renderPageHeader(doc, 'Pricing Matrix', input, pageWidth);
    this.renderPricingTable(doc, input);
    this.renderFooter(doc, pageWidth, pageHeight, pages.length + 1);

    if (input.notes) {
      doc.addPage();
      this.renderPageHeader(doc, 'Notes', input, pageWidth);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(11);
      doc.text(input.notes, 48, 120, { maxWidth: pageWidth - 96 });
      this.renderFooter(doc, pageWidth, pageHeight, pages.length + 2);
    }

    return doc;
  }

  private renderPageHeader(doc: jsPDF, title: string, input: BidPacketInput, pageWidth: number): void {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text(title, 48, 64);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(`Company: ${input.companyName}`, 48, 86);
    doc.text(`Prepared for: ${input.preparedFor}`, 48, 102);
    doc.text(`Property: ${input.propertyName}`, 48, 118);
    doc.text(`Prepared by: ${input.preparedBy}`, pageWidth - 48, 86, { align: 'right' });
  }

  private renderPageSections(doc: jsPDF, sections: { heading: string; body: string }[], pageWidth: number, pageHeight: number): void {
    let cursorY = 150;
    const maxWidth = pageWidth - 96;

    sections.forEach((section) => {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.text(section.heading, 48, cursorY);
      cursorY += 16;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      const lines = doc.splitTextToSize(section.body, maxWidth);
      doc.text(lines, 48, cursorY);
      cursorY += lines.length * 12 + 18;

      if (cursorY > pageHeight - 80) {
        doc.addPage();
        cursorY = 80;
      }
    });
  }

  private renderPricingTable(doc: jsPDF, input: BidPacketInput): void {
    const pricing = input.pricing;

    autoTable(doc, {
      startY: 140,
      head: [[
        'Metric',
        'Quantity',
        'Rate',
        'Subtotal',
      ]],
      body: [
        ['Turf area (sqft)', pricing.turfAreaSqft.toLocaleString(), `$${TURF_RATE_PER_SQFT.toFixed(2)}`, `$${(pricing.turfAreaSqft * TURF_RATE_PER_SQFT).toFixed(2)}`],
        ['Bed area (sqft)', pricing.bedAreaSqft.toLocaleString(), `$${BED_RATE_PER_SQFT.toFixed(2)}`, `$${(pricing.bedAreaSqft * BED_RATE_PER_SQFT).toFixed(2)}`],
        ['Tree count', pricing.treeCount.toLocaleString(), `$${TREE_RATE_PER_COUNT.toFixed(2)}`, `$${(pricing.treeCount * TREE_RATE_PER_COUNT).toFixed(2)}`],
        ['Margin', `${Math.round(pricing.margin * 100)}%`, '', ''],
        ['Total (monthly)', '', '', `$${(pricing.maintenancePriceCents / 100).toFixed(2)}`],
      ],
      styles: {
        font: 'helvetica',
        fontSize: 10,
      },
      headStyles: {
        fillColor: [30, 30, 30],
        textColor: 255,
      },
    });
  }

  private renderFooter(doc: jsPDF, pageWidth: number, pageHeight: number, pageNumber: number): void {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(`Page ${pageNumber}`, pageWidth - 48, pageHeight - 32, { align: 'right' });
  }

  private normalizeMargin(margin: number): number {
    if (!Number.isFinite(margin)) {
      throw new Error('Margin must be a finite number.');
    }

    if (margin < 0) {
      throw new Error('Margin must be greater than or equal to 0.');
    }

    return margin;
  }

  private defaultPages(): { title: string; sections: { heading: string; body: string }[] }[] {
    return [
      {
        title: 'Company Overview',
        sections: [
          { heading: 'About Us', body: 'Add company background and mission here.' },
          { heading: 'Service Philosophy', body: 'Add service approach and standards here.' },
        ],
      },
      {
        title: 'Scope of Work',
        sections: [
          { heading: 'Maintenance Services', body: 'List included services and frequency.' },
          { heading: 'Quality Assurance', body: 'Describe inspection cadence and reporting.' },
        ],
      },
      {
        title: 'Terms & Conditions',
        sections: [
          { heading: 'Billing', body: 'Define billing cadence and payment terms.' },
          { heading: 'Insurance', body: 'Provide insurance and licensing details.' },
        ],
      },
      {
        title: 'Safety & Compliance',
        sections: [
          { heading: 'Safety Program', body: 'Highlight safety and training practices.' },
          { heading: 'Compliance', body: 'Describe regulatory or site requirements.' },
        ],
      },
      {
        title: 'Experience',
        sections: [
          { heading: 'Portfolio', body: 'Showcase similar properties and references.' },
          { heading: 'Team', body: 'Introduce key team members.' },
        ],
      },
    ];
  }
}
