import { PropertyManagerStatus } from './property-managers.entity';

export interface PropertyManagerCreateDto {
  accountId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  title?: string;
  status?: PropertyManagerStatus;
}

export interface PropertyManagerUpdateDto {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  title?: string;
  status?: PropertyManagerStatus;
}

export interface PropertyManagerDto {
  id: string;
  accountId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  title?: string;
  status: PropertyManagerStatus;
  createdAt: string;
  updatedAt: string;
}
