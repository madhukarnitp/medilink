const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.openstreetmap.fr/api/interpreter",
  "https://lz4.overpass-api.de/api/interpreter",
];

const toRadians = (value) => (value * Math.PI) / 180;

const distanceKm = (from, to) => {
  const earthRadius = 6371;
  const dLat = toRadians(to.lat - from.lat);
  const dLon = toRadians(to.lng - from.lng);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(from.lat)) *
      Math.cos(toRadians(to.lat)) *
      Math.sin(dLon / 2) ** 2;

  return earthRadius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const buildHospitalQuery = ({ lat, lng }) => `
  [out:json][timeout:14];
  (
    node["amenity"="hospital"](around:15000,${lat},${lng});
    way["amenity"="hospital"](around:15000,${lat},${lng});
    relation["amenity"="hospital"](around:15000,${lat},${lng});
    node["healthcare"="hospital"](around:15000,${lat},${lng});
    way["healthcare"="hospital"](around:15000,${lat},${lng});
    relation["healthcare"="hospital"](around:15000,${lat},${lng});
  );
  out center 25;
`;

const fetchWithTimeout = async (url, options = {}, timeoutMs = 18000) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
};

const parseHospitals = (location, data) => {
  const seen = new Set();

  return (data.elements || [])
    .map((item) => {
      const point = item.center || item;
      const tags = item.tags || {};
      const lat = Number(point.lat);
      const lng = Number(point.lon);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

      const name = tags.name || "Nearby hospital";
      const key = `${name}-${lat.toFixed(4)}-${lng.toFixed(4)}`;
      if (seen.has(key)) return null;
      seen.add(key);

      return {
        id: item.id || key,
        name,
        lat,
        lng,
        phone: tags.phone || tags["contact:phone"] || "",
        address: [
          tags["addr:housenumber"],
          tags["addr:street"],
          tags["addr:city"],
        ]
          .filter(Boolean)
          .join(", "),
        distance: distanceKm(location, { lat, lng }),
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.distance - b.distance)
    .slice(0, 5);
};

exports.getNearbyHospitals = async (req, res, next) => {
  const lat = Number(req.query.lat);
  const lng = Number(req.query.lng);
  const location = { lat, lng };
  const query = buildHospitalQuery(location);
  let lastError = null;

  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const response = await fetchWithTimeout(
        endpoint,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
            Accept: "application/json",
            "User-Agent": "MediLink/1.0 (+emergency hospital lookup)",
          },
          body: `data=${encodeURIComponent(query)}`,
        },
        18000,
      );

      if (!response.ok) {
        lastError = new Error(`Overpass endpoint returned ${response.status}`);
        continue;
      }

      const data = await response.json();
      return res.json({
        success: true,
        data: parseHospitals(location, data),
      });
    } catch (error) {
      lastError = error;
    }
  }

  const upstreamError = new Error(
    "Could not load nearby hospitals right now. Open Maps or Google Maps for live results.",
  );
  upstreamError.statusCode = 502;
  upstreamError.cause = lastError;
  return next(upstreamError);
};
