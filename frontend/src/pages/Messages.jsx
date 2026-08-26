import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api from '../api/client.js';
import { onSocketEvent } from '../api/socket.js';
import { Empty, ErrorBanner, Loading } from '../components/Feedback.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useNotifications } from '../context/NotificationContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import useApi from '../hooks/useApi.js';
import { humanStatus, relativeTime, statusTone } from '../utils/format.js';

/** Messages / Contact - item-scoped chat with realtime delivery. */
export default function Messages() {
  const { itemId, userId } = useParams();
  const { user } = useAuth();
  const toast = useToast();
  const { reload: reloadBell, setUnreadMessages } = useNotifications();

  const { data: threadData, error, loading, reload: reloadThreads } = useApi('/messages/threads');
  const [conversation, setConversation] = useState(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const scroller = useRef(null);

  const hasThread = Boolean(itemId && userId);

  const loadConversation = useCallback(async () => {
    if (!hasThread) {
      setConversation(null);
      return;
    }
    try {
      const data = await api.get(`/messages/${itemId}/${userId}`);
      setConversation(data);
      await api.patch(`/messages/${itemId}/${userId}/read`).catch(() => {});
      setUnreadMessages(0);
      reloadBell();
    } catch (loadError) {
      toast.error(loadError.message);
    }
  }, [hasThread, itemId, userId, toast, reloadBell, setUnreadMessages]);

  useEffect(() => {
    loadConversation();
  }, [loadConversation]);

  // Realtime: append messages that belong to the open thread.
  useEffect(() => {
    if (!hasThread) return undefined;
    return onSocketEvent('message:new', (message) => {
      const sameItem = Number(message.item_id) === Number(itemId);
      const sameParties =
        [Number(message.sender_id), Number(message.receiver_id)].includes(Number(userId)) &&
        [Number(message.sender_id), Number(message.receiver_id)].includes(Number(user.user_id));
      if (!sameItem || !sameParties) {
        reloadThreads();
        return;
      }
      setConversation((current) => {
        if (!current) return current;
        if (current.messages.some((entry) => entry.message_id === message.message_id)) return current;
        return { ...current, messages: [...current.messages, message] };
      });
    });
  }, [hasThread, itemId, userId, user.user_id, reloadThreads]);

  // Keep the scroll pinned to the newest message.
  useEffect(() => {
    if (scroller.current) scroller.current.scrollTop = scroller.current.scrollHeight;
  }, [conversation?.messages?.length]);

  const send = async (event) => {
    event.preventDefault();
    const text = draft.trim();
    if (!text) return;
    setSending(true);
    try {
      const { message } = await api.post('/messages', {
        item_id: Number(itemId),
        receiver_id: Number(userId),
        message: text,
      });
      setDraft('');
      setConversation((current) =>
        current && !current.messages.some((entry) => entry.message_id === message.message_id)
          ? { ...current, messages: [...current.messages, message] }
          : current,
      );
      reloadThreads();
    } catch (sendError) {
      toast.error(sendError.message);
    } finally {
      setSending(false);
    }
  };

  if (loading) return <Loading />;

  const threads = threadData?.threads ?? [];

  return (
    <div className="container">
      <div className="page-head">
        <div>
          <h1>Messages</h1>
          <p>Conversations are scoped to one item, so nobody can cold-message you.</p>
        </div>
      </div>

      <ErrorBanner error={error} onRetry={reloadThreads} />

      <div className="chat-layout">
        <div className="card card-tight">
          <h3 style={{ padding: '0 4px' }}>Conversations</h3>
          {threads.length === 0 ? (
            <p className="muted small" style={{ padding: '0 4px' }}>
              No conversations yet. Open an item and press “Message the reporter”.
            </p>
          ) : (
            <ul className="thread-list">
              {threads.map((thread) => (
                <li key={`${thread.item_id}:${thread.counterpart_id}`}>
                  <Link
                    to={`/messages/${thread.item_id}/${thread.counterpart_id}`}
                    className={`thread-item${
                      Number(itemId) === Number(thread.item_id) && Number(userId) === Number(thread.counterpart_id) ? ' active' : ''
                    }`}
                  >
                    <div className="row row-between">
                      <strong className="small">{thread.counterpart_name}</strong>
                      {thread.unread > 0 && <span className="badge badge-danger">{thread.unread}</span>}
                    </div>
                    <div className="muted tiny">{thread.item_title}</div>
                    <div className="muted small" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {thread.last_message}
                    </div>
                    <div className="muted tiny">{relativeTime(thread.last_message_at)}</div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card">
          {!hasThread ? (
            <Empty icon="💬" title="Select a conversation">
              Pick a thread on the left, or start one from an item page.
            </Empty>
          ) : (
            <>
              <div className="card-head">
                <div>
                  <h3 style={{ margin: 0 }}>{conversation?.counterpart?.name ?? 'Conversation'}</h3>
                  {conversation?.item && (
                    <div className="muted small">
                      About <Link to={`/items/${conversation.item.item_id}`}>{conversation.item.title}</Link>{' '}
                      <span className={statusTone(conversation.item.status)}>{humanStatus(conversation.item.status)}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="chat-window">
                <div className="chat-messages" ref={scroller}>
                  {(conversation?.messages ?? []).length === 0 ? (
                    <p className="muted small center">No messages yet — say hello.</p>
                  ) : (
                    conversation.messages.map((message) => (
                      <div
                        key={message.message_id}
                        className={`bubble${Number(message.sender_id) === Number(user.user_id) ? ' mine' : ''}`}
                      >
                        {message.message}
                        <span className="bubble-time">{relativeTime(message.timestamp)}</span>
                      </div>
                    ))
                  )}
                </div>

                <form className="chat-composer" onSubmit={send}>
                  <input
                    placeholder="Write a message…"
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    maxLength={2000}
                    aria-label="Message"
                  />
                  <button type="submit" className="btn" disabled={sending || !draft.trim()}>
                    Send
                  </button>
                </form>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
