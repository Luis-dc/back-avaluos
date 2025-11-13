const pool = require('../config/db');
const path = require('path');
const fs = require('fs');

/* ============================================================
   Crear documento (fix jsonb)
============================================================ */

const asJson = (v, fieldName) => {
  if (v == null || v === '') return null;
  if (typeof v === 'object') return v;
  if (typeof v === 'string') {
    try { return JSON.parse(v); }
    catch { throw new Error(`${fieldName} debe ser JSON válido`); }
  }
  return null;
};

exports.crearDocumento = async (req, res) => {
  try {
    const {
      tipo, propietario, direccion, area_m2,
      colindancias, orientaciones,
      fecha_cert, numero_escritura, abogado, poseedor
    } = req.body;

    if (!tipo) return res.status(400).json({ message: 'tipo es requerido' });
    if (tipo === 'certificacion' && !fecha_cert)
      return res.status(400).json({ message: 'fecha_cert es requerido para certificación' });
    if (tipo === 'escritura' && !numero_escritura)
      return res.status(400).json({ message: 'numero_escritura es requerido para escritura' });

    const colObj = asJson(colindancias, 'colindancias');      // objeto o null
    const oriObj = asJson(orientaciones, 'orientaciones');    // objeto o null
    const colJson = colObj ? JSON.stringify(colObj) : null;   // ← stringify
    const oriJson = oriObj ? JSON.stringify(oriObj) : null;   // ← stringify
    const area = (area_m2 === '' || area_m2 == null) ? null : Number(area_m2);

    const { rows } = await pool.query(
      `INSERT INTO documentos_legales
         (id_valuador, tipo, propietario, direccion, area_m2, colindancias, orientaciones,
          fecha_cert, numero_escritura, abogado, poseedor,
          creado_por, actualizado_por)
       VALUES
         ($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8,$9,$10,$11,$12,$12)
       RETURNING id, numero_interno, tipo, estado, creado_por, creado_en`,
      [
        req.user.id, tipo, propietario || null, direccion || null, area,
        colJson, oriJson,
        fecha_cert || null, numero_escritura || null,
        abogado || null, poseedor || null,
        req.user.id
      ]
    );

    return res.status(201).json(rows[0]);
  } catch (err) {
    console.error('crearDocumento error:', err.stack || err);
    if ((err.message || '').toLowerCase().includes('json'))
      return res.status(400).json({ message: err.message });
    return res.status(500).json({ message: 'Error creando documento' });
  }
};


/* ============================================================
   Listar documentos con filtros y paginación
============================================================ */
exports.listarDocumentos = async (req, res) => {
  try {
    const { q, tipo, desde, hasta, num_escritura, estado,
            limit = 10, offset = 0 } = req.query;

    let where = [];
    let params = [];
    let i = 1;

    if (q) {
      where.push(`(propietario ILIKE $${i} OR direccion ILIKE $${i} OR numero_escritura ILIKE $${i})`);
      params.push(`%${q}%`); i++;
    }
    if (tipo) { where.push(`tipo = $${i}`); params.push(tipo); i++; }
    if (desde) { where.push(`creado_en >= $${i}`); params.push(desde); i++; }
    if (hasta) { where.push(`creado_en <= $${i}`); params.push(hasta); i++; }
    if (num_escritura) { where.push(`numero_escritura = $${i}`); params.push(num_escritura); i++; }
    if (estado) { where.push(`estado = $${i}`); params.push(estado); i++; }

    const whereClause = where.length ? 'WHERE ' + where.join(' AND ') : '';

    const { rows } = await pool.query(
      `SELECT id, numero_interno, tipo, propietario, direccion, estado,
              fecha_cert, numero_escritura, creado_en
         FROM documentos_legales
        ${whereClause}
        ORDER BY creado_en DESC
        LIMIT $${i} OFFSET $${i + 1}`,
      [...params, limit, offset]
    );

    const { rows: countRows } = await pool.query(
      `SELECT COUNT(*) FROM documentos_legales ${whereClause}`,
      params
    );

    res.json({ total: Number(countRows[0].count), items: rows });
  } catch (err) {
    console.error('listarDocumentos:', err.message);
    res.status(500).json({ message: 'Error listando documentos' });
  }
};

