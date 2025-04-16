import { jsPDF } from 'jspdf'

export const exportToPDF = (data) => {
  const doc = new jsPDF()
  // ... logika pro generování PDF
  doc.save('doprava-kalkulace.pdf')
}
