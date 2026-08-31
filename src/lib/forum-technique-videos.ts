export const TECHNIQUE_VIDEO_CATEGORIES = ["derribes", "sumisiones"] as const;

export type TechniqueVideoCategory = (typeof TECHNIQUE_VIDEO_CATEGORIES)[number];

export type ForumTechniqueVideo = {
  id: string;
  name: string;
  repertoireName: string;
  category: TechniqueVideoCategory;
  family: string;
  youtubeId: string;
  sourceUrl: string;
  note?: string;
};

export const FORUM_TECHNIQUE_VIDEOS: ForumTechniqueVideo[] = [
  {
    id: "harai-goshi",
    name: "Harai goshi",
    repertoireName: "Harai goshi",
    category: "derribes",
    family: "Cadera y barrido",
    youtubeId: "z6QykfA4lm8",
    sourceUrl: "https://youtube.com/shorts/z6QykfA4lm8",
  },
  {
    id: "uchi-mata",
    name: "Uchi mata",
    repertoireName: "Uchi mata",
    category: "derribes",
    family: "Pierna interior",
    youtubeId: "jwYEJRk5a_k",
    sourceUrl: "https://youtube.com/shorts/jwYEJRk5a_k",
  },
  {
    id: "o-soto-gari",
    name: "O-soto-gari",
    repertoireName: "O-soto-gari",
    category: "derribes",
    family: "Segado exterior",
    youtubeId: "P-8eFap4aUQ",
    sourceUrl: "https://youtube.com/shorts/P-8eFap4aUQ",
  },
  {
    id: "tani-otoshi",
    name: "Tani otoshi",
    repertoireName: "Tani otoshi",
    category: "derribes",
    family: "Sacrificio lateral",
    youtubeId: "vc0z1W3vObE",
    sourceUrl: "https://youtube.com/shorts/vc0z1W3vObE",
  },
  {
    id: "ippon-seoi-nage",
    name: "Ippon seoi nage",
    repertoireName: "Ippon seoi nage",
    category: "derribes",
    family: "Proyección de hombro",
    youtubeId: "5CfFMqH4Z0E",
    sourceUrl: "https://youtube.com/shorts/5CfFMqH4Z0E",
  },
  {
    id: "ashi-barai",
    name: "Ashi barai",
    repertoireName: "Ashi barai",
    category: "derribes",
    family: "Barrido de pie",
    youtubeId: "0rpxqoFWoT0",
    sourceUrl: "https://youtube.com/shorts/0rpxqoFWoT0",
  },
  {
    id: "sode-tsurikomi-goshi",
    name: "Sode tsurikomi goshi",
    repertoireName: "Sode tsurikomi goshi",
    category: "derribes",
    family: "Cadera y mangas",
    youtubeId: "dQNqYIKMh_c",
    sourceUrl: "https://youtube.com/shorts/dQNqYIKMh_c",
  },
  {
    id: "kata-guruma",
    name: "Kata guruma",
    repertoireName: "Kata guruma",
    category: "derribes",
    family: "Rueda de hombros",
    youtubeId: "HjWwnW5kVCQ",
    sourceUrl: "https://youtube.com/shorts/HjWwnW5kVCQ",
  },
  {
    id: "o-guruma",
    name: "O-guruma",
    repertoireName: "O-guruma",
    category: "derribes",
    family: "Rueda exterior",
    youtubeId: "fHrkjTGiJzI",
    sourceUrl: "https://youtube.com/shorts/fHrkjTGiJzI",
  },
  {
    id: "sasae-tsurikomi-ashi",
    name: "Sasae tsurikomi ashi",
    repertoireName: "Sasae tsurikomi ashi",
    category: "derribes",
    family: "Bloqueo de pie",
    youtubeId: "dRhr0OEKidY",
    sourceUrl: "https://youtube.com/shorts/dRhr0OEKidY",
  },
];

export function extractYouTubeVideoId(value: unknown): string {
  if (typeof value !== "string") return "";
  const input = value.trim();
  if (/^[A-Za-z0-9_-]{11}$/.test(input)) return input;

  try {
    const url = new URL(input);
    const host = url.hostname.replace(/^www\./, "").toLowerCase();
    let candidate = "";

    if (host === "youtu.be") candidate = url.pathname.split("/").filter(Boolean)[0] || "";
    if (host === "youtube.com" || host === "m.youtube.com") {
      if (url.pathname === "/watch") candidate = url.searchParams.get("v") || "";
      else if (url.pathname.startsWith("/shorts/") || url.pathname.startsWith("/embed/")) {
        candidate = url.pathname.split("/").filter(Boolean)[1] || "";
      }
    }

    return /^[A-Za-z0-9_-]{11}$/.test(candidate) ? candidate : "";
  } catch {
    return "";
  }
}

export function youtubeEmbedUrl(videoId: string): string {
  const safeId = extractYouTubeVideoId(videoId);
  return safeId
    ? `https://www.youtube-nocookie.com/embed/${safeId}?rel=0&playsinline=1`
    : "";
}

export function youtubeThumbnailUrl(videoId: string): string {
  const safeId = extractYouTubeVideoId(videoId);
  return safeId ? `https://i.ytimg.com/vi/${safeId}/hqdefault.jpg` : "";
}

function normalizeTechniqueName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function findForumTechniqueVideo(
  techniqueName: string,
  videos: ForumTechniqueVideo[] = FORUM_TECHNIQUE_VIDEOS,
): ForumTechniqueVideo | undefined {
  const requested = normalizeTechniqueName(techniqueName);
  if (!requested) return undefined;

  return videos.find((video) => {
    const names = [video.name, video.repertoireName].map(normalizeTechniqueName);
    return names.some(
      (candidate) =>
        requested === candidate ||
        requested.startsWith(`${candidate} `) ||
        candidate.startsWith(`${requested} `),
    );
  });
}

export function duplicateTechniqueVideoIds(videos: ForumTechniqueVideo[] = FORUM_TECHNIQUE_VIDEOS) {
  const occurrences = new Map<string, string[]>();
  videos.forEach((video) => {
    const names = occurrences.get(video.youtubeId) || [];
    names.push(video.name);
    occurrences.set(video.youtubeId, names);
  });
  return [...occurrences.entries()]
    .filter(([, names]) => names.length > 1)
    .map(([youtubeId, names]) => ({ youtubeId, names }));
}
