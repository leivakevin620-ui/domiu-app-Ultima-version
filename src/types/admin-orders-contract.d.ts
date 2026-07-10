import '@/app/actions/admin-orders';

declare module '@/app/actions/admin-orders' {
  export interface BusinessDetailsForOrder {
    id: string;
    name: string;
    address: string;
    neighborhood: string;
    city: string;
    latitude: number | null;
    longitude: number | null;
    is_active: boolean;
    is_verified: boolean;
    accepts_orders: boolean;
    hasAddress: boolean;
    hasCoordinates: boolean;
  }

  export function getBusinessDetailsForOrder(
    businessId: string,
  ): Promise<BusinessDetailsForOrder | null>;
}
