/**
 * Map region for a geofence circle. The map height covers three times the radius
 * (at least 120 m), so the circle is clearly visible instead of a dot: react-native-maps
 * fits the smaller side of the view, which is the height on both Auto Check-In maps.
 */
export function regionForRadius(latitude: number, longitude: number, radiusMeters: number) {
  const spanMeters = Math.max(radiusMeters * 3, 120);
  const latitudeDelta = spanMeters / 111320;
  // Longitude degrees get shorter towards the poles; keep the circle round.
  const longitudeDelta = latitudeDelta / Math.max(0.2, Math.cos((latitude * Math.PI) / 180));
  return { latitude, longitude, latitudeDelta, longitudeDelta };
}
