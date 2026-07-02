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
    address: "Birkirkara Fitness Centre, Birkirkara, Malta",
    latitude: 35.894646617727055,
    longitude: 14.459193194765401,
    openingHours:
      "Mon–Fri: 05:00–23:00 • Sat: 07:00–20:00 • Sun & Public Holidays: 07:00–20:00",
    phone: "+356 21233351",
    logo: "/gym-logos/bgm-birkirkara.png",
    accentColor: "#F97316",
    qrCodeId: "BGM-BIRKIRKARA",
    facilities: [
      "Functional Area",
      "Boxing Area",
      "Cardio Area",
      "Strength Machines",
      "WiFi",
      "Showers",
      "Lockers",
    ],
    classes: [],
    featuredEquipment: ["Cardio machines", "Strength machines", "Free weights"],
    notes:
      "A central BestGymsMalta location for members training in and around Birkirkara.",
  },
  {
    id: "bgm-birzebbuga",
    name: "Birzebbuga Fitness",
    shortName: "Birzebbuga",
    status: "active",
    city: "Birzebbuga",
    address:
      "BGM Birzebbuga Fitness, Birzebbuga Aquatic Sports Club, Il-Bajja s-Sabiha, Birzebbuga, Malta",
    latitude: 35.82577841973018,
    longitude: 14.530766859040666,
    openingHours:
      "Mon–Fri: 06:00–22:00 • Sat: 07:30–16:30 • Sun & Public Holidays: 07:30–12:30",
    phone: "+356 21654118",
    logo: "/gym-logos/bgm-birzebbuga.png",
    accentColor: "#F97316",
    qrCodeId: "BGM-BIRZEBBUGA",
    facilities: [
      "Cardio Area",
      "Freeweight Area",
      "Strength Machines",
      "Functional Training",
      "WiFi",
      "Showers",
      "Lockers",
    ],
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
    address: "Build Fitness Centre, Malta",
    latitude: 35.94966135283006,
    longitude: 14.403839567776476,
    openingHours:
      "Mon–Fri: 05:00–23:00 • Sat: 06:00–18:00 • Sun & Public Holidays: 07:00–13:00",
    phone: "+356 21484090",
    logo: "/gym-logos/bgm-build.png",
    accentColor: "#F97316",
    qrCodeId: "BGM-BUILD",
    facilities: [
      "Functional Area",
      "Classes Available",
      "Freeweight Area",
      "Strength Machines",
      "WiFi",
      "Showers",
      "Lockers",
    ],
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
    address: "Kirkop Fitness Centre, Kirkop, Malta",
    latitude: 35.83861653083825,
    longitude: 14.485285581268107,
    openingHours:
      "Mon–Fri: 05:00–23:00 • Sat: 07:00–18:00 • Sun & Public Holidays: 07:00–13:00",
    phone: "+356 21681331",
    logo: "/gym-logos/bgm-kirkop.png",
    accentColor: "#F97316",
    qrCodeId: "BGM-KIRKOP",
    facilities: [
      "Functional Area",
      "Freeweight Area",
      "Strength Machines",
      "WiFi",
      "Showers",
      "Lockers",
    ],
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
    address: "BGM Marsa Fitness Centre, Marsa, Malta",
    latitude: 35.876501,
    longitude: 14.493171,
    openingHours:
      "Mon–Fri: 04:30–23:00 • Sat: 06:00–20:00 • Sun & Public Holidays: 06:00–20:00",
    phone: "+356 21334327",
    logo: "/gym-logos/bgm-marsa.png",
    accentColor: "#F97316",
    qrCodeId: "BGM-MARSA",
    facilities: [
      "Hyrox Area",
      "Spinning Area",
      "Functional Area",
      "Classes Available",
      "Boxing Area",
      "Cardio Area",
      "Freeweight Area",
      "Strength Machines",
      "WiFi",
      "Showers",
      "Lockers",
      "Parking",
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
    id: "bgm-neptunes",
    name: "Neptunes Fitness",
    shortName: "Neptunes",
    status: "active",
    city: "St Julian's",
    address: "Neptunes Fitness Centre, St Julian's, Malta",
    latitude: 35.91540246582352,
    longitude: 14.49345285427998,
    openingHours:
      "Mon–Fri: 05:00–23:00 • Sat: 07:00–18:30 • Sun & Public Holidays: 07:00–13:00",
    phone: "+356 21250775",
    logo: "/gym-logos/bgm-neptunes.png",
    accentColor: "#F97316",
    qrCodeId: "BGM-NEPTUNES",
    facilities: [
      "Freeweight Area",
      "Strength Machines",
      "WiFi",
      "Showers",
      "Lockers",
    ],
    classes: [],
    featuredEquipment: ["Strength machines", "Free weights"],
    notes:
      "A popular BestGymsMalta location in the St Julian's area, ideal for members training close to the coast.",
  },
  {
    id: "bgm-pembroke",
    name: "Pembroke Fitness",
    shortName: "Pembroke",
    status: "active",
    city: "Pembroke",
    address: "Pembroke Fitness Centre, Pembroke, Malta",
    latitude: 35.92450925868331,
    longitude: 14.476937138940775,
    openingHours:
      "Mon–Fri: 05:00–23:00 • Sat: 07:00–20:00 • Sun & Public Holidays: 07:00–20:00",
    phone: "+356 21250945",
    logo: "/gym-logos/bgm-pembroke.png",
    accentColor: "#F97316",
    qrCodeId: "BGM-PEMBROKE",
    facilities: [
      "Cardio Area",
      "Freeweight Area",
      "WiFi",
      "Showers",
      "Lockers",
    ],
    classes: [],
    featuredEquipment: ["Cardio machines", "Free weights"],
    notes:
      "A BestGymsMalta location for members training in Pembroke and nearby areas.",
  },
  {
    id: "bgm-sliema",
    name: "Sliema Fitness",
    shortName: "Sliema",
    status: "active",
    city: "Sliema",
    address: "Best Gyms Sliema, Sliema, Malta",
    latitude: 35.907312012656334,
    longitude: 14.51097539660994,
    openingHours:
      "Mon–Fri: 05:00–23:00 • Sat: 07:00–20:00 • Sun & Public Holidays: 07:00–20:00",
    phone: "+356 21334328",
    logo: "/gym-logos/bgm-sliema.png",
    accentColor: "#F97316",
    qrCodeId: "BGM-SLIEMA",
    facilities: [
      "Functional Area",
      "Cardio Area",
      "Freeweight Area",
      "Strength Machines",
      "WiFi",
      "Showers",
      "Lockers",
      "Parking",
    ],
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
    address: "Tal-Qroqq Fitness Centre, Tal-Qroqq, Malta",
    latitude: 35.90381858040224,
    longitude: 14.488096194179404,
    openingHours:
      "Mon–Fri: 05:00–23:00 • Sat: 07:00–20:00 • Sun & Public Holidays: 07:00–20:00",
    phone: "+356 27511511",
    logo: "/gym-logos/bgm-talqroqq.png",
    accentColor: "#F97316",
    qrCodeId: "BGM-TALQROQQ",
    facilities: [
      "TRX Area",
      "Hyrox Area",
      "Spinning Area",
      "Functional Area",
      "Classes Available",
      "Boxing Area",
      "Cardio Area",
      "Freeweight Area",
      "Posing Area",
      "Strength Machines",
      "WiFi",
      "Showers",
      "Lockers",
      "Parking",
    ],
    classes: ["Spinning"],
    featuredEquipment: ["Cardio machines", "Free weights", "Strength machines"],
    notes:
      "A BestGymsMalta location close to the university and central areas, with a strong everyday training setup.",
  },
  {
    id: "bgm-birgu",
    name: "Birgu Fitness",
    shortName: "Birgu",
    status: "coming_soon",
    city: "Birgu",
    address: "BGM Birgu Fitness Centre, Birgu, Malta",
    latitude: 35.885171,
    longitude: 14.521196,
    openingHours:
      "Coming soon • Planned hours: Mon–Fri: 05:00–23:00 • Sat: 07:00–18:30 • Sun & Public Holidays: 07:00–13:00",
    phone: "+356 21435856",
    logo: "/gym-logos/bgm-birgu.png",
    accentColor: "#F97316",
    qrCodeId: "BGM-BIRGU",
    facilities: [
      "Cardio Area",
      "Freeweight Area",
      "WiFi",
      "Showers",
      "Lockers",
      "Parking",
    ],
    classes: [],
    notes:
      "Launching beginning 2026. This location is planned as part of the BestGymsMalta network expansion.",
  },
  {
    id: "bgm-marsascala",
    name: "Marsascala Fitness",
    shortName: "Marsascala",
    status: "coming_soon",
    city: "Marsascala",
    address: "Marsascala Fitness, Marsascala, Malta",
    openingHours: "Coming soon",
    logo: "/gym-logos/bgm-marsascala.png",
    accentColor: "#F97316",
    qrCodeId: "BGM-MARSASCALA",
    facilities: [],
    classes: [],
    featuredEquipment: [],
    notes:
      "This location is planned as part of the BestGymsMalta network expansion. More details will be announced soon.",
  },
];

export const activeGyms = gyms.filter((gym) => gym.status === "active");

export const comingSoonGyms = gyms.filter(
  (gym) => gym.status === "coming_soon"
);

export function getGymById(id: string) {
  return gyms.find((gym) => gym.id === id);
}
