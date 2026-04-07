export type PropertyManagerStatus = 'active' | 'inactive';

export interface PropertyManagerEntity {
  id: string;
  accountId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  title?: string;
  status: PropertyManagerStatus;
  createdAt: Date;
  updatedAt: Date;
}
