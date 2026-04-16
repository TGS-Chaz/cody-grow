/**
 * CCRS file upload dependency order.
 *
 * The Cannabis Compliance Reporting System rejects submissions that arrive
 * out of dependency order. Every upload in Group N must be fully accepted
 * before any Group N+1 upload is attempted, or the downstream records will
 * reference entities that don't exist on the CCRS side yet.
 */

export type CCRSUploadKind =
  | "Strain" | "Area" | "Product"
  | "Inventory" | "Plant"
  | "InventoryAdjustment" | "InventoryTransfer"
  | "PlantDestruction" | "PlantTransfer"
  | "LabTest" | "Harvest" | "Sale"
  | "Manifest";

export interface UploadGroup {
  order: 1 | 2 | 3 | 4;
  name: string;
  description: string;
  kinds: CCRSUploadKind[];
  /** Upload kinds this group depends on (must all be uploaded first). */
  dependsOn: CCRSUploadKind[];
}

export const CCRS_UPLOAD_GROUPS: UploadGroup[] = [
  {
    order: 1,
    name: "Reference data",
    description: "Base entities — no upstream dependencies. Upload first.",
    kinds: ["Strain", "Area", "Product"],
    dependsOn: [],
  },
  {
    order: 2,
    name: "Physical state",
    description: "Inventory and plants — depend on Group 1 being fully uploaded.",
    kinds: ["Inventory", "Plant"],
    dependsOn: ["Strain", "Area", "Product"],
  },
  {
    order: 3,
    name: "State transitions & history",
    description: "Adjustments, transfers, destructions, labs, harvests, sales — depend on Group 2.",
    kinds: [
      "InventoryAdjustment", "InventoryTransfer",
      "PlantDestruction", "PlantTransfer",
      "LabTest", "Harvest", "Sale",
    ],
    dependsOn: ["Inventory", "Plant"],
  },
  {
    order: 4,
    name: "Transportation",
    description: "Manifests — depend on Inventory/Plant referenced records existing on CCRS.",
    kinds: ["Manifest"],
    dependsOn: ["Inventory", "Plant"],
  },
];

export function getGroupForKind(kind: CCRSUploadKind): UploadGroup {
  const group = CCRS_UPLOAD_GROUPS.find((g) => g.kinds.includes(kind));
  if (!group) throw new Error(`Unknown CCRS upload kind: ${kind}`);
  return group;
}

/**
 * Sort a list of pending uploads into the correct dependency order.
 * Within a single group, order is stable (preserves insertion order).
 */
export function orderUploads<T extends { kind: CCRSUploadKind }>(items: T[]): T[] {
  const byGroup = new Map<number, T[]>();
  for (const item of items) {
    const g = getGroupForKind(item.kind);
    const arr = byGroup.get(g.order) ?? [];
    arr.push(item);
    byGroup.set(g.order, arr);
  }
  const out: T[] = [];
  for (const group of CCRS_UPLOAD_GROUPS) {
    const arr = byGroup.get(group.order) ?? [];
    out.push(...arr);
  }
  return out;
}

/**
 * Check if an upload of this kind is safe to attempt, given which kinds
 * have already been successfully uploaded.
 */
export function canUpload(kind: CCRSUploadKind, completedKinds: Set<CCRSUploadKind>): {
  ok: boolean;
  blockedBy: CCRSUploadKind[];
} {
  const group = getGroupForKind(kind);
  const blockedBy = group.dependsOn.filter((d) => !completedKinds.has(d));
  return { ok: blockedBy.length === 0, blockedBy };
}
