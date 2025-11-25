export const FOOD_GROUP_ENUM = [
  'Meat',
  'Seafood',
  'FruitsVegetables',
  'Dairy',
  'CerealGrainsPasta',
  'LegumesNutsSeeds',
  'FatsOils',
  'Confectionery',
  'Beverages',
  'Condiments',
  'MixedDishes',
] as const;

export type FoodGroup = (typeof FOOD_GROUP_ENUM)[number];

export const FOOD_GROUP_ENUM_STRING = FOOD_GROUP_ENUM.join(', ');

