export const UNIT_TYPE_ENUM = ['Weight', 'Count', 'Volume'] as const;

export type UnitType = (typeof UNIT_TYPE_ENUM)[number];

export const UNIT_TYPE_ENUM_STRING = UNIT_TYPE_ENUM.join(', ');