/* ============================================================
   Obtener detalle con archivos
============================================================ */
exports.obtenerDocumento = async (req, res) => {
  try {
    const { id } = req.params;
    const { rows } = await pool.query(
      `SELECT * FROM documentos_legales WHERE id=$1`,
      [id]
    );
    if (!rows.length) return res.status(404).json({ message: 'Documento no encontrado' });

    const doc = rows[0];
    const { rows: archivos } = await pool.query(
      `SELECT * FROM documentos_archivos WHERE id_documento=$1`,
      [id]
    );

    res.json({ ...doc, archivos });
  } catch (err) {
    console.error('obtenerDocumento:', err.message);
    res.status(500).json({ message: 'Error obteniendo documento' });
  }
};

/* ============================================================
   Actualizar documento (fix jsonb + casting)
============================================================ */

exports.actualizarDocumento = async (req, res) => {
  try {
    const { id } = req.params;

    const keys = [
      'propietario','direccion','area_m2','colindancias','orientaciones',
      'fecha_cert','numero_escritura','abogado','poseedor'
    ];
    const jsonFields = new Set(['colindancias','orientaciones']);

    const updates = [];
    const params = [];
    let i = 1;

    for (const key of keys) {
      if (req.body[key] === undefined) continue;

      if (key === 'area_m2') {
        const val = (req.body[key] === '' || req.body[key] == null) ? null : Number(req.body[key]);
        updates.push(`${key} = $${i}`);
        params.push(val);
        i++;
        continue;
      }

      if (jsonFields.has(key)) {
        const obj = asJson(req.body[key], key);
        const jsonStr = obj ? JSON.stringify(obj) : null;
        updates.push(`${key} = $${i}::jsonb`);
        params.push(jsonStr);
        i++;
        continue;
      }

      updates.push(`${key} = $${i}`);
      params.push(req.body[key] ?? null);
      i++;
    }

    if (!updates.length) {
      return res.status(400).json({ message: 'No hay campos para actualizar' });
    }

    updates.push(`actualizado_por = $${i}`); params.push(req.user.id); i++;
    updates.push(`actualizado_en = NOW()`);

    const { rowCount } = await pool.query(
      `UPDATE documentos_legales
         SET ${updates.join(', ')}
       WHERE id = $${i}`,
      [...params, id]
    );

    if (!rowCount) return res.status(404).json({ message: 'Documento no encontrado' });

    res.json({ id, actualizado_por: req.user.id, actualizado_en: new Date() });
  } catch (err) {
    console.error('actualizarDocumento error:', err.stack || err);
    if ((err.message || '').toLowerCase().includes('json')) {
      return res.status(400).json({ message: err.message });
    }
    res.status(500).json({ message: 'Error actualizando documento' });
  }
};


/* ============================================================
   Anular documento
============================================================ */
exports.anularDocumento = async (req, res) => {
  try {
    const { id } = req.params;
    const { rowCount } = await pool.query(
      `UPDATE documentos_legales
          SET estado='anulado', actualizado_por=$1, actualizado_en=NOW()
        WHERE id=$2`,
      [req.user.id, id]
    );
    if (!rowCount) return res.status(404).json({ message: 'Documento no encontrado' });
    res.json({ id, estado: 'anulado' });
  } catch (err) {
    console.error('anularDocumento:', err.message);
    res.status(500).json({ message: 'Error anulando documento' });
  }
};

/* ============================================================
   Subir archivo
============================================================ */
exports.subirArchivo = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'Archivo requerido' });

    const { id } = req.params;
    const { descripcion } = req.body;

    const fileUrl = `/uploads/legal/${req.file.filename}`;

    const { rows } = await pool.query(
      `INSERT INTO documentos_archivos
         (id_documento, url, tipo_mime, descripcion)
       VALUES ($1,$2,$3,$4)
       RETURNING id, url, tipo_mime, descripcion, creado_en`,
      [id, fileUrl, req.file.mimetype, descripcion || null]
    );

    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('subirArchivo:', err.message);
    res.status(500).json({ message: 'Error subiendo archivo' });
  }
};

