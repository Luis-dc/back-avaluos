module.exports = function ensureRole(role) {
    return (req, res, next) => {
      if (!req.user) {
        return res.status(401).json({ message: 'No autenticado' });
      }
      if (req.user.rol !== role && req.user.rol !== 'admin') {
        return res.status(403).json({ message: 'Sin permiso' });
      }
      next();
    };
  };
  