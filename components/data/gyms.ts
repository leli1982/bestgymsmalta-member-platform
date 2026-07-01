export type GymStatus = "active" | "coming_soon";

export type Gym = {
  id: string;
  name: string;
  shortName: string;
  status: GymStatus;

  city: string;
  address: string;

  latitude?: number;
  longitude?: number;

  openingHours: string;
  phone?: string;
  email?: string;

  logo?: string;
  heroImage?: string;
  passportStamp?: string;

  accentColor: string;
  qrCodeId: string;

  facilities: string[];
  classes: string[];

  featuredEquipment?: string[];
  notes?: string;
};

export const gyms: Gym[] = [
  {
    id: "bgm-birkirkara",
    name: "Birkirkara Fitness",
    shortName: "Birkirkara",
    status: "active",
    city: "Birkirkara",
    address: "Birkirkara, Malta",
    openingHours: "Opening hours coming soon",
    accentColor: "#F97316",
    qrCodeId: "BGM-BIRKIRKARA",
    facilities: ["Cardio", "Free Weights", "Machines"],
    classes: [],
  },
  {
    id: "bgm-birgu",
    name: "Birgu Fitness",
    shortName: "Birgu",
    status: "coming_soon",
    city: "Birgu",
    address: "Birgu, Malta",
    openingHours: "Coming soon",
    accentColor: "#F97316",
    qrCodeId: "BGM-BIRGU",
    facilities: [],
    classes: [],
  },
  {
    id: "bgm-birzebbuga",
    name: "Birzebbuga Fitness",
    shortName: "Birzebbuga",
    status: "active",
    city: "Birzebbuga",
    address: "Birzebbuga, Malta",
    openingHours: "Opening hours coming soon",
    accentColor: "#F97316",
    qrCodeId: "BGM-BIRZEBBUGA",
    facilities: ["Cardio", "Free Weights", "Machines"],
    classes: [],
  },
  {
    id: "bgm-build",
    name: "Build Fitness",
    shortName: "Build",
    status: "active",
    city: "Malta",
    address: "Malta",
    openingHours: "Opening hours coming soon",
    accentColor: "#F97316",
    qrCodeId: "BGM-BUILD",
    facilities: ["Cardio", "Free Weights", "Machines"],
    classes: [],
  },
  {
    id: "bgm-kirkop",
    name: "Kirkop Fitness",
    shortName: "Kirkop",
    status: "active",
    city: "Kirkop",
    address: "Kirkop, Malta",
    openingHours: "Opening hours coming soon",
    accentColor: "#F97316",
    qrCodeId: "BGM-KIRKOP",
    facilities: ["Cardio", "Free Weights", "Machines"],
    classes: [],
  },
  {
    id: "bgm-marsa",
    name: "Marsa Fitness",
    shortName: "Marsa",
    status: "active",
    city: "Marsa",
    address: "Marsa, Malta",
    openingHours: "Opening hours coming soon",
    accentColor: "#F97316",
    qrCodeId: "BGM-MARSA",
    facilities: ["Cardio", "Free Weights", "Machines"],
    classes: [],
  },
  {
    id: "bgm-marsascala",
    name: "Marsascala Fitness",
    shortName: "Marsascala",
    status: "coming_soon",
    city: "Marsascala",
    address: "Marsascala, Malta",
    openingHours: "Coming soon",
    accentColor: "#F97316",
    qrCodeId: "BGM-MARSASCALA",
    facilities: [],
    classes: [],
  },
  {
    id: "bgm-neptunes",
    name: "Neptunes Fitness",
    shortName: "Neptunes",
    status: "active",
    city: "St Julian's",
    address: "St Julian's, Malta",
    openingHours: "Opening hours coming soon",
    accentColor: "#F97316",
    qrCodeId: "BGM-NEPTUNES",
    facilities: ["Cardio", "Free Weights", "Machines"],
    classes: [],
  },
  {
    id: "bgm-pembroke",
    name: "Pembroke Fitness",
    shortName: "Pembroke",
    status: "active",
    city: "Pembroke",
    address: "Pembroke, Malta",
    openingHours: "Opening hours coming soon",
    accentColor: "#F97316",
    qrCodeId: "BGM-PEMBROKE",
    facilities: ["Cardio", "Free Weights", "Machines"],
    classes: [],
  },
  {
    id: "bgm-sliema",
    name: "Sliema Fitness",
    shortName: "Sliema",
    status: "active",
    city: "Sliema",
    address: "Sliema, Malta",
    openingHours: "Opening hours coming soon",
    accentColor: "#F97316",
    qrCodeId: "BGM-SLIEMA",
    facilities: ["Cardio", "Free Weights", "Machines"],
    classes: [],
  },
  {
    id: "bgm-talqroqq",
    name: "Tal-Qroqq Fitness",
    shortName: "Tal-Qroqq",
    status: "active",
    city: "Tal-Qroqq",
    address: "Tal-Qroqq, Malta",
    openingHours: "Opening hours coming soon",
    accentColor: "#F97316",
    qrCodeId: "BGM-TALQROQQ",
    facilities: ["Cardio", "Free Weights", "Machines"],
    classes: [],
  },
];

export const activeGyms = gyms.filter((gym) => gym.status === "active");

export const comingSoonGyms = gyms.filter(
  (gym) => gym.status === "coming_soon"
);

export function getGymById(id: string) {
  return gyms.find((gym) => gym.id === id);
}