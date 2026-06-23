module.exports = (req, res) => {
  res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
  const token = process.env.MAPBOX_TOKEN || '';
  res.status(200).send(
    'window.MAPBOX_CONFIG = { token: ' + JSON.stringify(token) + ' };\n'
  );
};
