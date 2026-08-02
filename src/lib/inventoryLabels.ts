import type { Category, Unit } from "@/types/inventory";

/**
 * Items reference categories and units by id, so anything showing them as text
 * has to resolve the id first. The fallbacks cover an id that no longer
 * resolves — a category/unit deleted out from under an item, or a list that
 * hasn't finished loading yet.
 */
export function getCategoryName(categories: Category[], categoryId: string): string {
  return categories.find((category) => category.id === categoryId)?.name ?? "Unknown category";
}

export function getUnitLabel(units: Unit[], unitId: string): string {
  return units.find((unit) => unit.id === unitId)?.label ?? "Unknown unit";
}