/* ============================================================
   Listar archivos
============================================================ */
exports.listarArchivos = async (req, res) => {
  try {
    const { id } = req.params;
    const { rows } = await pool.query(
      `SELECT id, url, tipo_mime, descripcion, creado_en
         FROM documentos_archivos
        WHERE id_documento=$1`,
      [id]
    );
    res.json({ items: rows });
  } catch (err) {
    console.error('listarArchivos:', err.message);
    res.status(500).json({ message: 'Error listando archivos' });
  }
};

/* ============================================================
   Eliminar archivo
============================================================ */
exports.eliminarArchivo = async (req, res) => {
  try {
    const { id } = req.params;
    const { rows } = await pool.query(
      `DELETE FROM documentos_archivos WHERE id=$1 RETURNING url`,
      [id]
    );
    if (!rows.length) return res.status(404).json({ message: 'Archivo no encontrado' });

    const filePath = path.join(__dirname, '..', rows[0].url);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    res.json({ id, deleted: true });
  } catch (err) {
    console.error('eliminarArchivo:', err.message);
    res.status(500).json({ message: 'Error eliminando archivo' });
  }
};
/* ============================================================
   Calcular area
============================================================ */

exports.calcularArea = async (req, res) => {
    try {
      const { id } = req.params;
      const { diagonal, frente_t1, fondo_t1, frente_t2, fondo_t2, force = false } = req.body;
  
      // Validaciones mínimas
      const nums = [diagonal, frente_t1, fondo_t1, frente_t2, fondo_t2].map(Number);
      if (nums.some(n => !isFinite(n) || n <= 0)) {
        return res.status(400).json({ message: 'Todos los valores deben ser numéricos y > 0' });
      }
  
      // Verificar documento
      const { rows } = await pool.query(
        'SELECT id, area_m2 FROM documentos_legales WHERE id=$1 LIMIT 1',
        [id]
      );
      if (!rows.length) return res.status(404).json({ message: 'Documento no encontrado' });
  
      if (rows[0].area_m2 != null && !force) {
        return res.status(409).json({ message: 'El documento ya tiene área; use force=true para recalcular' });
      }
  
      // Cálculo (cajón 2 triángulos)
      const area =
        (Number(frente_t1) * Number(fondo_t1)) / 2 +
        (Number(frente_t2) * Number(fondo_t2)) / 2;
  
      // Persistir
      const fuente = {
        diagonal: Number(diagonal),
        frente_t1: Number(frente_t1),
        fondo_t1: Number(fondo_t1),
        frente_t2: Number(frente_t2),
        fondo_t2: Number(fondo_t2)
      };
  
      const { rows: updated } = await pool.query(
        `UPDATE documentos_legales
           SET area_m2=$1,
               area_origen='calculada',
               area_metodo='cajon_2triangulos',
               area_fuente=$2,
               actualizado_por=$3,
               actualizado_en=NOW()
         WHERE id=$4
         RETURNING id, area_m2, area_origen, area_metodo`,
        [area, fuente, req.user.id, id]
      );
  
      res.json(updated[0]);
    } catch (err) {
      console.error('calcularArea:', err.message);
      res.status(500).json({ message: 'Error calculando área' });
    }
  };


  // Listar documentos que ya tienen avalúo
exports.listarAvaluados = async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT 
        id, 
        tipo, 
        propietario, 
        direccion, 
        fecha_cert, 
        numero_escritura, 
        creado_en, 
        actualizado_en
      FROM documentos_legales
      WHERE avaluado = true
      ORDER BY actualizado_en DESC;
    `);
    res.json(rows);
  } catch (error) {
    console.error("Error al listar avaluados:", error);
    res.status(500).json({ message: "Error al listar avalúos." });
  }
};