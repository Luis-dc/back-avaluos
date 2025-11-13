const pool = require('../config/db');

// ✅ Crear construcción
exports.crearConstruccion = async (req, res) => {
  try {
    const id_documento = req.params.id;
    const { tipo, area_m2, valor_m2, edad_anios, factor_ajuste, descripcion } = req.body;

    const foto_url = req.file
      ? `/uploads/construcciones/${req.file.filename}`
      : req.body.foto_url || null;

    if (!tipo || !area_m2 || !valor_m2) {
      return res.status(400).json({ message: 'Campos obligatorios faltantes.' });
    }

    const result = await pool.query(
      `INSERT INTO construcciones
        (id_documento, tipo, area_m2, valor_m2, edad_anios, factor_ajuste, descripcion, foto_url, creado_por)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING *`,
      [
        id_documento,
        tipo,
        area_m2,
        valor_m2,
        edad_anios || 0,
        factor_ajuste || 1,
        descripcion || null,
        foto_url,
        req.user?.id || null,
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error al crear construcción:', error);
    res.status(500).json({ message: 'Error interno del servidor.' });
  }
};

// ✅ Listar construcciones por documento
exports.listarConstruccionesPorDocumento = async (req, res) => {
  try {
    const id_documento = req.params.id;
    const result = await pool.query(
      `SELECT *,
              ROUND(AVG(valor_total) OVER (), 2) AS promedio_valor_construccion
       FROM construcciones
       WHERE id_documento = $1
       ORDER BY creado_en DESC`,
      [id_documento]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error al listar construcciones:', error);
    res.status(500).json({ message: 'Error interno del servidor.' });
  }
};

// ✅ Eliminar construcción
exports.eliminarConstruccion = async (req, res) => {
  try {
    const id = req.params.id;
    await pool.query('DELETE FROM construcciones WHERE id = $1', [id]);
    res.json({ message: 'Construcción eliminada correctamente.' });
  } catch (error) {
    console.error('Error al eliminar construcción:', error);
    res.status(500).json({ message: 'Error interno del servidor.' });
  }
};