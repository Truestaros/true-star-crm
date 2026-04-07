export interface PropertyManager {
  id: string;
  firstName: string;
  lastName: string;
  companyName: string;
  email: string;
  phone: string;
  title?: string;
  createdAt: Date;
}

export interface Property {
  id: string;
  name: string;
  address: string;
  propertyManagerId: string;
  dealStage: 'prospecting' | 'proposal' | 'negotiation' | 'won' | 'lost';
  value: number;
}

export interface Note {
  id: string;
  propertyManagerId: string;
  content: string;
  createdAt: Date;
  createdBy: string;
}
