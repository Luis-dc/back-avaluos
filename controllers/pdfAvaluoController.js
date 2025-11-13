// controllers/pdfAvaluoController.js
const PDFDocument = require('pdfkit');
const pool = require('../config/db');
const path = require('path');
const fs = require('fs');

exports.generarPDF = async (req, res) => {
  try {
    const id = req.params.id;
    const user = req.user;

    // 1️⃣ DATOS PRINCIPALES DEL DOCUMENTO
    const { rows: docs } = await pool.query(
      `SELECT tipo, propietario, direccion, area_m2, fecha_cert, estado
       FROM documentos_legales
       WHERE id = $1`,
      [id]
    );
    if (!docs.length) return res.status(404).json({ message: 'Documento no encontrado.' });
    const docData = docs[0];

    // 2️⃣ DATOS DEL TERRENO
    const { rows: terrenoRows } = await pool.query(
      `SELECT *
         FROM documento_terreno
         WHERE id_documento = $1`,
      [id]
    );
    const terreno = terrenoRows[0] || {};

    // 3️⃣ REFERENCIALES
    const { rows: refs } = await pool.query(
      `SELECT link_fuente, area_total_terreno, valor_total_inmueble, valor_suelo_m2, foto_url
         FROM referenciales
         WHERE id_documento = $1
         ORDER BY creado_en DESC`,
      [id]
    );

    // 4️⃣ CONSTRUCCIONES
    const { rows: constrs } = await pool.query(
      `SELECT tipo, area_m2, valor_m2, edad_anios, valor_total, descripcion, foto_url
         FROM construcciones
         WHERE id_documento = $1
         ORDER BY creado_en DESC`,
      [id]
    );

    // 5️⃣ RESUMEN DEL AVALÚO
    const area = parseFloat(docData.area_m2) || 0;
    const { rows: resumen } = await pool.query(
      `WITH refs AS (
        SELECT ROUND(AVG(valor_suelo_m2), 2) AS prom_suelo FROM referenciales WHERE id_documento = $1
      ),
      constr AS (
        SELECT ROUND(AVG(valor_total), 2) AS prom_construccion FROM construcciones WHERE id_documento = $1
      ),
      terr AS (
        SELECT factor_final FROM documento_terreno WHERE id_documento = $1
      )
      SELECT 
        COALESCE(refs.prom_suelo, 0) AS promedio_suelo_m2,
        COALESCE(constr.prom_construccion, 0) AS promedio_construccion,
        COALESCE((SELECT factor_final FROM terr LIMIT 1), 1) AS factor_ajuste,
        ROUND(
          (COALESCE(refs.prom_suelo, 0) * COALESCE($2, 0) * COALESCE((SELECT factor_final FROM terr LIMIT 1), 1))
          + COALESCE(constr.prom_construccion, 0), 2
        ) AS valor_estimado_total
      FROM refs, constr`,
      [ id, area ]
    );
    const r = resumen[0] || {};

    // 📄 Crear el PDF
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="avaluo_${id}.pdf"`);

    const pdf = new PDFDocument({ margin: 50, size: 'A4' });
    pdf.pipe(res);

    // === ENCABEZADO CON LOGO UMG ===
    const logoPath = path.join(__dirname, '../assets/logo_umg.png');
    if (fs.existsSync(logoPath)) {
      pdf.image(logoPath, 50, 30, { width: 80 });
    }
    pdf.fontSize(18).text('UNIVERSIDAD MARIANO GÁLVEZ DE GUATEMALA', 140, 35, { align: 'left' });
    pdf.moveDown(1.5);
    pdf.fontSize(16).text('INFORME TÉCNICO DE AVALÚO', { align: 'center', underline: true });
    pdf.moveDown(1);

    // === DATOS GENERALES ===
    pdf.fontSize(12).text(`Tipo: ${docData.tipo}`);
    pdf.text(`Propietario: ${docData.propietario}`);
    pdf.text(`Dirección: ${docData.direccion}`);
    pdf.text(`Área total: ${docData.area_m2} m²`);
    pdf.text(`Estado: ${docData.estado}`);
    pdf.text(`Fecha del documento: ${new Date(docData.fecha_cert).toLocaleDateString()}`);
    pdf.moveDown();

    // === RESUMEN DEL AVALÚO ===
    pdf.fontSize(14).text('RESUMEN DEL AVALÚO', { underline: true });
    pdf.moveDown(0.5);

    const resumenData = [
      ['Promedio valor suelo/m²', `Q${r.promedio_suelo_m2 || 0}`],
      ['Promedio valor construcciones', `Q${r.promedio_construccion || 0}`],
      ['Factor de ajuste terreno', `${r.factor_ajuste || 1}`],
      ['VALOR ESTIMADO TOTAL', `Q${r.valor_estimado_total || 0}`],
    ];

    resumenData.forEach(([label, val]) => {
      pdf.font('Helvetica-Bold').text(label, { continued: true }).font('Helvetica').text(`: ${val}`);
    });
    pdf.moveDown(1.2);

    // === FACTORES DEL TERRENO ===
    if (terreno.id) {
      pdf.fontSize(14).text('FACTORES DEL TERRENO', { underline: true });
      pdf.moveDown(0.5);

      const factores = [
        ['Ubicación', terreno.ubicacion, terreno.factor_ubicacion],
        ['Frente', terreno.frente_m, terreno.factor_frente],
        ['Fondo', terreno.fondo_m, terreno.factor_fondo],
        ['Extensión', '-', terreno.factor_extension],
        ['Forma', terreno.clasificacion_forma, terreno.factor_forma],
        ['Pendiente', terreno.clasificacion_pendiente, terreno.factor_pendiente],
        ['Nivel', terreno.clasificacion_nivel, terreno.factor_nivel],
        ['FACTOR FINAL', '', terreno.factor_final],
      ];
      factores.forEach(([f, c, v]) => {
        pdf.font('Helvetica-Bold').text(f, { continued: true })
           .font('Helvetica').text(` (${c || '-'}) : ${v || '-'}`);
      });
      pdf.moveDown(1);
    }

    // === REFERENCIALES ===
    if (refs.length) {
      pdf.fontSize(14).text('REFERENCIALES', { underline: true });
      pdf.moveDown(0.5);
      refs.forEach((r, i) => {
        pdf.font('Helvetica-Bold').text(`Ref. #${i + 1}`);
        pdf.font('Helvetica')
          .text(`Link: ${r.link_fuente}`)
          .text(`Área terreno: ${r.area_total_terreno} m²`)
          .text(`Valor total: Q${r.valor_total_inmueble}`)
          .text(`Valor suelo/m²: Q${r.valor_suelo_m2}`);
        if (r.foto_url) {
          try {
            pdf.image(r.foto_url, { width: 100, height: 80 });
          } catch {
            pdf.text('(No se pudo cargar imagen)');
          }
        }
        pdf.moveDown(0.5);
      });
      pdf.moveDown(1);
    }

    // === CONSTRUCCIONES ===
    if (constrs.length) {
      pdf.fontSize(14).text('CONSTRUCCIONES', { underline: true });
      pdf.moveDown(0.5);
      constrs.forEach((c, i) => {
        pdf.font('Helvetica-Bold').text(`Construcción #${i + 1}`);
        pdf.font('Helvetica')
          .text(`Tipo: ${c.tipo}`)
          .text(`Área: ${c.area_m2} m²`)
          .text(`Valor/m²: Q${c.valor_m2}`)
          .text(`Valor total: Q${c.valor_total}`)
          .text(`Edad: ${c.edad_anios} años`)
          .text(`Descripción: ${c.descripcion}`);
        if (c.foto_url) {
          try {
            pdf.image(c.foto_url, { width: 120, height: 90 });
          } catch {
            pdf.text('(No se pudo cargar imagen)');
          }
        }
        pdf.moveDown(0.5);
      });
      pdf.moveDown(1);
    }

    // === FIRMAS ===
    pdf.moveDown(2);
    pdf.text('_______________________________', { align: 'center' });
    pdf.text(`Perito Valuador: ${user?.nombre || 'N/A'}`, { align: 'center' });
    pdf.text(`Fecha de emisión: ${new Date().toLocaleDateString()}`, { align: 'center' });
    pdf.moveDown(1);
    pdf.fontSize(10).text('Documento generado automáticamente por el Sistema de Avalúos — Universidad Mariano Gálvez de Guatemala', { align: 'center' });

    pdf.end();
  } catch (error) {
    console.error('Error generando PDF:', error.stack || error);
    res.status(500).json({ message: 'Error interno en PDF.', detalle: error.message });

  }
};
