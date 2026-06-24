import { redirect } from 'next/navigation';

export default async function LocalesEditarRedirect(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  redirect(`/admin/negocios/${id}/editar`);
}
