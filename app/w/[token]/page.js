import WorkerApp from '@/components/WorkerApp';

export async function generateMetadata({ params }) {
  const { token } = await params;
  return {
    title: 'Moj urnik',
    manifest: `/api/w/${encodeURIComponent(token)}/manifest`,
    appleWebApp: { capable: true, title: 'Urnik' },
  };
}

export default async function WorkerPage({ params }) {
  const { token } = await params;
  return <WorkerApp token={token} />;
}
