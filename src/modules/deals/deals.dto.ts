import { DealStage } from './deals.entity';

export interface DealCreateDto {
  accountId: string;
  propertyId?: string;
  propertyManagerId?: string;
  title: string;
  stage?: DealStage;
  amountCents: number;
  expectedCloseDate?: string;
}

export interface DealUpdateDto {
  propertyId?: string;
  propertyManagerId?: string;
  title?: string;
  stage?: DealStage;
  amountCents?: number;
  expectedCloseDate?: string;
}

export interface DealDto {
  id: string;
  accountId: string;
  propertyId?: string;
  propertyManagerId?: string;
  title: string;
  stage: DealStage;
  amountCents: number;
  expectedCloseDate?: string;
  createdAt: string;
  updatedAt: string;
}
