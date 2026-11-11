/**
 * NOAA's own solar position code, as a naive reference for tests/sun.test.ts.
 *
 * Transcribed from https://gml.noaa.gov/grad/solcalc/main.js (S-008, read
 * 2026-11-11): `calcAzEl` and the functions it calls, with NOAA's names and steps
 * kept, typed, and the time zone fixed at UTC. A work of the US government, in the
 * public domain. Only the tests use it; the app uses src/sky/sun.ts.
 */
const degToRad = (a: number): number => (Math.PI * a) / 180;
const radToDeg = (a: number): number => (180 * a) / Math.PI;

function calcGeomMeanLongSun(t: number): number {
  let L0 = 280.46646 + t * (36000.76983 + t * 0.0003032);
  while (L0 > 360) L0 -= 360;
  while (L0 < 0) L0 += 360;
  return L0;
}
const calcGeomMeanAnomalySun = (t: number): number => 357.52911 + t * (35999.05029 - 0.0001537 * t);
const calcEccentricityEarthOrbit = (t: number): number =>
  0.016708634 - t * (0.000042037 + 0.0000001267 * t);
function calcSunEqOfCenter(t: number): number {
  const mrad = degToRad(calcGeomMeanAnomalySun(t));
  return (
    Math.sin(mrad) * (1.914602 - t * (0.004817 + 0.000014 * t)) +
    Math.sin(mrad + mrad) * (0.019993 - 0.000101 * t) +
    Math.sin(mrad + mrad + mrad) * 0.000289
  );
}
const calcSunTrueLong = (t: number): number => calcGeomMeanLongSun(t) + calcSunEqOfCenter(t);
function calcSunApparentLong(t: number): number {
  const omega = 125.04 - 1934.136 * t;
  return calcSunTrueLong(t) - 0.00569 - 0.00478 * Math.sin(degToRad(omega));
}
function calcMeanObliquityOfEcliptic(t: number): number {
  const seconds = 21.448 - t * (46.815 + t * (0.00059 - t * 0.001813));
  return 23 + (26 + seconds / 60) / 60;
}
function calcObliquityCorrection(t: number): number {
  const omega = 125.04 - 1934.136 * t;
  return calcMeanObliquityOfEcliptic(t) + 0.00256 * Math.cos(degToRad(omega));
}
function calcSunDeclination(t: number): number {
  const sint =
    Math.sin(degToRad(calcObliquityCorrection(t))) * Math.sin(degToRad(calcSunApparentLong(t)));
  return radToDeg(Math.asin(sint));
}
function calcEquationOfTime(t: number): number {
  const epsilon = calcObliquityCorrection(t);
  const l0 = calcGeomMeanLongSun(t);
  const e = calcEccentricityEarthOrbit(t);
  const m = calcGeomMeanAnomalySun(t);
  let y = Math.tan(degToRad(epsilon) / 2);
  y *= y;
  const sin2l0 = Math.sin(2 * degToRad(l0));
  const sinm = Math.sin(degToRad(m));
  const cos2l0 = Math.cos(2 * degToRad(l0));
  const sin4l0 = Math.sin(4 * degToRad(l0));
  const sin2m = Math.sin(2 * degToRad(m));
  const Etime =
    y * sin2l0 -
    2 * e * sinm +
    4 * e * y * sinm * cos2l0 -
    0.5 * y * y * sin4l0 -
    1.25 * e * e * sin2m;
  return radToDeg(Etime) * 4;
}
function calcRefraction(elev: number): number {
  if (elev > 85) return 0;
  const te = Math.tan(degToRad(elev));
  let correction: number;
  if (elev > 5)
    correction = 58.1 / te - 0.07 / (te * te * te) + 0.000086 / (te * te * te * te * te);
  else if (elev > -0.575)
    correction = 1735 + elev * (-518.2 + elev * (103.4 + elev * (-12.79 + elev * 0.711)));
  else correction = -20.774 / te;
  return correction / 3600;
}

/** NOAA's `calculate` + `calcAzEl` for an instant in ms since the epoch, at UTC. */
export function noaaAzEl(
  timeMs: number,
  latitude: number,
  longitude: number,
): { azimuth: number; elevation: number } {
  const day = Math.floor(timeMs / 86_400_000);
  const jday = day + 2_440_587.5; // NOAA's getJD for that date, at 0h UTC
  const localtime = (timeMs - day * 86_400_000) / 60_000; // minutes, zone 0
  const T = (jday + localtime / 1440 - 2451545) / 36525;

  const eqTime = calcEquationOfTime(T);
  const theta = calcSunDeclination(T);
  let trueSolarTime = localtime + eqTime + 4 * longitude;
  while (trueSolarTime > 1440) trueSolarTime -= 1440;
  let hourAngle = trueSolarTime / 4 - 180;
  if (hourAngle < -180) hourAngle += 360;
  let csz =
    Math.sin(degToRad(latitude)) * Math.sin(degToRad(theta)) +
    Math.cos(degToRad(latitude)) * Math.cos(degToRad(theta)) * Math.cos(degToRad(hourAngle));
  csz = Math.min(1, Math.max(-1, csz));
  const zenith = radToDeg(Math.acos(csz));
  const azDenom = Math.cos(degToRad(latitude)) * Math.sin(degToRad(zenith));
  let azimuth: number;
  if (Math.abs(azDenom) > 0.001) {
    let azRad =
      (Math.sin(degToRad(latitude)) * Math.cos(degToRad(zenith)) - Math.sin(degToRad(theta))) /
      azDenom;
    azRad = Math.min(1, Math.max(-1, azRad));
    azimuth = 180 - radToDeg(Math.acos(azRad));
    if (hourAngle > 0) azimuth = -azimuth;
  } else {
    azimuth = latitude > 0 ? 180 : 0;
  }
  if (azimuth < 0) azimuth += 360;
  const exoatmElevation = 90 - zenith;
  return { azimuth, elevation: 90 - (zenith - calcRefraction(exoatmElevation)) };
}
