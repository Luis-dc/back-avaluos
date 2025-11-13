// controllers/documentoTerrenoController.js
const db = require('../config/db');

/* ------------------------------
   Tablas y reglas oficiales
--------------------------------*/

// Ubicación fija (no interior)
const UBICACION_FIJOS = {
  medial: 1.00,
  esquina_residencial: 1.10,
  esquina_comercial: 1.20,
};

// Factor por frente (m)
function factorPorFrente(frente) {
  const f = Number(frente);
  if (!Number.isFinite(f) || f <= 0) return null;
  if (f >= 8.00) return 1.00;
  if (f >= 7.00) return 0.95;
  if (f >= 6.00) return 0.90;
  if (f >= 5.00) return 0.85;
  if (f >= 4.00) return 0.80;
  return 0.75; // < 4.00: criterio conservador
}

// Factor por fondo (m)
function factorPorFondo(fondo) {
  const d = Number(fondo);
  if (!Number.isFinite(d) || d <= 0) return null;
  if (d <= 40.00) return 1.00;
  if (d <= 45.00) return 0.95;
  if (d <= 50.00) return 0.90;
  if (d <= 55.00) return 0.85;
  if (d <= 60.00) return 0.80;
  if (d <= 65.00) return 0.75;
  if (d <= 70.00) return 0.70;
  return 0.65; // > 70
}

// Factor por extensión (área m²)
function factorPorExtension(area) {
  const a = Number(area);
  if (!Number.isFinite(a) || a < 0) return { factor: null, rango: null };
  const rangos = [
    { min:    0.00, max:  600.00, f: 1.00 },
    { min:  600.01, max: 1200.00, f: 0.97 },
    { min: 1200.01, max: 1600.00, f: 0.94 },
    { min: 1600.01, max: 2000.00, f: 0.91 },
    { min: 2000.01, max: 2400.00, f: 0.88 },
    { min: 2400.01, max: 2800.00, f: 0.85 },
    { min: 2800.01, max: 3200.00, f: 0.82 },
    { min: 3200.01, max: 3600.00, f: 0.79 },
    { min: 3600.01, max: 4000.00, f: 0.76 },
    { min: 4000.01, max: 4400.00, f: 0.73 },
    { min: 4400.01, max: Infinity, f: 0.70 },
  ];
  for (const r of rangos) {
    if (a >= r.min && a <= r.max) {
      return { factor: r.f, rango: { min_m2: r.min, max_m2: r.max === Infinity ? null : r.max } };
    }
  }
  return { factor: null, rango: null };
}

// Forma → factor
function factorPorForma(forma_clave) {
  const k = String(forma_clave || '').toLowerCase();
  const map = {
    regular: 1.00,
    irregular: 0.90,
    'muy_irregular': 0.85,
    'triangulo_delta': 0.80,
    'triángulo_delta': 0.80,
    'triangulo_nabla': 0.50,
    'triángulo_nabla': 0.50,
  };
  return map[k] ?? null;
}

// Pendiente % → factor
function factorPorPendientePct(pct) {
  const p = Number(pct);
  if (!Number.isFinite(p) || p < 0) return null;
  if (p <= 5.0) return 1.00;
  if (p <= 10.0) return 0.90;
  if (p <= 30.0) return 0.80;
  return 0.25; // >= 30.1
}

// Nivel (tipo + metros) → factor
function factorPorNivel(tipo, metros) {
  const t = String(tipo || '').toLowerCase(); // 'sobre' | 'bajo'
  const m = Number(metros);
  if (!Number.isFinite(m) || m < 0) return null;

  // tablas oficiales
  const sobre = [
    { max: 1.00, f: 1.00 },
    { max: 2.00, f: 0.92 },
    { max: 3.00, f: 0.86 },
    { max: 4.00, f: 0.81 },
    { max: 5.00, f: 0.77 },
    { max: 6.00, f: 0.74 },
    { max: 7.00, f: 0.71 },
    { max: 8.00, f: 0.69 },
    { max: 9.00, f: 0.67 },
    { max: Infinity, f: 0.65 },
  ];
  const bajo = [
    { max: 1.00, f: 1.00 },
    { max: 2.00, f: 0.90 },
    { max: 3.00, f: 0.82 },
    { max: 4.00, f: 0.74 },
    { max: 5.00, f: 0.67 },
    { max: 6.00, f: 0.62 },
    { max: 7.00, f: 0.58 },
    { max: 8.00, f: 0.53 },
    { max: 9.00, f: 0.49 },
    { max: Infinity, f: 0.46 },
  ];

  const tabla = t === 'sobre' ? sobre : t === 'bajo' ? bajo : null;
  if (!tabla) return null;
  return tabla.find(r => m <= r.max).f;
}

