export interface BidPricingInput {
  turfAreaSqft: number;
  bedAreaSqft: number;
  treeCount: number;
  margin: number;
}

export interface BidCreateDto extends BidPricingInput {
  dealId: string;
}

export interface BidUpdateDto {
  turfAreaSqft?: number;
  bedAreaSqft?: number;
  treeCount?: number;
  margin?: number;
}

export interface BidDto {
  id: string;
  dealId: string;
  turfAreaSqft: number;
  bedAreaSqft: number;
  treeCount: number;
  margin: number;
  maintenancePriceCents: number;
  createdAt: string;
  updatedAt: string;
}

export interface BidPacketPageSection {
  heading: string;
  body: string;
}

export interface BidPacketPage {
  title: string;
  sections: BidPacketPageSection[];
}

export interface BidPacketPricingMatrix extends BidPricingInput {
  maintenancePriceCents: number;
}

export interface BidPacketInput {
  companyName: string;
  preparedFor: string;
  preparedBy: string;
  propertyName: string;
  pages: BidPacketPage[];
  pricing: BidPacketPricingMatrix;
  notes?: string;
}
