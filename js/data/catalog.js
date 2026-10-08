// Demo catalogue. Collection names and values are PLACEHOLDERS for the prototype;
// in the real build this comes from Salsify (or today's product data export).

export const APPLICATIONS = {
  'floor-res': { label: 'Residential floor', req: { slip: 'R9' } },
  'floor-com': { label: 'Commercial floor (lobby, retail, hotel)', req: { slip: 'R10' } },
  wall: { label: 'Wall', req: null },
  wet: { label: 'Barefoot wet areas (showers, spa)', req: { barefoot: 'B' } },
  pool: { label: 'Pool surrounds', req: { barefoot: 'C' } },
  outdoor: { label: 'Outdoor / terrace', req: { slip: 'R11', frost: true } },
  'kitchen-com': { label: 'Commercial kitchen', req: { slip: 'R12' } },
};

export const SLIP_RANK = { '—': 0, R9: 9, R10: 10, R11: 11, R12: 12, R13: 13 };
export const BAREFOOT_RANK = { null: 0, A: 1, B: 2, C: 3 };

export const BIM_SOFTWARE = [
  { id: 'revit', label: 'Revit', ext: '.rfa' },
  { id: 'autocad', label: 'AutoCAD', ext: '.dwg / .dxf' },
  { id: 'sketchup', label: 'SketchUp', ext: '.skp' },
  { id: 'archicad', label: 'ArchiCAD', ext: '.gsm' },
  { id: 'ifc', label: 'IFC (open BIM)', ext: '.ifc' },
];

