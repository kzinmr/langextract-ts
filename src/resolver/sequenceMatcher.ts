export type MatchingBlock = [number, number, number];

export class SequenceMatcher {
  private a: string[] = [];
  private b: string[] = [];
  private b2j: Map<string, number[]> = new Map();

  setSeqs(a: string[], b: string[]) {
    this.setSeq1(a);
    this.setSeq2(b);
  }

  setSeq1(a: string[]) {
    this.a = a;
  }

  setSeq2(b: string[]) {
    this.b = b;
    this.chainB();
  }

  private chainB() {
    this.b2j = new Map();
    for (let i = 0; i < this.b.length; i += 1) {
      const elt = this.b[i]!;
      const arr = this.b2j.get(elt);
      if (arr) {
        arr.push(i);
      } else {
        this.b2j.set(elt, [i]);
      }
    }
  }

  private findLongestMatch(alo: number, ahi: number, blo: number, bhi: number): MatchingBlock {
    let besti = alo;
    let bestj = blo;
    let bestsize = 0;

    let j2len = new Map<number, number>();

    for (let i = alo; i < ahi; i += 1) {
      const newj2len = new Map<number, number>();
      const idxs = this.b2j.get(this.a[i]!);
      if (!idxs) {
        j2len = newj2len;
        continue;
      }
      for (const j of idxs) {
        if (j < blo) continue;
        if (j >= bhi) break;
        const k = (j2len.get(j - 1) ?? 0) + 1;
        newj2len.set(j, k);
        if (k > bestsize) {
          besti = i - k + 1;
          bestj = j - k + 1;
          bestsize = k;
        }
      }
      j2len = newj2len;
    }

    while (
      besti > alo &&
      bestj > blo &&
      this.a[besti - 1]! === this.b[bestj - 1]!
    ) {
      besti -= 1;
      bestj -= 1;
      bestsize += 1;
    }

    while (
      besti + bestsize < ahi &&
      bestj + bestsize < bhi &&
      this.a[besti + bestsize]! === this.b[bestj + bestsize]!
    ) {
      bestsize += 1;
    }

    return [besti, bestj, bestsize];
  }

  getMatchingBlocks(): MatchingBlock[] {
    const la = this.a.length;
    const lb = this.b.length;
    const queue: Array<[number, number, number, number]> = [[0, la, 0, lb]];
    const matchingBlocks: MatchingBlock[] = [];

    while (queue.length) {
      const [alo, ahi, blo, bhi] = queue.pop()!;
      const [i, j, k] = this.findLongestMatch(alo, ahi, blo, bhi);
      if (k) {
        if (alo < i && blo < j) {
          queue.push([alo, i, blo, j]);
        }
        if (i + k < ahi && j + k < bhi) {
          queue.push([i + k, ahi, j + k, bhi]);
        }
        matchingBlocks.push([i, j, k]);
      }
    }

    matchingBlocks.sort((a, b) => (a[0] - b[0]) || (a[1] - b[1]));

    // Merge adjacent blocks
    const nonAdjacent: MatchingBlock[] = [];
    let [i1, j1, k1] = [0, 0, 0];
    for (const [i2, j2, k2] of matchingBlocks) {
      if (i1 + k1 === i2 && j1 + k1 === j2) {
        k1 += k2;
      } else {
        if (k1) {
          nonAdjacent.push([i1, j1, k1]);
        }
        [i1, j1, k1] = [i2, j2, k2];
      }
    }
    if (k1) {
      nonAdjacent.push([i1, j1, k1]);
    }

    nonAdjacent.push([la, lb, 0]);
    return nonAdjacent;
  }
}
