const pool = require('../config/db');

// Obtener resumen del documento legal (certificación o escritura)
exports.obtenerResumen = async (req, res) => {
  try {
    const id_documento = req.params.id;

    const query = `
      WITH terreno AS (
        SELECT factor_final
        FROM documento_terreno
        WHERE id_documento = $1
      ),
      refs AS (
        SELECT ROUND(AVG(valor_suelo_m2), 2) AS prom_suelo
        FROM referenciales
        WHERE id_documento = $1
      ),
      constr AS (
        SELECT ROUND(AVG(valor_total), 2) AS prom_construccion
        FROM construcciones
        WHERE id_documento = $1
      ),
      doc AS (
        SELECT area_m2
        FROM documentos_legales
        WHERE id = $1
      )
      SELECT 
        COALESCE(refs.prom_suelo, 0) AS promedio_suelo_m2,
        COALESCE(constr.prom_construccion, 0) AS promedio_construccion,
        COALESCE(doc.area_m2, 0) AS area_documento,
        COALESCE(terr.factor_final, 1) AS factor_ajuste,
        ROUND(
          (COALESCE(refs.prom_suelo, 0) * COALESCE(doc.area_m2, 0) * COALESCE(terr.factor_final, 1))
          + COALESCE(constr.prom_construccion, 0), 
        2) AS valor_estimado_total
      FROM refs, constr, doc, terreno terr;
    `;

    const { rows } = await pool.query(query, [id_documento]);

    if (!rows.length) {
      return res.status(404).json({ message: "No hay datos suficientes para calcular el resumen." });
    }

    res.json(rows[0]);
  } catch (error) {
    console.error("Error al obtener resumen del documento:", error);
    res.status(500).json({ message: "Error interno del servidor." });
  }
};

// Marcar documento como "avaluado"
exports.finalizarAvaluo = async (req, res) => {
  try {
    const id_documento = req.params.id;

    await pool.query(
      `UPDATE documentos_legales
       SET avaluado = true, actualizado_en = NOW()
       WHERE id = $1`,
      [id_documento]
    );

    res.json({ message: "Avaluó marcado como completado." });
  } catch (error) {
    console.error("Error al finalizar avaluó:", error);
    res.status(500).json({ message: "Error interno del servidor." });
  }
};
