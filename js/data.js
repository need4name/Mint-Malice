// Static game data: parody sets, customer archetypes, upgrade trees, tuning constants.

export const PACKS_PER_BOX = 10;

// Lifetime revenue needed for store levels 1..5
export const LEVELS = [0, 800, 3000, 8000, 20000];

// Chance a hit pack holds each rarity tier.
export const RARITY = {
  holo: { label: 'Holo Rare', odds: 0.72, color: '#7fd3ff' },
  ultra: { label: 'Ultra Rare', odds: 0.23, color: '#ffd23d' },
  secret: { label: 'Secret Rare', odds: 0.05, color: '#ff6bff' },
};

// Each set has its own pack weights (grams) and hit rate. Later sets have a
// smaller gap between a dud and a hit, so a cheap kitchen scale stops being enough.
export const SETS = {
  choke: {
    id: 'choke', name: 'Chokémon', short: 'CHOKÉ', year: 1999, wear: 'LP', unlock: 1,
    color: '#f2c230', color2: '#ff8a3d', frame: '#f2c94c', mascot: '⚡',
    boxCost: 60, packPrice: 9, hitRate: 0.22,
    weights: { light: 20.88, heavy: 21.45 },
    blurb: 'Flagship series featuring Yellow Rat, Fire Lizard and Soggy Turtle. High resale value on 1st Edition holos.',
    variants: [
      { name: '1st Edition', odds: 0.12, mult: 2.5 },
      { name: 'Shadowless', odds: 0.08, mult: 1.6 },
      { name: 'Misprint', odds: 0.02, mult: 3 },
    ],
    cards: [
      { name: 'Sleepy Blob', rarity: 'holo', value: 25, art: '😴' },
      { name: 'Soggy Turtle', rarity: 'holo', value: 45, art: '🐢' },
      { name: 'Leafy Toad', rarity: 'holo', value: 35, art: '🐸' },
      { name: 'Clefairy-ish', rarity: 'holo', value: 30, art: '🧚' },
      { name: 'Yellow Rat', rarity: 'ultra', value: 120, art: '🐭' },
      { name: 'Ghastly Gas Bag', rarity: 'ultra', value: 95, art: '👻' },
      { name: 'Fire Lizard', rarity: 'secret', value: 340, art: '🦎' },
      { name: 'Mew-Two-Much', rarity: 'secret', value: 280, art: '🧬' },
    ],
  },
  yuno: {
    id: 'yuno', name: 'Y-U-No-Pay', short: 'Y-U-NO', year: 2002, wear: 'NM', unlock: 2,
    color: '#2f6bff', color2: '#8a3dff', frame: '#c27a3a', mascot: '👁️',
    boxCost: 90, packPrice: 13, hitRate: 0.18,
    weights: { light: 18.62, heavy: 18.98 },
    blurb: 'Anime-style monster game featuring Blue-Eyes Shiny Dragon and endless reprint ban lists.',
    variants: [
      { name: '1st Edition', odds: 0.15, mult: 1.8 },
      { name: 'Ghost Rare', odds: 0.03, mult: 4 },
    ],
    cards: [
      { name: "Exodia's Left Pinky", rarity: 'holo', value: 40, art: '🦴' },
      { name: 'Kuriboh-Not', rarity: 'holo', value: 35, art: '🐹' },
      { name: 'Mirror Farce', rarity: 'holo', value: 50, art: '🪞' },
      { name: 'Pot of Greedier', rarity: 'holo', value: 70, art: '🏺' },
      { name: 'Time Wizard of Accounting', rarity: 'ultra', value: 130, art: '⏳' },
      { name: 'Dark Magician Intern', rarity: 'ultra', value: 160, art: '🧙' },
      { name: 'Red-Eyes Dark Lizard', rarity: 'secret', value: 260, art: '🐊' },
      { name: 'Blue-Eyes Shiny Dragon', rarity: 'secret', value: 450, art: '🐉' },
    ],
  },
  tragic: {
    id: 'tragic', name: 'Tragic: The Hoarding', short: 'TRAGIC', year: 1993, wear: 'MP', unlock: 3,
    color: '#b04cff', color2: '#4a2a8a', frame: '#1d1b22', mascot: '🔮',
    boxCost: 140, packPrice: 20, hitRate: 0.14,
    weights: { light: 26.1, heavy: 26.36 },
    blurb: 'Overpriced cardboard spells. Famous for the Obsidian Lotus and misprinted mana symbols.',
    variants: [
      { name: 'Alpha', odds: 0.1, mult: 3 },
      { name: 'Foil', odds: 0.12, mult: 1.8 },
      { name: 'Misprint', odds: 0.03, mult: 2.5 },
    ],
    cards: [
      { name: 'Counterfeit Spell', rarity: 'holo', value: 60, art: '📜' },
      { name: 'Lightning Bill', rarity: 'holo', value: 75, art: '⚡' },
      { name: 'Dark Rituel', rarity: 'holo', value: 55, art: '🕯️' },
      { name: 'Misprinted Mana Elf', rarity: 'holo', value: 90, art: '🧝' },
      { name: 'Moxie Emerald', rarity: 'ultra', value: 300, art: '💚' },
      { name: 'Overpriced Dragon', rarity: 'ultra', value: 240, art: '🐲' },
      { name: 'Time Spiral Staircase', rarity: 'secret', value: 700, art: '🌀' },
      { name: 'Obsidian Lotus', rarity: 'secret', value: 1500, art: '🌺' },
    ],
  },
};
export const SET_ORDER = ['choke', 'yuno', 'tragic'];

