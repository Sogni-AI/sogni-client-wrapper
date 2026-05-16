export const CAMERA_ANGLE_LORA = {
  id: 'multiple_angles',
  defaultStrength: 0.9,
} as const;

export const AZIMUTHS = [
  { key: 'front', label: 'Front', prompt: 'front view', angle: 0 },
  { key: 'front-right', label: 'Front Right', prompt: 'front-right quarter view', angle: 45 },
  { key: 'right', label: 'Right', prompt: 'right side view', angle: 90 },
  { key: 'back-right', label: 'Back Right', prompt: 'back-right quarter view', angle: 135 },
  { key: 'back', label: 'Back', prompt: 'back view', angle: 180 },
  { key: 'back-left', label: 'Back Left', prompt: 'back-left quarter view', angle: 225 },
  { key: 'left', label: 'Left', prompt: 'left side view', angle: 270 },
  { key: 'front-left', label: 'Front Left', prompt: 'front-left quarter view', angle: 315 },
] as const;

export const ELEVATIONS = [
  { key: 'low-angle', label: 'Low Angle', prompt: 'low-angle shot', angle: -30 },
  { key: 'eye-level', label: 'Eye Level', prompt: 'eye-level shot', angle: 0 },
  { key: 'elevated', label: 'Elevated', prompt: 'elevated shot', angle: 30 },
  { key: 'high-angle', label: 'High Angle', prompt: 'high-angle shot', angle: 60 },
] as const;

export const DISTANCES = [
  { key: 'close-up', label: 'Close-up', prompt: 'close-up', scale: 0.6 },
  { key: 'medium', label: 'Medium', prompt: 'medium shot', scale: 1.0 },
  { key: 'wide', label: 'Wide', prompt: 'wide shot', scale: 1.8 },
] as const;

export type AzimuthKey = (typeof AZIMUTHS)[number]['key'];
export type ElevationKey = (typeof ELEVATIONS)[number]['key'];
export type DistanceKey = (typeof DISTANCES)[number]['key'];

export interface CameraAngleData {
  azimuth: AzimuthKey;
  elevation: ElevationKey;
  distance: DistanceKey;
}

export function getAzimuthConfig(key: AzimuthKey) {
  return AZIMUTHS.find((a) => a.key === key) || AZIMUTHS[0];
}

export function getElevationConfig(key: ElevationKey) {
  return ELEVATIONS.find((e) => e.key === key) || ELEVATIONS[1];
}

export function getDistanceConfig(key: DistanceKey) {
  return DISTANCES.find((d) => d.key === key) || DISTANCES[1];
}

export function buildCameraAnglePrompt(
  azimuth: AzimuthKey,
  elevation: ElevationKey,
  distance: DistanceKey,
): string {
  const azimuthConfig = getAzimuthConfig(azimuth);
  const elevationConfig = getElevationConfig(elevation);
  const distanceConfig = getDistanceConfig(distance);

  return `<sks> ${azimuthConfig.prompt} ${elevationConfig.prompt} ${distanceConfig.prompt}`;
}
