// Static game data: parody sets, customer archetypes, upgrade trees, tuning constants.

export const HEAVY = 21.45; // grams — pack containing a foil hit
export const LIGHT = 20.88; // grams — dud pack, commons only
export const PACKS_PER_BOX = 10;
export const HIT_RATE = 0.22;

// Lifetime revenue needed for store levels 1..5
export const LEVELS = [0, 800, 3000, 8000, 20000];

export const SETS = {
  choke: {
    id: 'choke', name: 'Chokémon', short: 'CHOKÉ', year: 1999, wear: 'LP', unlock: 1,
    color: '#f2c230', color2: '#ff8a3d', frame: '#f2c94c', mascot: '⚡',
    boxCost: 60, packPrice: 9,
    blurb: 'Flagship series featuring Yellow Rat, Fire Lizard and Soggy Turtle. High resale value on 1st Edition holos.',
    hits: [
      { name: 'Sleepy Blob Holo', value: 40, art: '😴' },
      { name: 'Soggy Turtle 1st Ed', value: 90, art: '🐢' },
      { name: 'Yellow Rat 1st Ed', value: 140, art: '🐭' },
      { name: 'Fire Lizard 1st Ed', value: 320, art: '🦎' },
    ],
  },
  yuno: {
    id: 'yuno', name: 'Y-U-No-Pay', short: 'Y-U-NO', year: 2002, wear: 'NM', unlock: 2,
    color: '#2f6bff', color2: '#8a3dff', frame: '#c27a3a', mascot: '👁️',
    boxCost: 90, packPrice: 13,
    blurb: 'Anime-style monster game featuring Blue-Eyes Shiny Dragon and endless reprint ban lists.',
    hits: [
      { name: "Exodia's Left Pinky", value: 50, art: '🦴' },
      { name: 'Pot of Greedier (Banned)', value: 90, art: '🏺' },
      { name: 'Dark Magician Intern', value: 150, art: '🧙' },
      { name: 'Blue-Eyes Shiny Dragon', value: 380, art: '🐉' },
    ],
  },
  tragic: {
    id: 'tragic', name: 'Tragic: The Hoarding', short: 'TRAGIC', year: 1993, wear: 'MP', unlock: 3,
    color: '#b04cff', color2: '#4a2a8a', frame: '#1d1b22', mascot: '🔮',
    boxCost: 140, packPrice: 20,
    blurb: 'Overpriced cardboard spells. Famous for the Obsidian Lotus and misprinted mana symbols.',
    hits: [
      { name: 'Counterfeit Spell', value: 70, art: '📜' },
      { name: 'Misprinted Mana Elf', value: 120, art: '🧝' },
      { name: 'Overpriced Dragon', value: 260, art: '🐲' },
      { name: 'Obsidian Lotus', value: 1200, art: '🌺' },
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
    { id: 'art3', name: '3D Textured Secret Rares', cost: 3500, lvl: 3, desc: '+25 Art Skill. Unlocks ★ Secret Rare templates worth 2×.' },
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
