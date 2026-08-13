import {
  LTX25_DEV_WORKFLOW_MODELS,
  LTX25_DISTILLED_WORKFLOW_MODELS,
  LTX23_DEV_MODEL_IDS,
  LTX23_DISTILLED_MODEL_IDS,
} from './videoSettings.js';

export type VideoRenderMode = 'speed' | 'quality';
export type FPS = 16 | 24 | 25 | 30 | 32 | 50 | 60;
export type LTX2FPS = 24 | 25 | 30 | 50 | 60;

export enum T2VModel {
  speed = 'wan_v2.2-14b-fp8_t2v_lightx2v',
  quality = 'wan_v2.2-14b-fp8_t2v',
}

export enum I2VModel {
  speed = 'wan_v2.2-14b-fp8_i2v_lightx2v',
  quality = 'wan_v2.2-14b-fp8_i2v',
}

export enum AnimateMoveModel {
  speed = 'wan_v2.2-14b-fp8_animate-move_lightx2v',
}

export enum AnimateReplaceModel {
  speed = 'wan_v2.2-14b-fp8_animate-replace_lightx2v',
}

export const LTX2VideoModels = {
  speedA2V: [LTX25_DISTILLED_WORKFLOW_MODELS.a2v, LTX23_DISTILLED_MODEL_IDS.a2v, 'ltx2-19b-fp8_a2v_distilled'],
  speedIA2V: [LTX25_DISTILLED_WORKFLOW_MODELS.ia2v, LTX23_DISTILLED_MODEL_IDS.ia2v, 'ltx2-19b-fp8_ia2v_distilled'],
  speedI2V: [LTX25_DISTILLED_WORKFLOW_MODELS.i2v, LTX23_DISTILLED_MODEL_IDS.i2v, 'ltx2-19b-fp8_i2v_distilled'],
  speedT2V: [LTX25_DISTILLED_WORKFLOW_MODELS.t2v, LTX23_DISTILLED_MODEL_IDS.t2v, 'ltx2-19b-fp8_t2v_distilled'],
  speedV2V: [LTX25_DISTILLED_WORKFLOW_MODELS.v2v, 'ltx23-22b-fp8_v2v_distilled', 'ltx2-19b-fp8_v2v_distilled'],
  qualityA2V: [LTX25_DEV_WORKFLOW_MODELS.a2v, LTX23_DEV_MODEL_IDS.a2v],
  qualityIA2V: [LTX25_DEV_WORKFLOW_MODELS.ia2v, LTX23_DEV_MODEL_IDS.ia2v],
  qualityI2V: [LTX25_DEV_WORKFLOW_MODELS.i2v, LTX23_DEV_MODEL_IDS.i2v, 'ltx2-19b-fp8_i2v'],
  qualityT2V: [LTX25_DEV_WORKFLOW_MODELS.t2v, LTX23_DEV_MODEL_IDS.t2v, 'ltx2-19b-fp8_t2v'],
  qualityV2V: [LTX25_DEV_WORKFLOW_MODELS.v2v, 'ltx23-22b-fp8_v2v_dev', 'ltx2-19b-fp8_v2v'],
} as const;

export interface DurationRange {
  full: [number, number];
  optimal: [number, number];
}

export const STEPS_CONFIG: Record<VideoRenderMode, { range: [number, number]; default: number }> = {
  speed: {
    range: [4, 8],
    default: 4,
  },
  quality: {
    range: [20, 40],
    default: 20,
  },
};

// Name preserved for compatibility with existing apps.
export const DURARION_RANGE: Record<FPS, DurationRange> = {
  16: {
    full: [1, 10],
    optimal: [3, 7],
  },
  24: {
    full: [4, 20],
    optimal: [4, 12],
  },
  25: {
    full: [4, 20],
    optimal: [4, 12],
  },
  30: {
    full: [4, 20],
    optimal: [4, 12],
  },
  32: {
    full: [1, 10],
    optimal: [3, 5],
  },
  50: {
    full: [4, 20],
    optimal: [4, 12],
  },
  60: {
    full: [4, 20],
    optimal: [4, 12],
  },
};

const WAN_ANIMATE_MAX_DURATION = Math.floor(321 / 16);

export const DURATION_RANGE_ANIMATE: DurationRange = {
  full: [1, WAN_ANIMATE_MAX_DURATION],
  optimal: [3, 14],
};

const LTX2_DISTILLED_MAX_FRAMES = 505;
const LTX2_QUALITY_MAX_FRAMES = 257;

export const DURATION_RANGE_LTX2: Record<VideoRenderMode, Record<LTX2FPS, DurationRange>> = {
  speed: {
    24: {
      full: [1, Math.floor(LTX2_DISTILLED_MAX_FRAMES / 24)],
      optimal: [5, Math.floor(LTX2_DISTILLED_MAX_FRAMES / 24)],
    },
    25: {
      full: [1, Math.floor(LTX2_DISTILLED_MAX_FRAMES / 25)],
      optimal: [5, Math.floor(LTX2_DISTILLED_MAX_FRAMES / 25)],
    },
    30: {
      full: [1, Math.floor(LTX2_DISTILLED_MAX_FRAMES / 30)],
      optimal: [5, Math.floor(LTX2_DISTILLED_MAX_FRAMES / 30)],
    },
    50: {
      full: [1, Math.floor(LTX2_DISTILLED_MAX_FRAMES / 50)],
      optimal: [2, Math.floor(LTX2_DISTILLED_MAX_FRAMES / 50)],
    },
    60: {
      full: [1, Math.floor(LTX2_DISTILLED_MAX_FRAMES / 60)],
      optimal: [2, Math.floor(LTX2_DISTILLED_MAX_FRAMES / 60)],
    },
  },
  quality: {
    24: {
      full: [1, Math.floor(LTX2_QUALITY_MAX_FRAMES / 24)],
      optimal: [2, Math.floor(LTX2_QUALITY_MAX_FRAMES / 24)],
    },
    25: {
      full: [1, Math.floor(LTX2_QUALITY_MAX_FRAMES / 25)],
      optimal: [2, Math.floor(LTX2_QUALITY_MAX_FRAMES / 25)],
    },
    30: {
      full: [1, Math.floor(LTX2_QUALITY_MAX_FRAMES / 30)],
      optimal: [2, Math.floor(LTX2_QUALITY_MAX_FRAMES / 30)],
    },
    50: {
      full: [1, Math.floor(LTX2_QUALITY_MAX_FRAMES / 50)],
      optimal: [1, Math.floor(LTX2_QUALITY_MAX_FRAMES / 50)],
    },
    60: {
      full: [1, Math.floor(LTX2_QUALITY_MAX_FRAMES / 60)],
      optimal: [1, Math.floor(LTX2_QUALITY_MAX_FRAMES / 60)],
    },
  },
};
