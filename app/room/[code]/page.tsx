// app/room/[code]/page.tsx
// Watch room page — implemented in Phase 2 (Room System)

interface RoomPageProps {
  params: { code: string };
}

export default function RoomPage({ params }: RoomPageProps) {
  return (
    <main className="min-h-screen flex items-center justify-center">
      <p className="text-brand-muted">
        Room <span className="text-brand-gold font-mono">{params.code}</span> — coming in Phase 2
      </p>
    </main>
  );
}
