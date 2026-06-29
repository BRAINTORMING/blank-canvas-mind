import { useState, useEffect, useRef } from 'react';
import { ThumbsUp, ThumbsDown, MessageSquare, Send, X } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useSessionTracking } from '@/contexts/SessionTrackingContext';
import { EXTERNAL_SUPABASE_URL, EXTERNAL_SUPABASE_ANON } from '@/integrations/supabase/externalClient';

type Vote = 'like' | 'dislike' | null;

interface FeedbackComment {
  user_id: string;
  feedback: string;
  feedback_date: string;
}

const supaHeaders: Record<string, string> = {
  'apikey': EXTERNAL_SUPABASE_ANON,
  'Authorization': `Bearer ${EXTERNAL_SUPABASE_ANON}`,
  'Content-Type': 'application/json',
  'Prefer': 'return=minimal',
};

export default function RecommendationWidget() {
  const { user } = useAuth();
  const { setVote: setSessionVote } = useSessionTracking();
  const [vote, setVote] = useState<Vote>(null);
  const [totalLikes, setTotalLikes] = useState(0);
  const [loaded, setLoaded] = useState(false);

  // Feedback state
  const [comments, setComments] = useState<FeedbackComment[]>([]);
  const [totalComments, setTotalComments] = useState(0);
  const [showComments, setShowComments] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const commentsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user?.email) {
      setVote(null);
      setLoaded(false);
      return;
    }

    const load = async () => {
      const headers: Record<string, string> = {
        'apikey': EXTERNAL_SUPABASE_ANON,
        'Authorization': `Bearer ${EXTERNAL_SUPABASE_ANON}`,
      };

      try {
        // Load user's previous vote
        const userRes = await fetch(
          `${EXTERNAL_SUPABASE_URL}/rest/v1/usuarios_sesiones?user_id=eq.${encodeURIComponent(user.email!)}&recomienda_app=not.is.null&order=recomendation_date.desc&limit=1&select=recomienda_app`,
          { headers }
        );
        if (userRes.ok) {
          const data = await userRes.json();
          if (data.length > 0) {
            const prev = data[0].recomienda_app ? 'like' : 'dislike';
            setVote(prev);
            setSessionVote(data[0].recomienda_app);
          }
        }

        // Load total unique likes
        const likesRes = await fetch(
          `${EXTERNAL_SUPABASE_URL}/rest/v1/usuarios_sesiones?recomienda_app=eq.true&select=user_id&order=recomendation_date.desc`,
          { headers }
        );
        if (likesRes.ok) {
          const likesData = await likesRes.json();
          const uniqueUsers = new Set(likesData.map((r: any) => r.user_id));
          setTotalLikes(uniqueUsers.size);
        }

        // Load all feedback comments
        await loadComments(headers);
      } catch (err) {
        console.error('[Recommendation] Error loading:', err);
      }
      setLoaded(true);
    };

    load();
  }, [user?.email, setSessionVote]);

  const loadComments = async (headers?: Record<string, string>) => {
    const h = headers || {
      'apikey': EXTERNAL_SUPABASE_ANON,
      'Authorization': `Bearer ${EXTERNAL_SUPABASE_ANON}`,
    };
    try {
      const res = await fetch(
        `${EXTERNAL_SUPABASE_URL}/rest/v1/usuarios_sesiones?feedback=not.is.null&feedback=neq.&select=user_id,feedback,feedback_date&order=feedback_date.desc`,
        { headers: h }
      );
      if (res.ok) {
        const data: FeedbackComment[] = await res.json();
        setComments(data);
        setTotalComments(data.length);
      }
    } catch (err) {
      console.error('[Recommendation] Error loading comments:', err);
    }
  };

  const handleVote = (newVote: Vote) => {
    if (!user?.email || !newVote) return;

    const previousVote = vote;
    const finalVote = vote === newVote ? null : newVote;
    setVote(finalVote);

    if (finalVote === 'like' && previousVote !== 'like') {
      setTotalLikes(prev => prev + 1);
    } else if (previousVote === 'like' && finalVote !== 'like') {
      setTotalLikes(prev => Math.max(0, prev - 1));
    }

    setSessionVote(finalVote === null ? null : finalVote === 'like');
  };

  const handleSubmitComment = async () => {
    if (!user?.email || !newComment.trim() || submitting) return;
    setSubmitting(true);

    const now = new Date().toISOString();
    // Insert a dedicated row for feedback (not tied to current session)
    const row = {
      user_id: user.email,
      feedback: newComment.trim(),
      feedback_date: now,
      login_time: now,
      logout_time: now,
      sesion_duration: '0:00:00',
    };

    try {
      const res = await fetch(`${EXTERNAL_SUPABASE_URL}/rest/v1/usuarios_sesiones`, {
        method: 'POST',
        headers: supaHeaders,
        body: JSON.stringify(row),
      });
      if (res.ok) {
        setNewComment('');
        // Reload comments
        await loadComments();
      } else {
        console.error('[Recommendation] Failed to post comment:', await res.text());
      }
    } catch (err) {
      console.error('[Recommendation] Error posting comment:', err);
    }
    setSubmitting(false);
  };

  useEffect(() => {
    if (showComments && commentsEndRef.current) {
      commentsEndRef.current.scrollTop = 0;
    }
  }, [showComments]);

  if (!user || !loaded) return null;

  const maskEmail = (email: string) => {
    const [local, domain] = email.split('@');
    if (!local || !domain) return email;
    const visible = local.length <= 2 ? local[0] : local.slice(0, 2);
    return `${visible}***@${domain}`;
  };

  return (
    <div className="fixed bottom-4 right-4 z-[1000] flex flex-col items-end gap-2">
      {/* Comments panel */}
      {showComments && (
        <div className="w-80 max-h-96 bg-card border border-border rounded-xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-2 duration-200">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <span className="text-sm font-semibold text-foreground">Feedback ({totalComments})</span>
            <button onClick={() => setShowComments(false)} className="text-muted-foreground hover:text-foreground">
              <X size={18} />
            </button>
          </div>

          {/* Comments list */}
          <div ref={commentsEndRef} className="flex-1 overflow-y-auto p-3 space-y-3 min-h-[120px] max-h-[240px]">
            {comments.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Sé el primero en dejar tu feedback</p>
            ) : (
              comments.map((c, i) => (
                <div key={i} className="bg-muted/50 rounded-lg px-3 py-2">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-primary">{maskEmail(c.user_id)}</span>
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(c.feedback_date).toLocaleDateString('es-CL')}
                    </span>
                  </div>
                  <p className="text-sm text-foreground leading-snug">{c.feedback}</p>
                </div>
              ))
            )}
          </div>

          {/* Input */}
          <div className="border-t border-border p-3 flex gap-2">
            <input
              value={newComment}
              onChange={e => setNewComment(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSubmitComment()}
              placeholder="Escribe tu comentario..."
              className="flex-1 text-sm bg-muted/50 border border-border rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-primary text-foreground placeholder:text-muted-foreground"
              maxLength={500}
              disabled={submitting}
            />
            <button
              onClick={handleSubmitComment}
              disabled={!newComment.trim() || submitting}
              className="bg-primary text-primary-foreground rounded-lg px-3 py-2 hover:bg-primary/90 disabled:opacity-40 transition-colors"
            >
              <Send size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Labels */}
      <span className="text-sm text-muted-foreground bg-card/90 px-3 py-1 rounded-lg font-medium">
        ¿Recomendarías esta app?
      </span>

      {/* Buttons row */}
      <div className="flex items-center gap-2">
        {/* Feedback button */}
        <button
          onClick={() => setShowComments(prev => !prev)}
          className="flex items-center gap-2 rounded-full px-4 py-3 bg-card border border-border shadow-2 transition-colors hover:bg-muted"
          title="Dejar feedback"
        >
          <MessageSquare size={22} className={showComments ? 'text-primary fill-primary' : 'text-muted-foreground'} />
          <span className="text-sm text-foreground font-semibold">{totalComments}</span>
        </button>

        {/* Like / Dislike */}
        <div className="flex items-center rounded-full overflow-hidden bg-card border border-border shadow-2">
          <button
            onClick={() => handleVote('like')}
            className={`flex items-center gap-2 px-5 py-3 transition-colors ${
              vote === 'like' ? 'bg-primary/10' : 'hover:bg-muted'
            }`}
            title="Me gusta"
          >
            <ThumbsUp size={24} className={vote === 'like' ? 'text-primary fill-primary' : 'text-muted-foreground'} />
            <span className="text-sm text-foreground font-semibold">{totalLikes}</span>
          </button>

          <div className="w-px h-7 bg-border" />

          <button
            onClick={() => handleVote('dislike')}
            className={`flex items-center px-5 py-3 transition-colors ${
              vote === 'dislike' ? 'bg-destructive/10' : 'hover:bg-muted'
            }`}
            title="No me gusta"
          >
            <ThumbsDown size={24} className={vote === 'dislike' ? 'text-destructive fill-destructive' : 'text-muted-foreground'} />
          </button>
        </div>
      </div>


      {/* Feedback CTA */}
      <button
        onClick={() => setShowComments(true)}
        className="text-xs text-muted-foreground hover:text-foreground bg-card/80 px-3 py-1 rounded-lg transition-colors cursor-pointer"
      >
        Este piloto crece con tu feedback.
      </button>
    </div>
  );
}
