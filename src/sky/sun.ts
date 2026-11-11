/**
 * The sun's position seen from a place at an instant, by NOAA's solar position
 * algorithm (S-008: the equations of NOAA's Solar Calculator, after Meeus,
 * "Astronomical Algorithms"). Accurate to about 0.01° between 1800 and 2100, far
 * finer than a pixel. Checked against an independent ephemeris (S-012) in
 * tests/sun.test.ts.
 *
 * Determinism: this uses `Math.sin` and friends, whose last bit may differ between
 * engines. That is allowed because the sun only animates the scene (light, sky); it
 * must never decide what the world contains (AGENTS.md § Determinism).
 */

export interface SunPosition {
  /**
   * Apparent elevation above the horizon, degrees, refraction included; < 0 below
   * it. What the eye sees: the sun's centre is still visible at 0°.
   */
  readonly elevationDeg: number;
  /**
   * Geometric elevation, degrees, without refraction: the one twilight is defined by
   * (civil −6°, nautical −12°, astronomical −18°).
   */
  readonly geometricElevationDeg: number;
  /** Azimuth, degrees clockwise from true north (90 = east, 180 = south). */
  readonly azimuthDeg: number;
}

const RAD = Math.PI / 180;
const MS_PER_DAY = 86_400_000;
/** Julian Day of the Unix epoch (1970-01-01T00:00Z). */
const JD_UNIX_EPOCH = 2_440_587.5;
/** Julian Day of J2000.0. */
const JD_J2000 = 2_451_545;

const sin = (deg: number): number => Math.sin(deg * RAD);
const cos = (deg: number): number => Math.cos(deg * RAD);
const tan = (deg: number): number => Math.tan(deg * RAD);

/** `x` modulo `m`, in [0, m). */
function mod(x: number, m: number): number {
  return ((x % m) + m) % m;
}

/**
 * Atmospheric refraction, degrees, for a geometric elevation in degrees (NOAA's
 * piecewise fit; none above 85°).
 */
function refractionDeg(elevation: number): number {
  if (elevation > 85) return 0;
  const t = tan(elevation);
  let arcSeconds: number;
  if (elevation > 5) arcSeconds = 58.1 / t - 0.07 / t ** 3 + 0.000086 / t ** 5;
  else if (elevation > -0.575)
    arcSeconds =
      1735 + elevation * (-518.2 + elevation * (103.4 + elevation * (-12.79 + elevation * 0.711)));
  else arcSeconds = -20.774 / t;
  return arcSeconds / 3600;
}

/**
 * The sun's position at `timeMs` (ms since the epoch, UTC) seen from `latitude`,
 * `longitude` (degrees, east positive). `null` for a non-finite input or an
 * impossible position.
 */
export function sunPosition(
  timeMs: number,
  latitude: number,
  longitude: number,
): SunPosition | null {
  if (!Number.isFinite(timeMs) || !Number.isFinite(latitude) || !Number.isFinite(longitude))
    return null;
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;

  // Julian centuries since J2000.0.
  const t = (timeMs / MS_PER_DAY + JD_UNIX_EPOCH - JD_J2000) / 36_525;

  const meanLongitude = mod(280.46646 + t * (36_000.76983 + t * 0.0003032), 360);
  const meanAnomaly = 357.52911 + t * (35_999.05029 - 0.0001537 * t);
  const eccentricity = 0.016708634 - t * (0.000042037 + 0.0000001267 * t);
  const equationOfCenter =
    sin(meanAnomaly) * (1.914602 - t * (0.004817 + 0.000014 * t)) +
    sin(2 * meanAnomaly) * (0.019993 - 0.000101 * t) +
    sin(3 * meanAnomaly) * 0.000289;
  const omega = 125.04 - 1934.136 * t;
  const apparentLongitude = meanLongitude + equationOfCenter - 0.00569 - 0.00478 * sin(omega);
  const meanObliquity =
    23 + (26 + (21.448 - t * (46.815 + t * (0.00059 - t * 0.001813))) / 60) / 60;
  const obliquity = meanObliquity + 0.00256 * cos(omega);
  const declination = Math.asin(sin(obliquity) * sin(apparentLongitude)) / RAD;

  // Equation of time, minutes: how far the true sun runs ahead of the mean sun.
  const y = tan(obliquity / 2) ** 2;
  const equationOfTime =
    (4 / RAD) *
    (y * sin(2 * meanLongitude) -
      2 * eccentricity * sin(meanAnomaly) +
      4 * eccentricity * y * sin(meanAnomaly) * cos(2 * meanLongitude) -
      0.5 * y * y * sin(4 * meanLongitude) -
      1.25 * eccentricity * eccentricity * sin(2 * meanAnomaly));

  const utcMinutes = mod(timeMs, MS_PER_DAY) / 60_000;
  const trueSolarMinutes = mod(utcMinutes + equationOfTime + 4 * longitude, 1440);
  const hourAngle = trueSolarMinutes / 4 - 180;

  const cosZenith = Math.min(
    1,
    Math.max(
      -1,
      sin(latitude) * sin(declination) + cos(latitude) * cos(declination) * cos(hourAngle),
    ),
  );
  const geometricElevation = 90 - Math.acos(cosZenith) / RAD;
  const azimuth = mod(
    Math.atan2(sin(hourAngle), cos(hourAngle) * sin(latitude) - tan(declination) * cos(latitude)) /
      RAD +
      180,
    360,
  );
  return {
    elevationDeg: geometricElevation + refractionDeg(geometricElevation),
    geometricElevationDeg: geometricElevation,
    azimuthDeg: azimuth,
  };
}
