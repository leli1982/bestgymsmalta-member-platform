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

const defaultFacilities = [
  "Cardio Area",
  "Free Weights",
  "Resistance Machines",
  "Functional Training",
  "Changing Area",
];

export const gyms: Gym[] = [
  {
    id: "bgm-birkirkara",
    name: "Birkirkara Fitness",
    shortName: "Birkirkara",
    status: "active",
    city: "Birkirkara",
    address: "Birkirkara Fitness, Birkirkara, Malta",
    openingHours: "Opening hours coming soon",
    accentColor: "#F97316",
    qrCodeId: "BGM-BIRKIRKARA",
    facilities: defaultFacilities,
    classes: [],
    featuredEquipment: ["Cardio machines", "Strength machines", "Free weights"],
    notes:
      "A central BestGymsMalta location for members training in and around Birkirkara.",
  },
  {
    id: "bgm-birgu",
    name: "Birgu Fitness",
    shortName: "Birgu",
    status: "coming_soon",
    city: "Birgu",
    address: "Birgu Fitness, Birgu, Malta",
    openingHours: "Coming soon",
    accentColor: "#F97316",
    qrCodeId: "BGM-BIRGU",
    facilities: [],
    classes: [],
    notes:
      "This location is planned as part of the BestGymsMalta network expansion. More details will be announced soon.",
  },
  {
    id: "bgm-birzebbuga",
    name: "Birzebbuga Fitness",
    shortName: "Birzebbuga",
    status: "active",
    city: "Birzebbuga",
    address: "BGM Birzebbuga Fitness, Birzebbuga Aquatic Sports Club, Il-Bajja s-Sabiha, Birzebbuga, Malta",
    latitude: 35.82577841973018,
    longitude: 14.530766859040666,
    openingHours: "Mon–Fri: 06:00–22:00 • Sat: 07:30–16:30 • Sun & Public Holidays: 07:30–12:30",
    accentColor: "#F97316",
    qrCodeId: "BGM-BIRZEBBUGA",
    facilities: defaultFacilities,
    classes: [],
    featuredEquipment: ["Cardio machines", "Free weights", "Strength equipment"],
    notes:
      "A south Malta BestGymsMalta location giving members convenient access in the Birzebbuga area.",
  },
  {
    id: "bgm-build",
    name: "Build Fitness",
    shortName: "Build",
    status: "active",
    city: "Malta",
    address: "Build Fitness, Malta",
    openingHours: "Opening hours coming soon",
    accentColor: "#F97316",
    qrCodeId: "BGM-BUILD",
    facilities: defaultFacilities,
    classes: [],
    featuredEquipment: ["Strength machines", "Free weights", "Functional area"],
    notes:
      "Build Fitness is part of the BestGymsMalta member network, giving members more choice and flexibility.",
  },
  {
    id: "bgm-kirkop",
    name: "Kirkop Fitness",
    shortName: "Kirkop",
    status: "active",
    city: "Kirkop",
    address: "Kirkop Fitness, Kirkop, Malta",
    openingHours: "Opening hours coming soon",
    accentColor: "#F97316",
    qrCodeId: "BGM-KIRKOP",
    facilities: defaultFacilities,
    classes: [],
    featuredEquipment: ["Cardio machines", "Resistance machines", "Free weights"],
    notes:
      "A convenient BestGymsMalta location for members training around Kirkop and nearby areas.",
  },
  {
    id: "bgm-marsa",
    name: "Marsa Fitness",
    shortName: "Marsa",
    status: "active",
    city: "Marsa",
    address: "Marsa Fitness, Marsa, Malta",
    openingHours: "Opening hours coming soon",
    accentColor: "#F97316",
    qrCodeId: "BGM-MARSA",
    facilities: [
      "Large Training Floor",
      "Cardio Area",
      "Free Weights",
      "Resistance Machines",
      "Functional Training",
      "Changing Area",
    ],
    classes: [],
    featuredEquipment: [
      "Cardio machines",
      "Plate-loaded equipment",
      "Free weights",
      "Functional training area",
    ],
    notes:
      "One of the major BestGymsMalta locations, designed for members who want a large and complete training environment.",
  },
  {
    id: "bgm-marsascala",
    name: "Marsascala Fitness",
    shortName: "Marsascala",
    status: "active",
    city: "Marsascala",
    address: "Marsascala Fitness, Marsascala, Malta",
    openingHours: "Opening hours coming soon",
    accentColor: "#F97316",
    qrCodeId: "BGM-MARSASCALA",
    facilities: defaultFacilities,
    classes: [],
    featuredEquipment: ["Cardio machines", "Free weights", "Resistance machines"],
    notes:
      "A BestGymsMalta location serving members in Marsascala and the surrounding south-east area.",
  },
  {
    id: "bgm-neptunes",
    name: "Neptunes Fitness",
    shortName: "Neptunes",
    status: "active",
    city: "St Julian's",
    address: "Neptunes Fitness, St Julian's, Malta",
    openingHours: "Opening hours coming soon",
    accentColor: "#F97316",
    qrCodeId: "BGM-NEPTUNES",
    facilities: defaultFacilities,
    classes: [],
    featuredEquipment: ["Cardio machines", "Strength machines", "Free weights"],
    notes:
      "A popular BestGymsMalta location in the St Julian's area, ideal for members training close to the coast.",
  },
  {
    id: "bgm-pembroke",
    name: "Pembroke Fitness",
    shortName: "Pembroke",
    status: "active",
    city: "Pembroke",
    address: "Pembroke Fitness, Pembroke, Malta",
    openingHours: "Opening hours coming soon",
    accentColor: "#F97316",
    qrCodeId: "BGM-PEMBROKE",
    facilities: defaultFacilities,
    classes: [],
    featuredEquipment: ["Cardio machines", "Resistance machines", "Free weights"],
    notes:
      "A BestGymsMalta location for members training in Pembroke and nearby areas.",
  },
  {
    id: "bgm-sliema",
    name: "Sliema Fitness",
    shortName: "Sliema",
    status: "active",
    city: "Sliema",
    address: "Sliema Fitness, Sliema, Malta",
    openingHours: "Opening hours coming soon",
    accentColor: "#F97316",
    qrCodeId: "BGM-SLIEMA",
    facilities: defaultFacilities,
    classes: [],
    featuredEquipment: ["Cardio machines", "Free weights", "Strength machines"],
    notes:
      "A BestGymsMalta location giving members convenient access in one of Malta's busiest central areas.",
  },
  {
    id: "bgm-talqroqq",
    name: "Tal-Qroqq Fitness",
    shortName: "Tal-Qroqq",
    status: "active",
    city: "Tal-Qroqq",
    address: "Tal-Qroqq Fitness, Tal-Qroqq, Malta",
    openingHours: "Opening hours coming soon",
    accentColor: "#F97316",
    qrCodeId: "BGM-TALQROQQ",
    facilities: defaultFacilities,
    classes: ["Spinning"],
    featuredEquipment: ["Cardio machines", "Free weights", "Strength machines"],
    notes:
      "A BestGymsMalta location close to the university and central areas, with a strong everyday training setup.",
  },
];

export const activeGyms = gyms.filter((gym) => gym.status === "active");

export const comingSoonGyms = gyms.filter(
  (gym) => gym.status === "coming_soon"
);

export function getGymById(id: string) {
  return gyms.find((gym) => gym.id === id);
}
