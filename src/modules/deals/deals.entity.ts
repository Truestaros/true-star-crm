export type DealStage = 'prospecting' | 'proposal' | 'negotiation' | 'won' | 'lost';

export interface DealEntity {
  id: string;
  accountId: string;
  propertyId?: string;
  propertyManagerId?: string;
  title: string;
  stage: DealStage;
  amountCents: number;
  expectedCloseDate?: Date;
  createdAt: Date;
  updatedAt: Date;
}
