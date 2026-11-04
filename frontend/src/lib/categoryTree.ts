import type { Category } from '@/types'

/** Two levels: main categories (Components) and the ones inside them (RAM, Storage…). */
export function parentIdOf(c: Pick<Category, 'parent'>): string | null {
  if (!c.parent) return null
  return typeof c.parent === 'string' ? c.parent : c.parent._id
}

/** Main categories: no parent, or a parent that is not in the list (hidden / deleted). */
export function mainCategories<T extends Category>(list: T[]): T[] {
  const ids = new Set(list.map((c) => c._id))
  return list.filter((c) => {
    const p = parentIdOf(c)
    return !p || !ids.has(p)
  })
}

export function childrenOf<T extends Category>(list: T[], id: string): T[] {
  return list.filter((c) => parentIdOf(c) === id)
}

/** The main category a category belongs to (itself when it is a main one). */
export function mainOf<T extends Category>(list: T[], c: T | undefined): T | undefined {
  if (!c) return undefined
  const p = parentIdOf(c)
  return (p && list.find((x) => x._id === p)) || c
}

/** Main categories each followed by their sub-categories (admin list, menus). */
export function categoryTree<T extends Category>(list: T[]): { category: T; depth: 0 | 1 }[] {
  return mainCategories(list).flatMap((m) => [
    { category: m, depth: 0 as const },
    ...childrenOf(list, m._id).map((c) => ({ category: c, depth: 1 as const })),
  ])
}
