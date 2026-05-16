const CDN_BASE = 'https://cdn.sogni.ai/video-samples';
export const DANCE_PRESETS = [
    {
        id: 'rasputin',
        title: 'Boney M - Rasputin',
        description: 'Viral Russian TikTok Dance',
        videoUrl: `${CDN_BASE}/rasputin.mp4`,
        maxDuration: 32,
    },
    {
        id: 'big-guy',
        title: 'Ice Spice - Big Guy',
        description: 'From "The SpongeBob Movie: Search for SquarePants" movie',
        videoUrl: `${CDN_BASE}/big-guy-dance.mp4`,
        maxDuration: 11,
    },
    {
        id: 'keep-it-gangsta',
        title: 'Nhale ft. Dezzy Hollow - Keep it Gangsta',
        description: 'Hip-hop gangsta dance',
        videoUrl: `${CDN_BASE}/dance-keep-it-gangsta.mp4`,
        maxDuration: 21,
    },
    {
        id: 'this-is-america',
        title: 'Childish Gambino - This Is America',
        description: 'Iconic choreography from the This Is America music video',
        videoUrl: `${CDN_BASE}/this-is-america.mp4`,
        maxDuration: 22,
    },
    {
        id: 'chinese-new-year',
        title: '弥渡山歌 (Midu Echoing) - Dan Thy',
        description: 'Chinese New Year Dance, Chinese Military Dance Trend',
        videoUrl: `${CDN_BASE}/chinese-new-year-dance.mp4`,
        maxDuration: 18,
    },
    {
        id: 'spongebob',
        title: 'SpongeBob - Stadium Rave',
        description: 'Jellyfish Jam Dance from SpongeBob SquarePants',
        videoUrl: `${CDN_BASE}/spongebob-dance.mp4`,
        maxDuration: 27,
    },
    {
        id: 'chanel',
        title: 'Tyla - Chanel',
        description: 'Put me in Chanel dance',
        videoUrl: `${CDN_BASE}/chanel.mp4`,
        maxDuration: 14,
    },
    {
        id: 'crystal-light-aerobics-1988',
        title: 'Crystal Light National Aerobics Championship 1988',
        description: '80s aerobics dance from the 1988 Crystal Light National Aerobics Championship',
        videoUrl: `${CDN_BASE}/crystal-light-aerobics-1988.mp4`,
        maxDuration: 52,
    },
    {
        id: 'plastic-dream-sequence',
        title: 'Metric - Black Sheep',
        description: 'Barbie plastic dream sequence dance',
        videoUrl: `${CDN_BASE}/plastic-dream-sequence-centered.mp4`,
        maxDuration: 28,
        aliases: ['metric', 'black sheep', 'barbie', 'plastic dream'],
    },
];
export function resolveDancePresetForRequest(text, args) {
    const explicitDance = typeof args?.dance === 'string' ? args.dance.trim() : '';
    if (explicitDance) {
        return DANCE_PRESETS.find(preset => preset.id === explicitDance) || null;
    }
    if (!text)
        return null;
    for (const preset of DANCE_PRESETS) {
        if (!preset.aliases?.length)
            continue;
        for (const alias of preset.aliases) {
            const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
            if (new RegExp(`\\b${escaped}\\b`, 'i').test(text))
                return preset;
        }
    }
    return null;
}
//# sourceMappingURL=dances.js.map