// bim: true = file exists in CADENAS catalogue, false = not available, null = coverage unconfirmed
export const COLLECTIONS = [
  {
    id: 'calce', name: 'Calce', look: 'concrete',
    tagline: 'Lime-plaster concrete look for calm, large surfaces',
    material: 'Porcelain stoneware', thickness: '9 mm', rectified: true, frost: true,
    formats: ['30×60', '60×60', '60×120', '120×120'],
    surfaces: [
      { id: 'matt', name: 'Matt', slip: 'R10', barefoot: null },
      { id: 'structured', name: 'Structured', slip: 'R11', barefoot: 'B' },
    ],
    applications: ['floor-res', 'floor-com', 'wall', 'wet', 'outdoor'],
    tags: ['concrete', 'minimal', 'industrial', 'loft', 'cement'],
    bim: { revit: true, autocad: true, sketchup: true, archicad: true, ifc: true },
    colours: [
      { id: 'bianco', name: 'Bianco', hex: '#e2ded6' },
      { id: 'grigio', name: 'Grigio', hex: '#a7a39c' },
      { id: 'tortora', name: 'Tortora', hex: '#a39686' },
      { id: 'antracite', name: 'Antracite', hex: '#54524f' },
    ],
  },
  {
    id: 'basalto', name: 'Basalto Urbano', look: 'stone',
    tagline: 'Volcanic stone character, indoor to outdoor',
    material: 'Porcelain stoneware', thickness: '10 mm / 20 mm outdoor', rectified: true, frost: true,
    formats: ['30×60', '60×60', '60×120', '60×60 (20 mm)'],
    surfaces: [
      { id: 'matt', name: 'Matt', slip: 'R10', barefoot: 'A' },
      { id: 'structured', name: 'Structured', slip: 'R11', barefoot: 'C' },
    ],
    applications: ['floor-res', 'floor-com', 'wall', 'wet', 'outdoor', 'pool'],
    tags: ['stone', 'basalt', 'natural', 'slate', 'volcanic'],
    bim: { revit: true, autocad: true, sketchup: false, archicad: null, ifc: true },
    colours: [
      { id: 'grigio', name: 'Grigio', hex: '#6f6c68' },
      { id: 'antracite', name: 'Antracite', hex: '#41403e' },
      { id: 'nero', name: 'Nero', hex: '#2b2b2c' },
    ],
  },
  {
    id: 'eichenhof', name: 'Eichenhof', look: 'wood',
    tagline: 'Oak planks in porcelain for warm hotel and living spaces',
    material: 'Porcelain stoneware', thickness: '9 mm', rectified: true, frost: true,
    formats: ['20×120', '20×180', '30×120'],
    surfaces: [
      { id: 'matt', name: 'Matt', slip: 'R9', barefoot: null },
      { id: 'structured', name: 'Structured', slip: 'R10', barefoot: 'A' },
    ],
    applications: ['floor-res', 'floor-com', 'wall'],
    tags: ['wood', 'oak', 'plank', 'parquet', 'timber', 'warm'],
    bim: { revit: true, autocad: false, sketchup: true, archicad: true, ifc: null },
    colours: [
      { id: 'natur', name: 'Natur', hex: '#b98e5e' },
      { id: 'honig', name: 'Honig', hex: '#c79a64' },
      { id: 'grau', name: 'Grau', hex: '#998f85' },
      { id: 'rauch', name: 'Rauch', hex: '#6c5442' },
    ],
  },
  {
    id: 'terrazza', name: 'Terrazza Nova', look: 'terrazzo',
    tagline: 'Contemporary terrazzo for lobbies, retail and hospitality',
    material: 'Porcelain stoneware', thickness: '10 mm', rectified: true, frost: false,
    formats: ['60×60', '80×80', '120×120'],
    surfaces: [
      { id: 'matt', name: 'Matt', slip: 'R10', barefoot: null },
      { id: 'lappato', name: 'Lappato', slip: 'R9', barefoot: null },
    ],
    applications: ['floor-res', 'floor-com', 'wall'],
    tags: ['terrazzo', 'speckle', 'retro', 'chips'],
    bim: { revit: true, autocad: true, sketchup: null, archicad: true, ifc: true },
    colours: [
      { id: 'perla', name: 'Perla', hex: '#e4dfd5' },
      { id: 'salvia', name: 'Salvia', hex: '#b5bda9' },
      { id: 'cotto', name: 'Cotto', hex: '#d2a78a' },
    ],
  },
  {
    id: 'marmara', name: 'Marmara', look: 'marble',
    tagline: 'Large marble-look slabs for statement walls and floors',
    material: 'Porcelain stoneware', thickness: '6 mm / 9 mm', rectified: true, frost: false,
    formats: ['60×120', '120×120', '120×260'],
    surfaces: [
      { id: 'polished', name: 'Polished', slip: '—', barefoot: null },
      { id: 'matt', name: 'Matt', slip: 'R9', barefoot: null },
    ],
    applications: ['floor-res', 'wall'],
    tags: ['marble', 'calacatta', 'statuario', 'veined', 'luxury', 'elegant'],
    bim: { revit: true, autocad: null, sketchup: true, archicad: null, ifc: false },
    colours: [
      { id: 'statuario', name: 'Statuario', hex: '#eeede9' },
      { id: 'calacatta', name: 'Calacatta', hex: '#ebe4d8' },
      { id: 'grigio', name: 'Grigio', hex: '#c6c5c3' },
    ],
  },
  {
    id: 'lumen', name: 'Lumen', look: 'plain',
    tagline: 'Plain-colour ceramic wall tiles in handmade proportions',
    material: 'Ceramic wall tile', thickness: '8 mm', rectified: false, frost: false,
    formats: ['10×30', '20×40', '30×90'],
    surfaces: [
      { id: 'glossy', name: 'Glossy', slip: '—', barefoot: null },
      { id: 'matt', name: 'Matt', slip: '—', barefoot: null },
    ],
    applications: ['wall'],
    tags: ['plain', 'colour', 'wall', 'bathroom', 'kitchen', 'handmade', 'subway'],
    bim: { revit: true, autocad: true, sketchup: true, archicad: true, ifc: true },
    colours: [
      { id: 'weiss', name: 'Weiß', hex: '#f3f2ee' },
      { id: 'creme', name: 'Creme', hex: '#ebe2cf' },
      { id: 'salbei', name: 'Salbei', hex: '#a7b49e' },
      { id: 'petrol', name: 'Petrol', hex: '#3e6670' },
      { id: 'terracotta', name: 'Terracotta', hex: '#b6684a' },
    ],
  },
  {
    id: 'kiesel', name: 'Kiesel Outdoor', look: 'stone',
    tagline: '20 mm outdoor slabs for terraces, pool decks and public spaces',
    material: 'Porcelain stoneware 20 mm', thickness: '20 mm', rectified: true, frost: true,
    formats: ['60×60 (20 mm)', '40×80 (20 mm)', '30×60 (20 mm)'],
    surfaces: [{ id: 'structured', name: 'Structured', slip: 'R11', barefoot: 'C' }],
    applications: ['outdoor', 'pool', 'wet', 'floor-com'],
    tags: ['outdoor', 'terrace', 'stone', 'pool', 'patio', 'garden'],
    bim: { revit: false, autocad: true, sketchup: false, archicad: false, ifc: true },
    colours: [
      { id: 'sand', name: 'Sand', hex: '#c7b698' },
      { id: 'grau', name: 'Grau', hex: '#8d8a85' },
      { id: 'schiefer', name: 'Schiefer', hex: '#4c4e51' },
    ],
  },
  {
    id: 'pura', name: 'Pura Pro', look: 'plain',
    tagline: 'Technical through-body porcelain for healthcare, education and kitchens',
    material: 'Through-body porcelain', thickness: '8.5 mm / 12 mm', rectified: true, frost: true,
    formats: ['30×30', '30×60', '60×60'],
    surfaces: [
      { id: 'matt', name: 'Matt', slip: 'R10', barefoot: 'A' },
      { id: 'grip', name: 'Grip', slip: 'R11', barefoot: 'B' },
      { id: 'industrial', name: 'Industrial', slip: 'R12', barefoot: 'C' },
    ],
    applications: ['floor-res', 'floor-com', 'wall', 'wet', 'kitchen-com', 'pool'],
    tags: ['plain', 'technical', 'hospital', 'school', 'kitchen', 'hygienic', 'commercial'],
    bim: { revit: true, autocad: true, sketchup: null, archicad: null, ifc: true },
    colours: [
      { id: 'polar', name: 'Polar', hex: '#eaeae6' },
      { id: 'zement', name: 'Zement', hex: '#b2afa9' },
      { id: 'graphit', name: 'Graphit', hex: '#57585a' },
      { id: 'taubenblau', name: 'Taubenblau', hex: '#8094a8' },
    ],
  },
];

