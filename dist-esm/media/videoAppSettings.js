import { LTX23_DEV_MODEL_IDS, LTX23_DISTILLED_MODEL_IDS, } from './videoSettings.js';
export var T2VModel;
(function (T2VModel) {
    T2VModel["speed"] = "wan_v2.2-14b-fp8_t2v_lightx2v";
    T2VModel["quality"] = "wan_v2.2-14b-fp8_t2v";
})(T2VModel || (T2VModel = {}));
export var I2VModel;
(function (I2VModel) {
    I2VModel["speed"] = "wan_v2.2-14b-fp8_i2v_lightx2v";
    I2VModel["quality"] = "wan_v2.2-14b-fp8_i2v";
})(I2VModel || (I2VModel = {}));
export var AnimateMoveModel;
(function (AnimateMoveModel) {
    AnimateMoveModel["speed"] = "wan_v2.2-14b-fp8_animate-move_lightx2v";
})(AnimateMoveModel || (AnimateMoveModel = {}));
export var AnimateReplaceModel;
(function (AnimateReplaceModel) {
    AnimateReplaceModel["speed"] = "wan_v2.2-14b-fp8_animate-replace_lightx2v";
})(AnimateReplaceModel || (AnimateReplaceModel = {}));
export const LTX2VideoModels = {
    speedA2V: [LTX23_DISTILLED_MODEL_IDS.a2v, 'ltx2-19b-fp8_a2v_distilled'],
    speedIA2V: [LTX23_DISTILLED_MODEL_IDS.ia2v, 'ltx2-19b-fp8_ia2v_distilled'],
    speedI2V: [LTX23_DISTILLED_MODEL_IDS.i2v, 'ltx2-19b-fp8_i2v_distilled'],
    speedT2V: [LTX23_DISTILLED_MODEL_IDS.t2v, 'ltx2-19b-fp8_t2v_distilled'],
    speedV2V: ['ltx2-19b-fp8_v2v_distilled'],
    qualityA2V: [LTX23_DEV_MODEL_IDS.a2v],
    qualityIA2V: [LTX23_DEV_MODEL_IDS.ia2v],
    qualityI2V: [LTX23_DEV_MODEL_IDS.i2v, 'ltx2-19b-fp8_i2v'],
    qualityT2V: [LTX23_DEV_MODEL_IDS.t2v, 'ltx2-19b-fp8_t2v'],
    qualityV2V: ['ltx2-19b-fp8_v2v'],
};
export const STEPS_CONFIG = {
    speed: {
        range: [4, 8],
        default: 4,
    },
    quality: {
        range: [20, 40],
        default: 20,
    },
};
export const DURARION_RANGE = {
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
export const DURATION_RANGE_ANIMATE = {
    full: [1, WAN_ANIMATE_MAX_DURATION],
    optimal: [3, 14],
};
const LTX2_DISTILLED_MAX_FRAMES = 505;
const LTX2_QUALITY_MAX_FRAMES = 257;
export const DURATION_RANGE_LTX2 = {
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
//# sourceMappingURL=videoAppSettings.js.map