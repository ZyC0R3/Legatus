/**
 * Module: bk-tree
 * Purpose: Coordinates this part of the Legatus bot flow.
 */
export type DistanceFunction = (a: string, b: string, maxDistance: number) => number;

type BKNode = {
  term: string;
  children: Map<number, BKNode>;
};

// BKTree defines this module's public behavior or core flow.
export class BKTree {
  private readonly distance: DistanceFunction;

  private root: BKNode | null = null;

  public constructor(distance: DistanceFunction) {
    this.distance = distance;
  }

  public insert(term: string): void {
    if (term.length === 0) {
      return;
    }

    if (!this.root) {
      this.root = {term, children: new Map<number, BKNode>()};
      return;
    }

    let node = this.root;

    while (true) {
      const distance = this.distance(node.term, term, Number.MAX_SAFE_INTEGER);
      const next = node.children.get(distance);
      if (!next) {
        node.children.set(distance, {term, children: new Map<number, BKNode>()});
        return;
      }
      node = next;
    }
  }

  public search(query: string, maxDistance: number): string | null {
    if (!this.root || query.length === 0) {
      return null;
    }

    const stack: BKNode[] = [this.root];

    while (stack.length > 0) {
      const node = stack.pop();
      if (!node) {
        continue;
      }

      const distance = this.distance(node.term, query, maxDistance);
      if (distance <= maxDistance) {
        return node.term;
      }

      const min = distance - maxDistance;
      const max = distance + maxDistance;

      for (const [edgeDistance, child] of node.children) {
        if (edgeDistance >= min && edgeDistance <= max) {
          stack.push(child);
        }
      }
    }

    return null;
  }
}

// boundedLevenshtein defines this module's public behavior or core flow.
export function boundedLevenshtein(a: string, b: string, maxDistance: number): number {
  const aLen = a.length;
  const bLen = b.length;

  if (a === b) {
    return 0;
  }

  if (Math.abs(aLen - bLen) > maxDistance) {
    return maxDistance + 1;
  }

  const previous = new Uint16Array(bLen + 1);
  const current = new Uint16Array(bLen + 1);

  for (let j = 0; j <= bLen; j += 1) {
    previous[j] = j;
  }

  for (let i = 1; i <= aLen; i += 1) {
    current[0] = i;
    let rowMin = current[0] ?? 0;
    const aChar = a[i - 1] ?? "";

    for (let j = 1; j <= bLen; j += 1) {
      const bChar = b[j - 1] ?? "";
      const substitutionCost = aChar === bChar ? 0 : 1;

      const deletion = (previous[j] ?? 0) + 1;
      const insertion = (current[j - 1] ?? 0) + 1;
      const substitution = (previous[j - 1] ?? 0) + substitutionCost;

      const value = Math.min(deletion, insertion, substitution);
      current[j] = value;

      if (value < rowMin) {
        rowMin = value;
      }
    }

    if (rowMin > maxDistance) {
      return maxDistance + 1;
    }

    for (let j = 0; j <= bLen; j += 1) {
      previous[j] = current[j] ?? 0;
    }
  }

  return previous[bLen] ?? maxDistance + 1;
}
