function getMapboxToken() {
  return (
    process.env.MAPBOX_TOKEN ||
    process.env.MAPBOX_ACCESS_TOKEN ||
    process.env.NEXT_PUBLIC_MAPBOX_TOKEN ||
    ''
  );
}

module.exports = (req, res) => {
  res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
  const token = getMapboxToken();
  if (!token) {
    console.warn(
      'MAPBOX_TOKEN is unset — set it in Vercel → Project → Settings → Environment Variables (Production + Preview), then redeploy.'
    );
  }
  res.status(200).send(
    'window.MAPBOX_CONFIG = { token: ' + JSON.stringify(token) + ' };\n'
  );
};
