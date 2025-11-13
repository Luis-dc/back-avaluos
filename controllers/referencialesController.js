const fs = require("fs");
const path = require("path");
const pool = require("../config/db");

// Crear un referencial (imagen local o URL)
exports.crearReferencial = async (req, res) => {
  try {
    const id_documento = req.params.id;
    const {
      link_fuente,
      valor_total_inmueble,
      area_total_terreno,
      area_total_construccion,
      valor_construccion,
    } = req.body;

    // Determinar si hay imagen local o URL
    const foto_url = req.file
      ? `/uploads/referenciales/${req.file.filename}`
      : req.body.foto_url || null;

    // Validación de campos obligatorios
    if (!link_fuente || !valor_total_inmueble || !area_total_terreno) {
      return res.status(400).json({
        message: "Campos obligatorios faltantes: link, valor total o área terreno.",
      });
    }

    // Conversión segura a número
    const total = Number(String(valor_total_inmueble).replace(/,/g, "").trim());
    const terreno = Number(String(area_total_terreno).replace(/,/g, "").trim());
    const construccion = Number(String(valor_construccion || "0").replace(/,/g, "").trim());
    const area_construccion = Number(String(area_total_construccion || "0").replace(/,/g, "").trim());

    // Validar conversiones numéricas
    if (isNaN(total) || isNaN(terreno)) {
      return res.status(400).json({
        message: "Los valores de terreno o total deben ser numéricos válidos.",
      });
    }

    // Validar que el total sea mayor o igual al valor de construcción
    if (construccion > total) {
      return res.status(400).json({
        message: "El valor de construcción no puede ser mayor al valor total del inmueble.",
      });
    }

    // Insertar en la base
    const result = await pool.query(
      `INSERT INTO referenciales 
        (id_documento, link_fuente, valor_total_inmueble, area_total_terreno, 
         area_total_construccion, valor_construccion, foto_url, creado_por)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING *`,
      [
        id_documento,
        link_fuente,
        total,
        terreno,
        area_construccion,
        construccion,
        foto_url,
        req.user?.id || null,
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error("Error al crear referencial:", error.message, error.stack);
    res.status(500).json({ message: "Error interno del servidor." });
  }
};

// Listar referenciales por documento
exports.listarReferencialesPorDocumento = async (req, res) => {
  try {
    const id_documento = req.params.id;
    const result = await pool.query(
      `SELECT *,
              ROUND(AVG(valor_suelo_m2) OVER (), 2) AS promedio_suelo_m2
       FROM referenciales
       WHERE id_documento = $1
       ORDER BY creado_en DESC`,
      [id_documento]
    );
    res.json(result.rows);
  } catch (error) {
    console.error("Error al listar referenciales:", error.message);
    res.status(500).json({ message: "Error interno del servidor." });
  }
};

// Eliminar referencial
exports.eliminarReferencial = async (req, res) => {
  try {
    const id = req.params.id;
    await pool.query("DELETE FROM referenciales WHERE id = $1", [id]);
    res.json({ message: "Referencial eliminado correctamente." });
  } catch (error) {
    console.error("Error al eliminar referencial:", error.message);
    res.status(500).json({ message: "Error interno del servidor." });
  }
};
