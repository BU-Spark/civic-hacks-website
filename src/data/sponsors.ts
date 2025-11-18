export interface Sponsor {
  name: string;
  logo: string;
  tier: 1 | 2 | 3;
  alt: string;
  id?: string;
}

export const sponsors: Sponsor[] = [
  {
    name: "Mullen Family Foundation",
    logo: "/img/sponsors/MullenFamily-Logo.png",
    tier: 1,
    alt: "Mullen Family Foundation logo"
  },
  {
    name: "Avanade",
    logo: "/img/sponsors/Avanade-Logo.png",
    tier: 2,
    alt: "Avanade logo"
  },
  {
    name: "Mass Mutual",
    logo: "/img/sponsors/MassMutual_logo.png",
    tier: 2,
    alt: "Mass Mutual logo"
  },
  {
    name: "Intersystems",
    logo: "/img/sponsors/intersystems-logo.png",
    tier: 3,
    alt: "Intersystems logo"
  },
  {
    name: "Boston Medical Center",
    logo: "/img/sponsors/BMC-Logo.webp",
    tier: 3,
    alt: "Boston Medical Center logo"
  },
  {
    name: "Schneider",
    logo: "/img/sponsors/Schneider-Logo.png",
    tier: 3,
    alt: "Schneider logo"
  },
  {
    name: "Major League Hacking",
    logo: "/img/sponsors/MLH-Logo.png",
    tier: 3,
    alt: "Major League Hacking logo"
  },
  {
    name: "Standout Stickers",
    logo: "/img/sponsors/StandoutStickers.png",
    tier: 3,
    alt: "Standout Stickers logo",
    id: "standoutLink"
  },
];