// Target edge wear (0-100) the aging step must match, keyed by the set's era.
export const WEAR = {
  NM: { label: 'Near Mint', target: 12 },
  LP: { label: 'Lightly Played', target: 35 },
  MP: { label: 'Moderately Played', target: 58 },
};

export const ARCH = {
  timmy: { name: 'The Timmy (Kid)', short: 'Timmy', emoji: '🧒', risk: 0.02,
    names: ['Little Tyler', 'Jaxon (age 9)', 'Brayden', 'Tiny Tim', 'Kayden w/ allowance'] },
  parent: { name: 'The Parent', short: 'Parent', emoji: '🧑‍🍼', risk: 0.08,
    names: ['Tired Dad', 'Frazzled Mum', 'Uncle Barry', 'Grandma Pat'] },
  sweat: { name: 'The Sweat (Collector)', short: 'Sweat', emoji: '🧐', risk: 0.65,
    names: ['Loupe Larry', 'Grail Greg', 'Mint-Condition Mike', 'Sleeve Steve'] },
  streamer: { name: 'The Streamer', short: 'Streamer', emoji: '🎥', risk: 0.9,
    names: ['xX_PackRipz_Xx', 'BreakBro Chad', 'HoloHunterTV', 'RipCity Rachel'] },
};

export const UPGRADES = [
  { branch: 'equip', tab: 'Tools', name: 'Equipment & Tools', icon: '🛠️', tiers: [
    { id: 'equip1', name: 'Digital Gram Scale', cost: 350, lvl: 1, desc: 'Scale readings accurate to ±0.01g. Duds have nowhere to hide.' },
    { id: 'equip2', name: 'Thermal Crimp Sealer', cost: 1100, lvl: 2, desc: 'Much wider sweet spot on the crimp iron.' },
    { id: 'equip3', name: 'Micro-CT X-Ray Scanner', cost: 3800, lvl: 3, desc: 'Holo foils glow through sealed wrappers on the bench.' },
    { id: 'equip4', name: 'Commercial UV Card Press', cost: 9000, lvl: 4, desc: '+15 texture score on every forgery.' },
  ] },
  { branch: 'art', tab: 'Art', name: 'Art & Forgery Skill', icon: '🎨', tiers: [
    { id: 'art1', name: 'Basic Holo Foil Layering', cost: 300, lvl: 1, desc: '+20 Art Skill.' },
    { id: 'art2', name: 'Centering Guides', cost: 1000, lvl: 2, desc: '+10 Art Skill. Foil overlay snaps into place when close.' },
    { id: 'art3', name: '3D Textured Secret Rares', cost: 3500, lvl: 3, desc: '+25 Art Skill. Unlocks forging Secret Rares, the most valuable cards in each set.' },
    { id: 'art4', name: 'Counterfeit Slab Encapsulation', cost: 8500, lvl: 4, desc: 'Forgeries graded 90%+ are slabbed as "GSA 10" — worth 2×.' },
  ] },
  { branch: 'hustle', tab: 'Hustle', name: 'Hustle & Charisma', icon: '💼', tiers: [
    { id: 'hustle1', name: 'Gaslighting Dialogue Options', cost: 250, lvl: 1, desc: 'New excuses when caught, better odds, wider swap zone.' },
    { id: 'hustle2', name: 'Shill Reviews', cost: 900, lvl: 2, desc: 'Fake 5-star reviews: Heat cools twice as fast overnight.' },
    { id: 'hustle3', name: 'Grading Inspector Bribes', cost: 3200, lvl: 3, desc: 'Collectors & streamers are half as likely to spot forgeries.' },
    { id: 'hustle4', name: 'Rogue Employee Fall-Guy', cost: 7500, lvl: 4, desc: 'Kevin from the stockroom takes the blame for one raid.' },
  ] },
];

// Art Skill bonuses granted by upgrades (base skill is 30).
export const ART_BONUS = { art1: 20, art2: 10, art3: 25 };