export const PRODUCTS = COLLECTIONS.flatMap((c) =>
  c.colours.map((col) => ({
    id: `${c.id}-${col.id}`,
    collectionId: c.id,
    collection: c,
    name: `${c.name} ${col.name}`,
    colourName: col.name,
    hex: col.hex,
    look: c.look,
    article: `VB-${c.id.slice(0, 3).toUpperCase()}-${col.id.slice(0, 3).toUpperCase()}`,
  })),
);

const byId = new Map(PRODUCTS.map((p) => [p.id, p]));
export const productById = (id) => byId.get(id);
export const collectionById = (id) => COLLECTIONS.find((c) => c.id === id);

export const TODAY_SELECTOR_RESULTS = 2188;

export function bestSurface(collection, req) {
  // Returns the surface that satisfies a requirement, preferring the lowest sufficient grip.
  const ok = collection.surfaces.filter((s) => meets(s, collection, req));
  return ok[0] || null;
}

export function meets(surface, collection, req) {
  if (!req) return true;
  if (req.slip && (SLIP_RANK[surface.slip] ?? 0) < SLIP_RANK[req.slip]) return false;
  if (req.barefoot && (BAREFOOT_RANK[surface.barefoot] ?? 0) < BAREFOOT_RANK[req.barefoot]) return false;
  if (req.frost && !collection.frost) return false;
  return true;
}

export function reqLabel(req) {
  if (!req) return 'no slip requirement';
  const parts = [];
  if (req.slip) parts.push(req.slip);
  if (req.barefoot) parts.push(`barefoot class ${req.barefoot}`);
  if (req.frost) parts.push('frost resistant');
  return parts.join(' + ');
}
