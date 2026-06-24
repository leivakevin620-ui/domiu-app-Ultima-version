import { redirect } from 'next/navigation';

export default async function LocalesPedidosRedirect(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  redirect(`/admin/negocios/${id}/pedidos`);
}
