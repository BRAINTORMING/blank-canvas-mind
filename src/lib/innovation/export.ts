import { utils, writeFile } from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export interface Sheet {
  name: string;
  rows: Array<Record<string, unknown>>;
}

export function exportExcel(filename: string, sheets: Sheet[]) {
  const wb = utils.book_new();
  for (const s of sheets) {
    const ws = utils.json_to_sheet(s.rows);
    utils.book_append_sheet(wb, ws, s.name.slice(0, 31));
  }
  writeFile(wb, `${filename}.xlsx`);
}

export interface PdfSection {
  title: string;
  head: string[];
  body: Array<Array<string | number>>;
}

export function exportPdf(filename: string, title: string, sections: PdfSection[]) {
  const doc = new jsPDF({ orientation: "landscape" });
  doc.setFontSize(16);
  doc.text(title, 14, 16);
  doc.setFontSize(10);
  doc.text(new Date().toLocaleString(), 14, 22);
  let y = 28;
  for (const s of sections) {
    doc.setFontSize(12);
    doc.text(s.title, 14, y);
    autoTable(doc, {
      startY: y + 2,
      head: [s.head],
      body: s.body,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [64, 174, 248] },
    });
    // @ts-expect-error – autoTable adds lastAutoTable
    y = (doc.lastAutoTable?.finalY ?? y + 20) + 8;
    if (y > 180) {
      doc.addPage();
      y = 16;
    }
  }
  doc.save(`${filename}.pdf`);
}
