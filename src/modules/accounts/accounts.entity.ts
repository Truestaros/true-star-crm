export type AccountStatus = 'active' | 'inactive';
export type AccountType = 'commercial' | 'hoa' | 'municipal' | 'other';

export interface AccountEntity {
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
  createdAt: Date;
  updatedAt: Date;
}
