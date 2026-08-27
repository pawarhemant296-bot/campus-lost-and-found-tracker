import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import Icon from '../components/Icon.jsx';
import {
  Avatar,
  Button,
  Card,
  Empty,
  LoadingBlock,
  StatusBadge,
  useToast,
} from '../components/ui.jsx';
import { MessagesAPI } from '../lib/api.js';
import { timeAgo } from '../lib/format.js';
import { useAuth } from '../lib/auth.jsx';

export default function Messages() {
  const { user } = useAuth();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const [threads, setThreads] = useState([]);
  const [active, setActive] = useState(null);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef(null);

  const activeUser = params.get('user');
  const activeItem = params.get('item');

  const loadThreads = useCallback(async () => {
    try {
      const d = await MessagesAPI.threads();
      setThreads(d.threads || []);
      return d.threads || [];
    } catch {
      return [];
    }
  }, []);

  const loadThread = useCallback(async (userId, itemId) => {
    if (!userId) return setActive(null);
    try {
      const d = await MessagesAPI.thread(userId, itemId);
      setActive(d);
    } catch {
      setActive(null);
    }
  }, []);

  useEffect(() => {
    (async () => {
      const list = await loadThreads();
      if (!activeUser && list.length) {
        const first = list[0];
        setParams(
          { user: String(first.user_id), ...(first.item_id ? { item: String(first.item_id) } : {}) },
          { replace: true }
        );
      }
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (activeUser) loadThread(activeUser, activeItem);
  }, [activeUser, activeItem, loadThread]);

  useEffect(() => {
    const t = setInterval(() => {
      loadThreads();
      if (activeUser) loadThread(activeUser, activeItem);
    }, 8000);
    return () => clearInterval(t);
  }, [activeUser, activeItem, loadThread, loadThreads]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [active?.messages?.length]);

  const send = async (e) => {
    e.preventDefault();
    if (!draft.trim() || !activeUser) return;
    setSending(true);
    try {
      await MessagesAPI.send({
        receiver_id: Number(activeUser),
        item_id: activeItem ? Number(activeItem) : null,
        message: draft,
      });
      setDraft('');
      await loadThread(activeUser, activeItem);
      loadThreads();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSending(false);
    }
  };

  const openThread = (t) => {
    setParams(
      { user: String(t.user_id), ...(t.item_id ? { item: String(t.item_id) } : {}) },
      { replace: true }
    );
  };

  if (loading) {
    return (
      <Card className="card-pad">
        <LoadingBlock rows={5} />
      </Card>
    );
  }

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow mb-2">Messages</div>
          <h1>Secure conversations</h1>
          <p>Coordinate a handover without ever sharing your phone number.</p>
        </div>
      </div>

      {threads.length === 0 ? (
        <Card className="card-pad">
          <Empty
            icon="message"
            title="No conversations yet"
            message="Open an item and choose “Message the reporter”, or start a chat from a possible match."
            action={
              <Button to="/app/matches" variant="ghost" iconRight="arrowRight">
                See possible matches
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="chat-layout">
          {/* ----------------------------------------------- conversations */}
          <Card className={`thread-list ${activeUser ? 'hide-mobile' : ''}`}>
            <div className="card-head" style={{ padding: 'var(--s-4)' }}>
              <h4 style={{ fontSize: 'var(--fs-md)' }}>Conversations</h4>
              <span className="tag">{threads.length}</span>
            </div>
            <div style={{ overflowY: 'auto' }}>
              {threads.map((t) => {
                const isActive =
                  String(t.user_id) === activeUser &&
                  String(t.item_id || '') === (activeItem || String(t.item_id || ''));
                return (
                  <button
                    key={`${t.user_id}-${t.item_id}`}
                    className={`thread ${isActive ? 'active' : ''}`}
                    onClick={() => openThread(t)}
                  >
                    <Avatar name={t.user?.name} hue={t.user?.avatar_hue} />
                    <div style={{ minWidth: 0 }}>
                      <div className="row-between">
                        <span className="small strong truncate">{t.user?.name}</span>
                        {t.unread > 0 && <span className="thread-dot" />}
                      </div>
                      {t.item && <div className="tiny faint truncate">re: {t.item.title}</div>}
                      <div className="tiny muted truncate">
                        {t.last_message?.sender_id === user.id ? 'You: ' : ''}
                        {t.last_message?.message}
                      </div>
                      <div className="tiny faint">{timeAgo(t.last_at)}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </Card>

          {/* ----------------------------------------------------- window */}
          <Card className={`chat-window ${!activeUser ? 'hide-mobile' : ''}`}>
            {!active ? (
              <Empty icon="message" title="Pick a conversation" message="Select someone on the left to start." />
            ) : (
              <>
                <div className="card-head" style={{ padding: 'var(--s-3) var(--s-4)' }}>
                  <div className="row gap-3">
                    <Avatar name={active.user?.name} hue={active.user?.avatar_hue} />
                    <div>
                      <div className="small strong">{active.user?.name}</div>
                      <div className="tiny faint">
                        {active.user?.role === 'admin' ? 'Administrator' : 'TraceBack member'}
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="subtle"
                    size="sm"
                    icon="arrowLeft"
                    className="only-sm"
                    onClick={() => setParams({}, { replace: true })}
                  >
                    Back
                  </Button>
                </div>

                {active.item && (
                  <Link to={`/items/${active.item.id}`} className="chat-context" style={{ color: 'inherit' }}>
                    {active.item.image_url ? (
                      <img src={active.item.image_url} alt={active.item.title} />
                    ) : (
                      <span className="thumb center">
                        <Icon name="box" size={16} />
                      </span>
                    )}
                    <div className="grow" style={{ minWidth: 0 }}>
                      <div className="tiny faint">
                        conversation about this {active.item.type} report
                      </div>
                      <div className="small strong truncate">{active.item.title}</div>
                      <div className="tiny muted truncate">
                        {active.item.category} · {active.item.location}
                      </div>
                    </div>
                    <StatusBadge status={active.item.status} />
                  </Link>
                )}

                <div className="chat-scroll" ref={scrollRef}>
                  {active.messages.length === 0 && (
                    <p className="small muted center-text">
                      No messages yet — say hello and describe the item to get started.
                    </p>
                  )}
                  {active.messages.map((m) => (
                    <div key={m.id} className={`bubble ${m.sender_id === user.id ? 'me' : 'them'}`}>
                      {m.message}
                      <span className="bubble-time">{timeAgo(m.created_at)}</span>
                    </div>
                  ))}
                </div>

                <form className="chat-compose" onSubmit={send}>
                  <input
                    className="input"
                    placeholder="Write a message…"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    maxLength={2000}
                  />
                  <Button type="submit" loading={sending} disabled={!draft.trim()} aria-label="Send">
                    <Icon name="send" size={16} />
                  </Button>
                </form>
              </>
            )}
          </Card>
        </div>
      )}
    </>
  );
}
