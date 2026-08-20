import { formatDigest, parseSha256Prefixed, sha256Prefixed, sha256Raw } from "./hash";
import type { MerkleProof } from "./types";

function hashPair(left: Buffer, right: Buffer): Buffer {
  return sha256Raw(Buffer.concat([left, right]));
}

function toLeaf(hash: string): Buffer {
  return parseSha256Prefixed(hash);
}

/**
 * SHA-256 Merkle tree. Odd nodes are promoted unpaired (not duplicated).
 * Leaves are already `sha256:<hex>` event hashes.
 */
export function merkleRoot(eventHashes: string[]): string {
  if (eventHashes.length === 0) {
    return sha256Prefixed(Buffer.alloc(0));
  }
  let layer = eventHashes.map(toLeaf);
  while (layer.length > 1) {
    const next: Buffer[] = [];
    for (let i = 0; i < layer.length; i += 2) {
      if (i + 1 >= layer.length) next.push(layer[i]);
      else next.push(hashPair(layer[i], layer[i + 1]));
    }
    layer = next;
  }
  return formatDigest(layer[0]);
}

export function inclusionProof(
  eventHashes: string[],
  index: number,
): MerkleProof {
  if (index < 0 || index >= eventHashes.length) {
    throw new Error("leaf index out of range");
  }
  const siblings: MerkleProof["siblings"] = [];
  let layer = eventHashes.map(toLeaf);
  let idx = index;
  while (layer.length > 1) {
    const next: Buffer[] = [];
    for (let i = 0; i < layer.length; i += 2) {
      if (i + 1 >= layer.length) {
        next.push(layer[i]);
        continue;
      }
      if (idx === i || idx === i + 1) {
        if (idx === i) {
          siblings.push({ side: "right", hash: formatDigest(layer[i + 1]) });
        } else {
          siblings.push({ side: "left", hash: formatDigest(layer[i]) });
        }
      }
      next.push(hashPair(layer[i], layer[i + 1]));
    }
    idx = Math.floor(idx / 2);
    layer = next;
  }
  return {
    root: formatDigest(layer[0]),
    leaf: eventHashes[index],
    index,
    siblings,
  };
}

export function verifyInclusion(proof: MerkleProof): boolean {
  let acc = toLeaf(proof.leaf);
  for (const sib of proof.siblings) {
    const other = toLeaf(sib.hash);
    acc = sib.side === "left" ? hashPair(other, acc) : hashPair(acc, other);
  }
  return formatDigest(acc) === proof.root;
}

/** Named blobs → sorted merkle root (skills/tools artifact trees). */
export function merkleOfNamedBlobs(
  files: Array<{ name: string; content: string | Uint8Array }>,
): string {
  const sorted = [...files].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  const leaves = sorted.map((f) =>
    sha256Prefixed(
      typeof f.content === "string" ? Buffer.from(f.content, "utf8") : f.content,
    ),
  );
  return merkleRoot(leaves);
}
