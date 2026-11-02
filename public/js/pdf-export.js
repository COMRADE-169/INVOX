/**
 * INVOX - PDF Export and Print Engine
 */

const InvoxExporter = {
  /**
   * Download the invoice sheet as high resolution A4 PDF
   */
  async downloadPDF(elementId = 'invoice-preview-sheet', invoiceNumber = 'INV-001') {
    const targetElement = document.getElementById(elementId);
    if (!targetElement) {
      console.error('Invoice sheet element not found');
      return false;
    }

    const safeNumber = (invoiceNumber || 'INV-001').replace(/[^a-zA-Z0-9_-]/g, '_');
    const filename = `INVOX-${safeNumber}.pdf`;

    // Check if html2pdf is available
    if (typeof html2pdf === 'undefined') {
      window.InvoxApp.showToast('PDF library not ready. Printing instead...', 'info');
      window.print();
      return true;
    }

    // Clone element to prevent UI transform / zoom scale affecting the PDF
    const clone = targetElement.cloneNode(true);
    clone.style.transform = 'none';
    clone.style.boxShadow = 'none';
    clone.style.margin = '0 auto';
    clone.style.width = '210mm';
    clone.style.minHeight = '297mm';
    clone.style.maxWidth = '210mm';
    clone.style.background = '#ffffff';

    // Temporary container
    const wrapper = document.createElement('div');
    wrapper.style.position = 'fixed';
    wrapper.style.top = '-99999px';
    wrapper.style.left = '-99999px';
    wrapper.style.width = '210mm';
    wrapper.appendChild(clone);
    document.body.appendChild(wrapper);

    const opt = {
      margin: 0,
      filename: filename,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: {
        scale: 2,
        useCORS: true,
        letterRendering: true,
        logging: false,
        scrollY: 0,
        scrollX: 0
      },
      jsPDF: {
        unit: 'mm',
        format: 'a4',
        orientation: 'portrait'
      },
      pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
    };

    try {
      await html2pdf().set(opt).from(clone).save();
      return true;
    } catch (err) {
      console.error('Error generating PDF:', err);
      throw err;
    } finally {
      if (wrapper.parentNode) {
        wrapper.parentNode.removeChild(wrapper);
      }
    }
  },

  /**
   * Native Browser Print
   */
  print() {
    window.print();
  }
};

window.InvoxExporter = InvoxExporter;
