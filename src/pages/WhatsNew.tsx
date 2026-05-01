import { Bell, MapPin, PenSquare, Undo2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import AddMemoryForm from "@/components/AddMemoryForm";
import AudioToggleButton from "@/components/AudioToggleButton";
import BottomNav from "@/components/BottomNav";
import BrandMark from "@/components/BrandMark";
import AppBreadcrumbs from "@/components/AppBreadcrumbs";
import NotificationButton from "@/components/NotificationButton";
import UserAvatar from "@/components/UserAvatar";
import { useMemories } from "@/hooks/useMemories";
import { Memory } from "@/types/memory";
import { useState } from "react";

const WhatsNew = () => {
  const navigate = useNavigate();
  const { addMemory } = useMemories();
  const [showForm, setShowForm] = useState(false);

  const handleAddMemory = async (data: Omit<Memory, "id" | "createdAt">) => {
    const createdMemory = await addMemory({ ...data, tags: data.tags ?? [] });
    if (!createdMemory) return false;

    navigate(`/journal/memories/${createdMemory.id}`);
    return true;
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-lg items-center justify-between px-4 py-4">
          <button
            type="button"
            onClick={() => navigate("/")}
            className="rounded-sm transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <BrandMark />
          </button>
          <div className="flex items-center gap-2">
            <NotificationButton />
            <AudioToggleButton />
            <UserAvatar />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-lg flex-1 px-4 py-5 pb-24">
        <AppBreadcrumbs items={[{ label: "Discover", onClick: () => navigate("/") }, { label: "What's new" }]} />

        <div className="mb-5">
          <h1 className="font-display text-2xl font-semibold text-foreground">What's new</h1>
          <p className="mt-1 text-sm text-muted-foreground">New features and small improvements from Songline.</p>
        </div>

        <div className="space-y-3">
          <article className="card-strong rounded-lg px-4 py-4">
            <div className="mb-3 flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <PenSquare size={18} />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">Draft recovery for new memories</p>
                <p className="mt-0.5 text-xs text-muted-foreground">New feature</p>
              </div>
            </div>
            <p className="text-sm leading-relaxed text-muted-foreground">
              New memory drafts now save automatically while you write, so accidental taps or refreshes do not wipe out your post.
              When you come back, your unfinished memory is restored for you.
            </p>
          </article>

          <article className="card-strong rounded-lg px-4 py-4">
            <div className="mb-3 flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Undo2 size={18} />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">Smarter back navigation</p>
                <p className="mt-0.5 text-xs text-muted-foreground">Improvement</p>
              </div>
            </div>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Going back from a memory detail now remembers where you were first.
              Filters, profile views, timeline position, and scroll state are restored instead of sending you back to a default screen.
            </p>
          </article>

          <article className="card-strong rounded-lg px-4 py-4">
            <div className="mb-3 flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <MapPin size={18} />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">Map now opens near your busiest area</p>
                <p className="mt-0.5 text-xs text-muted-foreground">Improvement</p>
              </div>
            </div>
            <p className="text-sm leading-relaxed text-muted-foreground">
              The map no longer opens in empty ocean when your memories are spread far apart.
              It now centers on the area with the highest concentration of pinned memories first.
            </p>
          </article>

          <article className="card-strong rounded-lg px-4 py-4">
            <div className="mb-3 flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Bell size={18} />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">Playlist save notifications</p>
                <p className="mt-0.5 text-xs text-muted-foreground">New feature</p>
              </div>
            </div>
            <p className="text-sm leading-relaxed text-muted-foreground">
              You can now get notified when someone saves a song from your memory to their playlist,
              so your music picks get the credit they deserve.
            </p>
          </article>
        </div>
      </main>

      <BottomNav onNewMemory={() => setShowForm(true)} />

      {showForm && (
        <AddMemoryForm
          onAdd={handleAddMemory}
          onClose={() => setShowForm(false)}
          editingMemory={null}
        />
      )}
    </div>
  );
};

export default WhatsNew;
