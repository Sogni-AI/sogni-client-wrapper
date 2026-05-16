export interface EnhancementProfile {
  id: string;
  title: string;
  prompt: string;
}

export interface EnhancementCategory {
  id: string;
  title: string;
  profiles: readonly EnhancementProfile[];
}

export const CONTEXT_MODELS = [
  'flux1-dev-kontext_fp8_scaled',
  'qwen_image_edit_2511_fp8',
  'qwen_image_edit_2511_fp8_lightning',
] as const;

export const ENHANCER_LABELS: Record<string, string> = {
  'flux1-schnell-fp8': 'FLUX.1 [schnell]',
  z_image_turbo_bf16: 'Z-Image Turbo',
};

export const ENHANCER_MODEL = 'qwen_image_edit_2511_fp8_lightning';

export const ENHANCE_PROFILES = [
  {
    id: 'realism',
    title: 'Realism',
    profiles: [
      {
        id: 'addPhotorealism',
        title: 'Boost Realism',
        prompt: 'soften focus, more realistic lighting and materials, increased photorealistic appearance',
      },
      {
        id: 'professionalPostproducedRealism',
        title: 'Pro Post-Processed',
        prompt:
          'professional post-production finish, refined lighting and shadows, clean tonal balance, realistic color grading, subtle contrast and clarity, polished textures, preserve subject identity and composition, increased photorealistic appearance',
      },
      {
        id: 'smartphoneRealism',
        title: 'Smartphone Camera Look',
        prompt:
          'realistic smartphone photo look, natural handheld capture, slightly sharpened details, mild HDR highlights and shadows, realistic color and exposure, subtle noise, preserve subject and composition, increased photorealistic appearance',
      },
      {
        id: 'cinematicRealism',
        title: 'Cinematic Realism',
        prompt:
          'cinematic realistic look, film-style lighting and contrast, natural depth and shadow shaping, increased photorealistic appearance, subtle color grading, refined highlights, realistic textures, preserve subject identity and composition',
      },
      {
        id: 'flashPhotoRealism',
        title: 'Flash Photo Look',
        prompt:
          'direct flash photography look, realistic harsh lighting and shadows, flat exposure with strong highlights, increased photorealistic appearance, slight noise, candid photo feel, preserve subject and scene',
      },
    ],
  },
  {
    id: 'detailing',
    title: 'Fine Details',
    profiles: [
      {
        id: 'refineDetails',
        title: 'Refine Fine Details',
        prompt:
          'refine existing fine details, enhance micro-textures and subtle surface features, improve clarity of small details, polish unfinished areas',
      },
      {
        id: 'enrichDetails',
        title: 'Enrich Scene Details',
        prompt:
          'add cohesive, scene-wide detail across foreground and background, enrich environmental textures and materials, enhance lighting, shadows, and depth, increase atmospheric and spatial detail, maintain overall composition and subject integrity',
      },
    ],
  },
  {
    id: 'focus',
    title: 'Focus',
    profiles: [
      {
        id: 'softenFocus',
        title: 'Soften Focus',
        prompt: 'slightly soften focus, smoother transitions, natural depth',
      },
      {
        id: 'sharpenFocus',
        title: 'Sharpen Focus',
        prompt: 'increase sharpness, clearer edges, enhanced fine details',
      },
      {
        id: 'cinematicFocus',
        title: 'Cinematic Focus',
        prompt: 'apply shallow depth of field, softly blurred background, focused subject',
      },
    ],
  },
  {
    id: 'blur',
    title: 'Blur',
    profiles: [
      {
        id: 'gaussianBlur',
        title: 'Soft Blur',
        prompt: 'apply subtle soft blur, gentle smoothing, minimal detail loss',
      },
      {
        id: 'motionBlur',
        title: 'Motion Blur',
        prompt: 'add light motion blur, sense of movement, dynamic feel',
      },
    ],
  },
  {
    id: 'resolution',
    title: 'Resolution',
    profiles: [
      {
        id: 'loFi',
        title: 'Lo-Fi',
        prompt: 'lo-fi look, reduced clarity, muted tones, slight imperfections',
      },
      {
        id: 'increaseResolution',
        title: 'Increase Resolution',
        prompt: 'increase perceived resolution, enhance clarity and fine detail, cleaner image',
      },
    ],
  },
  {
    id: 'colorTone',
    title: 'Color & Tone',
    profiles: [
      {
        id: 'desaturateColors',
        title: 'Desaturate Colors',
        prompt: 'slightly desaturate colors, more muted and natural palette',
      },
      {
        id: 'saturateColors',
        title: 'Saturate Colors',
        prompt: 'increase color saturation, richer and more vibrant tones',
      },
      {
        id: 'cinematicTone',
        title: 'Cinematic Tone',
        prompt: 'add subtle cinematic color grading, balanced contrast, film-like tones',
      },
      {
        id: 'blackAndWhite',
        title: 'Black & White',
        prompt: 'convert to black and white, neutral grayscale tones, balanced contrast, preserve detail',
      },
      {
        id: 'sepia',
        title: 'Sepia',
        prompt: 'apply a subtle sepia tone, warm brown highlights, soft shadows, vintage feel',
      },
      {
        id: 'color',
        title: 'Natural Color',
        prompt: 'restore natural color, realistic tones, balanced saturation, accurate skin tones',
      },
    ],
  },
  {
    id: 'contrast',
    title: 'Contrast',
    profiles: [
      {
        id: 'increaseContrast',
        title: 'Increase Contrast',
        prompt: 'increase contrast, deeper shadows, brighter highlights',
      },
      {
        id: 'reduceContrast',
        title: 'Reduce Contrast',
        prompt: 'reduce contrast, softer highlights and shadows, smoother tonal transitions',
      },
    ],
  },
  {
    id: 'noise',
    title: 'Noise',
    profiles: [
      {
        id: 'reduceNoise',
        title: 'Reduce Noise',
        prompt: 'reduce visual noise, smoother gradients, cleaner image',
      },
      {
        id: 'filmGrain',
        title: 'Film Grain',
        prompt: 'add subtle film grain, analog film-like feel',
      },
    ],
  },
  {
    id: 'restoration',
    title: 'Restoration',
    profiles: [
      {
        id: 'restoreOldPhoto',
        title: 'Restore Old Photo',
        prompt:
          'restore and modernize the image, improve clarity and sharpness, repair faded tones, enhance contrast and detail, reduce noise and artifacts, maintain original features and identity',
      },
      {
        id: 'vintageFilmLook',
        title: 'Vintage Look',
        prompt:
          'vintage film photo look, aged color response, gentle contrast, subtle film grain, soft highlights, slight fading, mild vignetting, realistic textures, preserve subject and composition',
      },
    ],
  },
] as const satisfies readonly EnhancementCategory[];

export function getEnhancementPrompt(categoryId: string, profileId: string): string {
  const category = ENHANCE_PROFILES.find((c) => c.id === categoryId);
  if (!category) {
    throw new Error('Enhancer category not found');
  }
  const profile = category.profiles.find((p) => p.id === profileId);
  if (!profile) {
    throw new Error('Enhancer profile not found');
  }
  return profile.prompt;
}

export function getEnhancementStrength(strength: string): number {
  switch (strength) {
    case 'light':
      return 0.15;
    case 'heavy':
      return 0.49;
    default:
      return 0.35;
  }
}

export const getEnhacementStrength = getEnhancementStrength;
