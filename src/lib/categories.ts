import { translations } from './translations'

// Canonical category values as stored on products.category -- English strings,
// never translated in the database. Display labels are derived via
// categoryLabel() everywhere a category is shown to a user, so a new locale
// only ever needs new nav*/shopAll keys, never a data migration.
export const CATEGORY_VALUES = ['Sneakers', 'Boots', 'Loafers', 'Derbies', 'Slippers', 'Sandals']

export function categoryLabel(t: typeof translations.en | typeof translations.ar, c: string): string {
  switch (c) {
    case 'All': return t.shopAll
    case 'Sneakers': return t.navSneakers
    case 'Boots': return t.navBoots
    case 'Loafers': return t.navLoafers
    case 'Derbies': return t.navDerbies
    case 'Slippers': return t.navSlippers
    case 'Sandals': return t.navSandals
    default: return c
  }
}
