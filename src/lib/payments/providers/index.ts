import type { IPaymentProvider } from '../interfaces';
import { StripeProvider } from './stripe';
import { MercadoPagoProvider } from './mercadopago';
import { WompiProvider } from './wompi';
import { PayUProvider } from './payu';
import { NequiProvider } from './nequi';
import { DaviplataProvider } from './daviplata';
import { PSEProvider } from './pse';
import { WalletProvider } from './wallet';

export { StripeProvider } from './stripe';
export { MercadoPagoProvider } from './mercadopago';
export { WompiProvider } from './wompi';
export { PayUProvider } from './payu';
export { NequiProvider } from './nequi';
export { DaviplataProvider } from './daviplata';
export { PSEProvider } from './pse';
export { WalletProvider } from './wallet';

export function getDefaultProviders(): IPaymentProvider[] {
  return [
    new StripeProvider(),
    new MercadoPagoProvider(),
    new WompiProvider(),
    new PayUProvider(),
    new NequiProvider(),
    new DaviplataProvider(),
    new PSEProvider(),
    new WalletProvider(),
  ];
}