// Matriz lote interior (FONDO × DISTANCIA)
const LI_COLS = [5,10,15,20,25,30,35,40,45,50];
const LI_ROWS = [5,10,15,20,25,30,35,40,45,50,55,60];
const LI_TABLE = {
  5:  [0.95,0.85,0.76,0.68,0.61,0.55,0.49,0.44,0.39,0.35],
  10: [0.95,0.85,0.76,0.68,0.61,0.55,0.49,0.44,0.39,0.34],
  15: [0.95,0.85,0.75,0.68,0.61,0.55,0.49,0.43,0.38,0.33],
  20: [0.95,0.85,0.75,0.68,0.61,0.55,0.49,0.42,0.37,0.32],
  25: [0.95,0.85,0.75,0.68,0.61,0.55,0.48,0.41,0.36,0.30],
  30: [0.93,0.83,0.72,0.66,0.59,0.53,0.46,0.39,0.35,0.28],
  35: [0.90,0.80,0.70,0.63,0.56,0.50,0.43,0.37,0.32,0.26],
  40: [0.87,0.77,0.67,0.60,0.53,0.47,0.40,0.34,0.29,0.24],
  45: [0.83,0.73,0.63,0.56,0.49,0.43,0.36,0.30,0.25,0.25],
  50: [0.80,0.70,0.60,0.53,0.46,0.40,0.33,0.27,0.27,0.27],
  55: [0.76,0.66,0.57,0.50,0.43,0.37,0.30,0.30,0.30,0.30],
  60: [0.71,0.62,0.53,0.46,0.40,0.40,0.40,0.40,0.40,0.40],
};
function nearest(grid, value) {
  const v = Number(value);
  if (!Number.isFinite(v)) return null;
  let best = grid[0], diff = Math.abs(v - grid[0]);
  for (const g of grid) {
    const d = Math.abs(v - g);
    if (d < diff) { best = g; diff = d; }
  }
  return best;
}
function factorUbicacion(ubicacion, fondo_m, distancia) {
  if (ubicacion !== 'lote_interior') return UBICACION_FIJOS[ubicacion] ?? null;
  const r = nearest(LI_ROWS, fondo_m);
  const c = nearest(LI_COLS, distancia);
  if (r == null || c == null) return null;
  const row = LI_TABLE[r];
  const idx = LI_COLS.indexOf(c);
  if (!row || idx < 0) return null;
  return row[idx] ?? row[row.length - 1];
}

/* ------------------------------
   Utilidades
--------------------------------*/
const toNum = (v) => (v === '' || v == null ? null : Number(v));
const clamp4 = (n) => Number.isFinite(n) ? +Number(n).toFixed(4) : null;
const clamp3 = (n) => Number.isFinite(n) ? +Number(n).toFixed(3) : null;

/* ------------------------------
   Controladores
--------------------------------*/

