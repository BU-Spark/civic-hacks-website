# CivicHacks 2025 Website

This is the official website for CivicHacks 2025, built with [Astro](https://astro.build/).

## Project Structure

```
/
├── public/
│   ├── css/          # Stylesheets
│   ├── js/           # JavaScript files
│   ├── img/          # Images
│   └── fonts/        # Font files
├── src/
│   ├── components/   # Astro components
│   │   ├── Header.astro
│   │   ├── Hero.astro
│   │   ├── About.astro
│   │   ├── Schedule.astro
│   │   ├── Sponsors.astro
│   │   ├── FAQ.astro
│   │   └── Footer.astro
│   ├── data/         # Data files (schedule, sponsors, FAQ)
│   │   ├── schedule.ts
│   │   ├── sponsors.ts
│   │   └── faq.ts
│   ├── layouts/      # Layout components
│   │   └── BaseLayout.astro
│   └── pages/        # Pages
│       └── index.astro
└── package.json
```

## Getting Started

### Install Dependencies

```bash
npm install
```

### Development

Start the development server:

```bash
npm run dev
```

The site will be available at `http://localhost:4321`

### Build

Build the site for production:

```bash
npm run build
```

The built files will be in the `dist/` directory.

### Preview

Preview the production build locally:

```bash
npm run preview
```

## Making Changes

### Updating the Schedule

Edit `src/data/schedule.ts` to update the agenda. The schedule is structured by day, with sections and items.

### Updating Sponsors

Edit `src/data/sponsors.ts` to add, remove, or modify sponsors. Each sponsor has:
- `name`: Sponsor name
- `logo`: Path to logo image
- `tier`: Sponsor tier (1 = Platinum, 2 = Gold, 3 = Regular)
- `alt`: Alt text for the logo

### Updating FAQ

Edit `src/data/faq.ts` to modify the FAQ section. Each FAQ item has:
- `id`: Unique ID for the accordion
- `question`: The question text
- `answer`: The answer (supports HTML)

### Modifying Components

Each section of the site is a separate component in `src/components/`. You can modify these files to change the layout or styling of individual sections.

## Deployment

The site builds to static HTML/CSS/JS files in the `dist/` directory, which can be deployed to any static hosting service like:
- Netlify
- Vercel
- GitHub Pages
- AWS S3 + CloudFront
