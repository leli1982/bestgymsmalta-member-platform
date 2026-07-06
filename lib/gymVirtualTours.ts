export const defaultGymTourLinks: Record<string, string> = {
  "bgm-talqroqq": "https://my.matterport.com/show/?m=mcqf1r934fB&play=1&qs=1",
  "bgm-birkirkara": "https://my.matterport.com/show/?m=yo8dbfqbqHQ&play=1&qs=1",
  "bgm-birzebbuga": "https://my.matterport.com/show/?m=6qK39DQ1379&play=1&qs=1",
  "bgm-build": "https://my.matterport.com/show/?m=ffCPVyFjR3P&play=1&qs=1",
  "bgm-kirkop": "https://my.matterport.com/show/?m=ZQRMmgRHk6G&play=1&qs=1",
  "bgm-marsa": "https://my.matterport.com/show/?m=xceozbh8LwW&play=1&qs=1",
  "bgm-neptunes": "https://my.matterport.com/show/?m=gLS3C2Gi5cF&play=1&qs=1",
  "bgm-pembroke": "https://my.matterport.com/show/?m=Pgd6FYMgZ2t&play=1&qs=1",
  "bgm-sliema": "https://my.matterport.com/show/?m=RXM25JipdP9&play=1&qs=1",
};

export type GymTourLike = {
  id: string;
  virtualTourUrl?: string | null;
  virtual_tour_url?: string | null;
};

export function getVirtualTourUrl(gym: GymTourLike) {
  return (
    gym.virtualTourUrl ||
    gym.virtual_tour_url ||
    defaultGymTourLinks[gym.id] ||
    ""
  );
}

export function hasVirtualTour(gym: GymTourLike) {
  return Boolean(getVirtualTourUrl(gym));
}
