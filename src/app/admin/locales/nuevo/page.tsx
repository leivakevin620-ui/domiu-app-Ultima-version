import { redirect } from 'next/navigation';

export default function LocalesNuevoRedirect() {
  redirect('/admin/negocios/crear');
}
