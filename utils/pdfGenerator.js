// utils/pdfGenerator.js
const PDFDocument = require('pdfkit');

function buildDocumentoPDF(res, data) {
  const {
    numero_interno, tipo, estado,
    propietario, direccion, area_m2,
    fecha_cert, numero_escritura, abogado, poseedor,
    colindancias, orientaciones,
    creado_en, actualizado_en,
    creado_por_nombre, actualizado_por_nombre,
    archivos = []
  } = data || {};

  res.setHeader('Content-Type', 'application/pdf');
  const fname = `doc-${numero_interno || 'sin-num'}.pdf`;
  res.setHeader('Content-Disposition', `attachment; filename="${fname}"`);

  const doc = new PDFDocument({ size: 'LETTER', margin: 56 });
  doc.pipe(res);

  // helpers
  const s = (v) => (v === null || v === undefined || v === '' ? '______' : String(v));
  const fmtNum = (n) => (isFinite(Number(n)) ? Number(n).toFixed(2) : '______');

  // ====== ENCABEZADO ======
  doc.font('Helvetica-Bold').fontSize(16).text('SOLICITUD / CARTA', { align: 'center' });
  doc.moveDown(0.2);
  doc.font('Helvetica').fontSize(9).fillColor('#666').text(`No. Interno: ${s(numero_interno)}   ·   Emitido: ${new Date().toLocaleString()}`, { align: 'center' });
  doc.moveDown(0.8);
  doc.fillColor('#000').fontSize(12);

  // ====== CUERPO (PLANTILLA) ======
  // Ajusta estas líneas para que coincidan exactamente con tu formato oficial.
  doc.font('Helvetica').fontSize(12).text('Señor Director', { align: 'left' });
  doc.moveDown(0.5);
  doc.font('Helvetica-Bold').text('SOLICITO', { align: 'center' });
  doc.moveDown(0.5);
  doc.font('Helvetica').fontSize(12);

  // Párrafos (justificados). Edita texto según tu plantilla exacta:
  const p1 = `Que previa aprobación y revisión se sirva registrar/inscribir el documento de ${tipo === 'certificacion' ? 'CERTIFICACIÓN' : 'ESCRITURA'} correspondiente al inmueble que a continuación se detalla.`;
  const p2 = `Propietario: ${s(propietario)}. Domicilio/Dirección del inmueble: ${s(direccion)}. Área total: ${isFinite(Number(area_m2)) ? fmtNum(area_m2) + ' m²' : 'No especificada'}.`;
  const p3 = tipo === 'certificacion'
    ? `Documento: CERTIFICACIÓN. Fecha de certificación: ${s(fecha_cert)}.`
    : `Documento: ESCRITURA. Número de escritura: ${s(numero_escritura)}. Abogado: ${s(abogado)}. Poseedor: ${s(poseedor)}.`;

  doc.text(p1, { align: 'justify' }).moveDown(0.4);
  doc.text(p2, { align: 'justify' }).moveDown(0.4);
  doc.text(p3, { align: 'justify' }).moveDown(0.8);

  // Colindancias en texto
  doc.font('Helvetica-Bold').text('Colindancias:', { align: 'left' });
  doc.font('Helvetica');
  if (colindancias && typeof colindancias === 'object' && Object.keys(colindancias).length) {
    const order = ['N','S','E','O'];
    const lines = [];
    order.forEach(k => { if (colindancias[k]) lines.push(`${k}: ${colindancias[k]}`); });
    Object.keys(colindancias).forEach(k => { if (!order.includes(k)) lines.push(`${k}: ${colindancias[k]}`); });
    doc.text(lines.join(' · '), { align: 'justify' });
  } else {
    doc.text('—', { align: 'left' });
  }
  doc.moveDown(0.6);

  // Orientaciones en texto/tabla simple
  doc.font('Helvetica-Bold').text('Orientaciones (rumbo / medida / colindante):', { align: 'left' });
  doc.font('Helvetica');
  const rows = Array.isArray(orientaciones) ? orientaciones : [];
  if (rows.length) {
    // tabla simple
    drawTable(doc, {
      headers: ['Rumbo', 'Medida (m)', 'Colindante'],
      rows: rows.map(r => [s(r.rumbo), isFinite(Number(r.medida)) ? fmtNum(r.medida) : '______', s(r.colindante)]),
      widths: [120, 120, 260]
    });
  } else {
    doc.text('—', { align: 'left' });
  }
  doc.moveDown(0.8);

  // Cierre de carta (ajusta texto exacto si tu formato lo exige)
  const p4 = `Por lo anterior, atentamente solicito se proceda conforme a derecho.`;
  doc.text(p4, { align: 'justify' });
  doc.moveDown(2);

  // Firma
  doc.text('Atentamente,', { align: 'left' });
  doc.moveDown(2.2);
  doc.font('Helvetica-Bold').text(s(propietario), { align: 'left' });
  doc.font('Helvetica').text('Firma del solicitante', { align: 'left' });
  doc.moveDown(1.2);

  // ====== ANEXO (OPCIONAL): RESUMEN TÉCNICO / AUDITORÍA ======
  doc.font('Helvetica-Bold').fontSize(12).text('Resumen de registro', { underline: true }).moveDown(0.5);
  doc.font('Helvetica').fontSize(10);
  doc.text(`Estado: ${s(estado)}`);
  doc.text(`Creado por: ${s(creado_por_nombre)} · ${s(creado_en)}`);
  doc.text(`Actualizado por: ${s(actualizado_por_nombre)} · ${s(actualizado_en)}`);
  doc.moveDown(0.6);

  if (Array.isArray(archivos)) {
    doc.font('Helvetica-Bold').text('Archivos adjuntos:');
    doc.font('Helvetica');
    if (archivos.length) {
      archivos.forEach((f, i) => {
        doc.text(`• [${i + 1}] ${basename(f.url)} · ${s(f.tipo_mime)} · ${s(f.descripcion)}`);
      });
    } else {
      doc.text('—');
    }
  }

  // Footer
  const addFooter = () => {
    const { page } = doc;
    doc.fontSize(8).fillColor('#666').text(`Página ${page.number}`, 56, page.height - 36, {
      align: 'center',
      width: page.width - 112
    });
  };
  addFooter();
  doc.on('pageAdded', addFooter);

  doc.end();
}