// PUT /documentos/:idDocumento/documento-terreno
exports.upsert = async (req, res) => {
  try {
    const idDocumento = +req.params.idDocumento;
    const {
      ubicacion,              // 'medial' | 'esquina_residencial' | 'esquina_comercial' | 'lote_interior'
      frente_m,
      fondo_m,
      distancia_interior,     // requerido si lote_interior

      // FRONT: claves/valores para los manuales según requisitos
      forma_clave,            // 'regular' | 'irregular' | 'muy_irregular' | 'triangulo_delta' | 'triangulo_nabla'
      pendiente_pct,          // número (%)
      nivel_tipo,             // 'sobre' | 'bajo'
      nivel_desnivel_m        // número (m)
    } = req.body;

    // Validaciones
    const UBIC = ['medial','esquina_residencial','esquina_comercial','lote_interior'];
    if (!UBIC.includes(ubicacion)) return res.status(400).json({ ok:false, error:'ubicacion inválida' });

    const nf  = toNum(frente_m);
    const nfo = toNum(fondo_m);
    if (!(nf > 0 && nfo > 0)) return res.status(400).json({ ok:false, error:'frente/fondo deben ser > 0' });

    const nDist = ubicacion === 'lote_interior' ? toNum(distancia_interior) : null;
    if (ubicacion === 'lote_interior' && (nDist == null || nDist < 0)) {
      return res.status(400).json({ ok:false, error:'distancia_interior requerida y >= 0' });
    }

    // 1) Área del documento para extensión
    const rDoc = await db.query('SELECT area_m2 FROM documentos_legales WHERE id=$1', [idDocumento]);
    const area_m2 = rDoc.rows?.[0]?.area_m2 ?? null;

    // 2) Automáticos
    const fFrente = factorPorFrente(nf);
    const fFondo  = factorPorFondo(nfo);
    const { factor: fExt, rango: rangoExt } = factorPorExtension(area_m2);
    const fUbic   = factorUbicacion(ubicacion, nfo, nDist);

    // 3) Manuales (pero calculados por regla desde inputs)
    const fForma = factorPorForma(forma_clave);
    const fPend  = factorPorPendientePct(pendiente_pct);
    const fNivel = factorPorNivel(nivel_tipo, nivel_desnivel_m);

    if ([fFrente,fFondo,fExt,fUbic,fForma,fPend,fNivel].some(v => !Number.isFinite(v))) {
      return res.status(400).json({ ok:false, error:'No se pudieron determinar todos los factores (verifica entradas).' });
    }

    // 4) Factor final
    const factor_final = clamp3(fUbic * fFrente * fFondo * fExt * fForma * fPend * fNivel);

    // 5) Trazabilidad
    const factor_json = {
      version_regla: 'v2.2',
      regla_aplicada: 'factor_final = ubicacion * frente * fondo * extension * forma * pendiente * nivel',
      inputs: {
        ubicacion,
        frente_m: nf,
        fondo_m: nfo,
        distancia_interior: nDist,
        area_m2,
        forma_clave,
        pendiente_pct: toNum(pendiente_pct),
        nivel_tipo: nivel_tipo || null,
        nivel_desnivel_m: toNum(nivel_desnivel_m),
        factor_frente_calc: fFrente,
        factor_fondo_calc:  fFondo,
        factor_extension_calc: fExt,
        factor_ubicacion_calc: fUbic,
        factor_forma_calc: fForma,
        factor_pendiente_calc: fPend,
        factor_nivel_calc: fNivel,
      },
      detalles: {
        lote_interior_grid: ubicacion === 'lote_interior'
          ? { fondo_grid: nearest(LI_ROWS, nfo), distancia_grid: nearest(LI_COLS, nDist) }
          : null,
        rango_extension: rangoExt,
        notes: []
      }
    };

    const userId = req.user.id;

    // 6) Persistir (UPSERT)
    const q = `
      INSERT INTO documento_terreno
        (id_documento, ubicacion, frente_m, fondo_m, distancia_interior,
         factor_ubicacion, factor_frente, factor_fondo, factor_extension,
         factor_forma, factor_pendiente, factor_nivel,
         pendiente_pct, nivel_tipo, nivel_desnivel_m,
         factor_final, factor_json,
         creado_por, actualizado_por)
      VALUES
        ($1,$2,$3,$4,$5,
         $6,$7,$8,$9,
         $10,$11,$12,
         $13,$14,$15,
         $16,$17,
         $18,$18)
      ON CONFLICT (id_documento) DO UPDATE SET
        ubicacion          = EXCLUDED.ubicacion,
        frente_m           = EXCLUDED.frente_m,
        fondo_m            = EXCLUDED.fondo_m,
        distancia_interior = EXCLUDED.distancia_interior,
        factor_ubicacion   = EXCLUDED.factor_ubicacion,
        factor_frente      = EXCLUDED.factor_frente,
        factor_fondo       = EXCLUDED.factor_fondo,
        factor_extension   = EXCLUDED.factor_extension,
        factor_forma       = EXCLUDED.factor_forma,
        factor_pendiente   = EXCLUDED.factor_pendiente,
        factor_nivel       = EXCLUDED.factor_nivel,
        pendiente_pct      = EXCLUDED.pendiente_pct,
        nivel_tipo         = EXCLUDED.nivel_tipo,
        nivel_desnivel_m   = EXCLUDED.nivel_desnivel_m,
        factor_final       = EXCLUDED.factor_final,
        factor_json        = EXCLUDED.factor_json,
        actualizado_por    = EXCLUDED.actualizado_por,
        actualizado_en     = NOW()
      RETURNING *;`;

    const vals = [
      idDocumento,
      ubicacion,
      nf,
      nfo,
      nDist,
      clamp4(fUbic),
      clamp4(fFrente),
      clamp4(fFondo),
      clamp4(fExt),
      clamp4(fForma),
      clamp4(fPend),
      clamp4(fNivel),
      toNum(pendiente_pct),
      (nivel_tipo ? String(nivel_tipo).toLowerCase() : null),
      toNum(nivel_desnivel_m),
      factor_final,
      factor_json,
      userId,
    ];

    const { rows } = await db.query(q, vals);
    return res.json({ ok:true, data: rows[0] });

  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok:false, error:'server_error' });
  }
};

// GET /documentos/:idDocumento/documento-terreno
exports.getOne = async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT * FROM documento_terreno WHERE id_documento = $1`,
      [req.params.idDocumento]
    );
    if (!rows.length) return res.status(404).json({ ok:false, error:'not_found' });
    return res.json({ ok:true, data: rows[0] });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok:false, error:'server_error' });
  }
};
