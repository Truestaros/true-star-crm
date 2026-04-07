export interface PropertyEntity {
  id: string;
  accountId: string;
  propertyManagerId?: string;
  name: string;
  address1: string;
  address2?: string;
  city: string;
  state: string;
  postalCode: string;
  turfAreaSqft: number;
  bedAreaSqft: number;
  treeCount: number;
  createdAt: Date;
  updatedAt: Date;
}