// ============ helpers tabla/otros ============
function drawTable(doc, { headers = [], rows = [], widths = [] }) {
  const startX = doc.x;
  let y = doc.y;
  const lineH = 18;

  doc.font('Helvetica-Bold').fontSize(10).fillColor('#111');
  headers.forEach((h, i) => {
    doc.text(h, startX + sum(widths, i), y, { width: widths[i], continued: i < headers.length - 1 });
  });
  doc.text('', { continued: false });
  y += lineH;
  drawLine(doc, startX, y - 4, sum(widths, widths.length), '#bbb');

  doc.font('Helvetica').fontSize(10).fillColor('#222');
  rows.forEach((row) => {
    if (y > doc.page.height - 90) {
      doc.addPage();
      y = doc.y;
      // reimprimir encabezado
      doc.font('Helvetica-Bold').fontSize(10);
      headers.forEach((h, i) => {
        doc.text(h, startX + sum(widths, i), y, { width: widths[i], continued: i < headers.length - 1 });
      });
      doc.text('', { continued: false });
      y += lineH;
      drawLine(doc, startX, y - 4, sum(widths, widths.length), '#bbb');
      doc.font('Helvetica').fontSize(10);
    }
    row.forEach((cell, i) => {
      doc.text(String(cell ?? '-'), startX + sum(widths, i), y, {
        width: widths[i],
        continued: i < row.length - 1
      });
    });
    doc.text('', { continued: false });
    y += lineH - 2;
  });

  doc.moveDown(0.5);
}
function drawLine(doc, x, y, w, color = '#000') {
  doc.save().moveTo(x, y).lineTo(x + w, y).lineWidth(0.5).strokeColor(color).stroke().restore();
}
function sum(arr, n) { return typeof n === 'number' ? arr.slice(0, n).reduce((a,b)=>a+b,0) : arr.reduce((a,b)=>a+b,0); }
function basename(url = '') { try { const p = url.split('?')[0]; return p.split('/').pop() || url; } catch { return url; } }

module.exports = { buildDocumentoPDF };
