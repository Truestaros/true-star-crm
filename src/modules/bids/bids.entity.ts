export interface BidEntity {
  id: string;
  dealId: string;
  turfAreaSqft: number;
  bedAreaSqft: number;
  treeCount: number;
  margin: number;
  maintenancePriceCents: number;
  createdAt: Date;
  updatedAt: Date;
}
