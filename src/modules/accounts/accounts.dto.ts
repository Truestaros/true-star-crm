import { AccountStatus, AccountType } from './accounts.entity';

export interface AccountCreateDto {
  name: string;
  status?: AccountStatus;
  type: AccountType;
  billingEmail?: string;
  phone?: string;
  address1?: string;
  address2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
}

export interface AccountUpdateDto {
  name?: string;
  status?: AccountStatus;
  type?: AccountType;
  billingEmail?: string;
  phone?: string;
  address1?: string;
  address2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
}

export interface AccountDto {
  id: string;
  name: string;
  status: AccountStatus;
  type: AccountType;
  billingEmail?: string;
  phone?: string;
  address1?: string;
  address2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  createdAt: string;
  updatedAt: string;
}
