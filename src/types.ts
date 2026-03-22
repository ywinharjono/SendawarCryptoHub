export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  reputation: number;
  role: 'admin' | 'user';
  badges?: string[];
}

export interface Signal {
  id: string;
  authorId: string;
  authorName: string;
  asset: string;
  type: 'buy' | 'sell';
  price: number;
  timestamp: string;
  accuracy?: number;
}

export interface PriceNotification {
  id: string;
  userId: string;
  asset: string;
  targetPrice: number;
  condition: 'above' | 'below';
  active: boolean;
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}
