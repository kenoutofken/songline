import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, ChevronRight, Loader2, LogOut, ListMusic, Megaphone, Search, Trash2, User, UserCheck, UserPlus, Users } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { PressableButton } from "@/components/ui/pressable-button";

type ProfileSummary = {
  userId: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
};

type DrawerStage = "menu" | "account" | "following";

const UserAvatar = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [stage, setStage] = useState<DrawerStage>("menu");
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [saving, setSaving] = useState(false);
  const [following, setFollowing] = useState<ProfileSummary[]>([]);
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set());
  const [followingLoading, setFollowingLoading] = useState(false);
  const [userSearch, setUserSearch] = useState("");
  const [userResults, setUserResults] = useState<ProfileSummary[]>([]);
  const [userSearchLoading, setUserSearchLoading] = useState(false);
  const [followSavingId, setFollowSavingId] = useState<string | null>(null);

  const loadFollowing = useCallback(async () => {
    if (!user) return;

    setFollowingLoading(true);
    const { data: follows, error } = await supabase
      .from("follows")
      .select("following_id")
      .eq("follower_id", user.id);

    if (error) {
      console.error(error);
      toast.error("Failed to load following");
      setFollowingLoading(false);
      return;
    }

    const ids = (follows ?? []).map((follow) => follow.following_id);
    setFollowingIds(new Set(ids));

    if (ids.length === 0) {
      setFollowing([]);
      setFollowingLoading(false);
      return;
    }

    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("user_id, username, display_name, avatar_url")
      .in("user_id", ids);

    if (profilesError) {
      console.error(profilesError);
      toast.error("Failed to load profiles");
    } else {
      setFollowing(
        (profiles ?? [])
          .filter((profile) => profile.username)
          .map((profile) => ({
            userId: profile.user_id,
            username: profile.username!,
            displayName: profile.display_name,
            avatarUrl: profile.avatar_url,
          }))
          .sort((a, b) => a.username.localeCompare(b.username))
      );
    }

    setFollowingLoading(false);
  }, [user]);

  useEffect(() => {
    if (!user) return;

    const loadProfile = async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("username, display_name")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) {
        console.error(error);
        return;
      }

      const fallbackUsername = user.user_metadata?.username ?? user.email?.split("@")[0] ?? "";
      setUsername(data?.username ?? fallbackUsername);
      setDisplayName(data?.display_name ?? data?.username ?? fallbackUsername);
    };

    loadProfile();
  }, [user]);

  useEffect(() => {
    if (!menuOpen) {
      setStage("menu");
      setUserSearch("");
      setUserResults([]);
      return;
    }

    loadFollowing();
  }, [menuOpen, loadFollowing]);

  useEffect(() => {
    if (!menuOpen || stage !== "following" || !user) return;
    const query = userSearch.trim().toLowerCase();

    if (query.length < 2) {
      setUserResults([]);
      return;
    }

    let cancelled = false;
    const timeout = window.setTimeout(async () => {
      setUserSearchLoading(true);
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, username, display_name, avatar_url")
        .or(`username.ilike.%${query}%,display_name.ilike.%${query}%`)
        .limit(10);

      if (!cancelled) {
        if (error) {
          console.error(error);
          toast.error("Failed to search users");
        } else {
          setUserResults(
            (data ?? [])
              .filter((profile) => profile.username && profile.user_id !== user.id)
              .map((profile) => ({
                userId: profile.user_id,
                username: profile.username!,
                displayName: profile.display_name,
                avatarUrl: profile.avatar_url,
              }))
          );
        }
        setUserSearchLoading(false);
      }
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [menuOpen, stage, userSearch, user]);

  const saveDisplayName = async () => {
    if (!user) return;
    const cleanName = displayName.trim();

    if (!cleanName) {
      toast.error("Display name cannot be empty");
      return;
    }

    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .upsert({
        user_id: user.id,
        username: username || user.user_metadata?.username || user.email?.split("@")[0] || user.id.slice(0, 8),
        display_name: cleanName,
      });

    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Display name updated");
    }
    setSaving(false);
  };

  const toggleFollow = async (profile: ProfileSummary) => {
    if (!user) {
      toast.error("Sign in before following people");
      return;
    }

    setFollowSavingId(profile.userId);
    const isFollowing = followingIds.has(profile.userId);
    const { error } = isFollowing
      ? await supabase
          .from("follows")
          .delete()
          .eq("follower_id", user.id)
          .eq("following_id", profile.userId)
      : await supabase
          .from("follows")
          .insert({ follower_id: user.id, following_id: profile.userId });

    if (error) {
      toast.error(error.message);
    } else {
      setFollowingIds((prev) => {
        const next = new Set(prev);
        if (isFollowing) next.delete(profile.userId);
        else next.add(profile.userId);
        return next;
      });

      setFollowing((prev) => {
        if (isFollowing) return prev.filter((item) => item.userId !== profile.userId);
        if (prev.some((item) => item.userId === profile.userId)) return prev;
        return [...prev, profile].sort((a, b) => a.username.localeCompare(b.username));
      });

      toast.success(isFollowing ? `Unfollowed @${profile.username}` : `Following @${profile.username}`);
    }
    setFollowSavingId(null);
  };

  const openPlaylist = () => {
    setMenuOpen(false);
    navigate("/playlist");
  };

  const openWhatsNew = () => {
    setMenuOpen(false);
    navigate("/whats-new");
  };

  const openProfile = (profile: ProfileSummary) => {
    setMenuOpen(false);
    navigate(`/?profile=${encodeURIComponent(profile.userId)}&username=${encodeURIComponent(profile.username)}`);
  };

  const renderSearchRow = (profile: ProfileSummary) => {
    const isFollowing = followingIds.has(profile.userId);

    return (
      <div key={profile.userId} className="card-strong flex items-center gap-3 rounded-lg px-3 py-2.5">
        <button type="button" onClick={() => openProfile(profile)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
          <Avatar className="h-9 w-9 shrink-0">
            <AvatarFallback className="bg-muted text-xs font-semibold text-muted-foreground">
              {profile.username.substring(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium text-foreground">@{profile.username}</span>
            {profile.displayName && (
              <span className="block truncate text-xs text-muted-foreground">{profile.displayName}</span>
            )}
          </span>
        </button>
        <button
          type="button"
          onClick={() => toggleFollow(profile)}
          disabled={followSavingId === profile.userId}
          className={cn(
            "shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50",
            isFollowing ? "bg-muted text-foreground hover:bg-muted/80" : "bg-primary text-primary-foreground hover:bg-primary/90"
          )}
        >
          {followSavingId === profile.userId ? (
            <Loader2 size={13} className="animate-spin" />
          ) : isFollowing ? (
            <span className="inline-flex items-center gap-1">
              <UserCheck size={13} />
              Following
            </span>
          ) : (
            <span className="inline-flex items-center gap-1">
              <UserPlus size={13} />
              Follow
            </span>
          )}
        </button>
      </div>
    );
  };

  const renderFollowingRow = (profile: ProfileSummary) => (
    <div key={profile.userId} className="card-strong flex items-center gap-3 rounded-lg px-3 py-2.5">
      <button type="button" onClick={() => openProfile(profile)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
        <Avatar className="h-9 w-9 shrink-0">
          <AvatarFallback className="bg-muted text-xs font-semibold text-muted-foreground">
            {profile.username.substring(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-foreground">@{profile.username}</span>
          {profile.displayName && (
            <span className="block truncate text-xs text-muted-foreground">{profile.displayName}</span>
          )}
        </span>
      </button>
      <button
        type="button"
        onClick={() => toggleFollow(profile)}
        disabled={followSavingId === profile.userId}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
        aria-label={`Unfollow @${profile.username}`}
      >
        {followSavingId === profile.userId ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
      </button>
    </div>
  );

  const stageIndex = stage === "menu" ? 0 : stage === "account" ? 1 : 2;
  const panelClass = "min-w-full w-full shrink-0 space-y-4 overflow-y-auto px-5 py-5";
  const stageTitle = stage === "account" ? "Account" : stage === "following" ? "Following" : "Menu";

  return (
    <>
      <PressableButton
        type="button"
        onClick={() => setMenuOpen(true)}
        className="rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Avatar className="h-9 w-9 shadow-sm ring-1 ring-primary/15">
          <AvatarFallback className="bg-primary text-primary-foreground">
            <User size={18} strokeWidth={2.5} />
          </AvatarFallback>
        </Avatar>
      </PressableButton>

      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent side="right" className="flex h-full w-[92vw] flex-col overflow-hidden p-0 sm:max-w-sm">
          <SheetHeader className="border-b border-border px-5 pb-3 pt-5 text-left">
            <SheetTitle className="flex items-center gap-2 font-display">
              {stage !== "menu" && (
                <PressableButton
                  type="button"
                  onClick={() => setStage("menu")}
                  className="-ml-1 flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
                  aria-label="Back"
                >
                  <ArrowLeft size={17} />
                </PressableButton>
              )}
              {stageTitle}
            </SheetTitle>
          </SheetHeader>

          <div className="min-h-0 flex-1 overflow-hidden">
            <div
              className="flex h-full w-full transition-transform duration-300 ease-out"
              style={{ transform: `translateX(-${stageIndex * 100}%)` }}
            >
              <div className={panelClass}>
                <div className="card-strong rounded-lg px-3 py-3">
                  <p className="truncate text-sm font-medium text-foreground">{displayName || username || user?.email}</p>
                  <p className="truncate text-xs text-muted-foreground">{username ? `@${username}` : user?.email}</p>
                </div>

                <PressableButton
                  type="button"
                  onClick={() => setStage("account")}
                  className="card-strong flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left transition-colors hover:bg-muted"
                >
                  <User size={18} className="shrink-0 text-primary" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-foreground">Account</span>
                    <span className="block truncate text-xs text-muted-foreground">Display name and username</span>
                  </span>
                  <ChevronRight size={16} className="shrink-0 text-muted-foreground" />
                </PressableButton>

                <PressableButton
                  type="button"
                  onClick={() => setStage("following")}
                  className="card-strong flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left transition-colors hover:bg-muted"
                >
                  <Users size={18} className="shrink-0 text-primary" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-foreground">Following</span>
                    <span className="block truncate text-xs text-muted-foreground">Find people and manage follows</span>
                  </span>
                  <ChevronRight size={16} className="shrink-0 text-muted-foreground" />
                </PressableButton>

                <PressableButton
                  type="button"
                  onClick={openPlaylist}
                  className="card-strong flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left transition-colors hover:bg-muted"
                >
                  <ListMusic size={18} className="shrink-0 text-primary" />
                  <span className="min-w-0 flex-1 text-sm font-medium text-foreground">My Playlist</span>
                  <ChevronRight size={16} className="shrink-0 text-muted-foreground" />
                </PressableButton>

                <PressableButton
                  type="button"
                  onClick={openWhatsNew}
                  className="card-strong flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left transition-colors hover:bg-muted"
                >
                  <Megaphone size={18} className="shrink-0 text-primary" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-foreground">What's new</span>
                    <span className="block truncate text-xs text-muted-foreground">Latest Songline updates</span>
                  </span>
                  <ChevronRight size={16} className="shrink-0 text-muted-foreground" />
                </PressableButton>

                <PressableButton
                  type="button"
                  onClick={signOut}
                  className="card-strong flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <LogOut size={18} className="shrink-0" />
                  <span className="min-w-0 flex-1 text-sm font-medium">Sign out</span>
                </PressableButton>
              </div>

              <div className={panelClass}>
                <div>
                  <p className="text-xs text-muted-foreground">Username</p>
                  <p className="mt-1 rounded-lg border border-border bg-muted px-3 py-2 text-sm text-muted-foreground">
                    @{username || "username"}
                  </p>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-foreground">Display name</label>
                  <Input
                    value={displayName}
                    onChange={(event) => setDisplayName(event.target.value)}
                    maxLength={40}
                    placeholder="Your name"
                  />
                </div>

                <Button
                  type="button"
                  onClick={saveDisplayName}
                  disabled={saving || !displayName.trim()}
                  className="w-full"
                >
                  {saving ? "Saving..." : "Save Display Name"}
                </Button>
              </div>

              <div className={panelClass}>
                <div>
                  <p className="text-sm font-medium text-foreground">Following</p>
                  <p className="text-xs text-muted-foreground">Tap a person to see their posts. Use the trash icon to unfollow.</p>
                </div>

                <div className="relative">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={userSearch}
                    onChange={(event) => setUserSearch(event.target.value)}
                    placeholder="Search @username or name"
                    className="pl-9"
                  />
                </div>

                {userSearch.trim().length >= 2 && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">Search results</p>
                    {userSearchLoading ? (
                      <div className="card-strong flex items-center justify-center gap-2 rounded-lg py-4 text-sm text-muted-foreground">
                        <Loader2 size={16} className="animate-spin" />
                        Searching...
                      </div>
                    ) : userResults.length === 0 ? (
                      <p className="card-strong rounded-lg px-3 py-4 text-center text-sm text-muted-foreground">
                        No users found.
                      </p>
                    ) : (
                      userResults.map(renderSearchRow)
                    )}
                  </div>
                )}

                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">People you follow</p>
                  {followingLoading ? (
                    <div className="card-strong flex items-center justify-center gap-2 rounded-lg py-4 text-sm text-muted-foreground">
                      <Loader2 size={16} className="animate-spin" />
                      Loading...
                    </div>
                  ) : following.length === 0 ? (
                    <p className="card-strong rounded-lg px-3 py-4 text-center text-sm text-muted-foreground">
                      You are not following anyone yet.
                    </p>
                  ) : (
                    following.map(renderFollowingRow)
                  )}
                </div>
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
};

export default UserAvatar;
