export const TEAM_COLORS = [
  '#3B82F6', // Blue
  '#EF4444', // Red
  '#22C55E', // Green
  '#F59E0B', // Amber
  '#8B5CF6', // Purple
  '#EC4899', // Pink
  '#14B8A6', // Teal
  '#F97316', // Orange
  '#6366F1', // Indigo
];

export const TEMPLATE_COLORS = [
  '#059669', '#10B981', '#3B82F6', '#F59E0B', '#8B5CF6',
  '#EC4899', '#14B8A6', '#F97316', '#6366F1', '#0EA5E9',
  '#84CC16', '#D946EF',
];

const NAME_POOL = [
  // Animals
  'Dragons', 'Tigers', 'Wolves', 'Eagles', 'Sharks', 'Panthers', 'Cobras',
  'Phoenixes', 'Dolphins', 'Falcons', 'Hawks', 'Lions', 'Foxes', 'Owls',
  'Penguins', 'Leopards', 'Bears', 'Stallions', 'Vipers', 'Stingrays',
  'Gorillas', 'Cheetahs', 'Rhinos', 'Scorpions', 'Raptors', 'Piranhas',
  'Jaguars', 'Chameleons', 'Jellyfish', 'Octopus',

  // Japanese food & culture
  'Curry Rice', 'Melon Pan', 'Takoyaki', 'Onigiri', 'Mochi',
  'Ramen', 'Gyoza', 'Tempura', 'Katsu', 'Yakisoba',
  'Taiyaki', 'Matcha', 'Dango', 'Senbei', 'Edamame',
  'Udon', 'Sushi', 'Tonkatsu', 'Nikuman', 'Karaage',
  'Pocky', 'Dorayaki', 'Pudding', 'Crepes', 'Parfait',

  // Nature & space
  'Waterfalls', 'Tsunamis', 'Volcanoes', 'Avalanche', 'Blizzard',
  'Typhoon', 'Thunder', 'Lightning', 'Meteors', 'Comets',
  'Eclipse', 'Nebula', 'Supernova', 'Aurora', 'Cyclone',
  'Tornado', 'Glacier', 'Inferno', 'Monsoon', 'Wildfire',

  // Cool/funny single concepts
  'Dynamite', 'Samurai', 'Ninjas', 'Shuriken', 'Katana',
  'Legends', 'Vikings', 'Pirates', 'Wizards', 'Knights',
  'Rockets', 'Lasers', 'Titans', 'Spartans', 'Gladiators',
  'Phantoms', 'Shadows', 'Rebels', 'Bandits', 'Mavericks',
  'Cosmos', 'Atomic', 'Turbo', 'Nitro', 'Blaze',
  'Yeti', 'Kraken', 'Hydra', 'Cerberus', 'Minotaur',
  'Gargoyles', 'Wyverns', 'Chimera', 'Valkyries', 'Sentinels',
  'Ronin', 'Shogun', 'Shinobi', 'Kabuki', 'Sumo',
  'Champions', 'Explorers', 'Voyagers', 'Strikers', 'Aces',
  'Boba Tea', 'Waffles', 'Pancakes', 'Donuts', 'Tacos',
  'Pizza', 'Nachos', 'Popcorn', 'Pretzels', 'Cookies',
];

export function getRandomTeamName(takenNames: string[]): string {
  const available = NAME_POOL.filter(n => !takenNames.includes(n));
  if (available.length === 0) {
    return `Team ${Math.floor(Math.random() * 9999)}`;
  }
  return available[Math.floor(Math.random() * available.length)];
}
