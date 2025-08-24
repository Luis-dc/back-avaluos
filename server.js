const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
require('./config/db');


// Cargar variables de entorno
dotenv.config();

const app = express();

//Middlewares
app.use(cors());
app.use(express.json());

//importar rutas
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const adminRoutes = require('./routes/adminRoutes');

//usar rutas con prefijo
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/admin', adminRoutes);

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Puerto
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
});
