import React, { useState, useEffect, useRef, useCallback } from 'react';
import { gql, useQuery } from '@apollo/client';
import { WS_URL } from '../apolloClient';
import { LogOut, Send, User as UserIcon, Reply, X, MessageCircle, Wifi, WifiOff } from 'lucide-react';

const GET_USERS = gql`
  query GetUsers {
    users {
      id
      username
      isOnline
    }
    me {
      id
      username
    }
  }
`;

const GET_MESSAGES = gql`
  query GetMessages($userId: Int!) {
    messages(userId: $userId) {
      id
      content
      reaction
      sender { id username }
      receiver { id }
      replyTo { id content }
      timestamp
    }
  }
`;

export default function Chat() {
  const [activeUser, setActiveUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messageInput, setMessageInput] = useState('');
  const [users, setUsers] = useState([]);
  const [me, setMe] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [hoverMsg, setHoverMsg] = useState(null);
  const [replyTo, setReplyTo] = useState(null);
  const [showMobileSidebar, setShowMobileSidebar] = useState(true);
  const [wsConnected, setWsConnected] = useState(false);
  const ws = useRef(null);
  const isClosingIntentionally = useRef(false);
  const reconnectTimer = useRef(null);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const { data: usersData, error: usersError } = useQuery(GET_USERS, {
    onError: (err) => {
      if (err.message?.includes('Signature has expired') || err.message?.includes('Not authenticated')) {
        localStorage.removeItem('token');
        localStorage.removeItem('username');
        window.location.href = '/signin';
      }
    }
  });

  useEffect(() => {
    if (usersData) {
      setUsers(usersData.users);
      setMe(usersData.me);
    }
  }, [usersData]);

  const { refetch: fetchMessages } = useQuery(GET_MESSAGES, { skip: true });

  // ── WebSocket with auto-reconnect ──
  const connectWebSocket = useCallback(() => {
    const token = localStorage.getItem('token');
    if (!token || token === 'undefined') {
      localStorage.removeItem('token');
      window.location.href = '/signin';
      return;
    }

    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      if (payload.exp * 1000 < Date.now()) {
        localStorage.removeItem('token');
        window.location.href = '/signin';
        return;
      }
    } catch {
      localStorage.removeItem('token');
      window.location.href = '/signin';
      return;
    }

    if (ws.current && ws.current.readyState === WebSocket.OPEN) return;

    isClosingIntentionally.current = false;
    const socket = new WebSocket(`${WS_URL}/ws/chat/?token=${token}`);
    ws.current = socket;

    socket.onopen = () => setWsConnected(true);

    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'user_status') {
        setUsers(prev => prev.map(u =>
          u.id.toString() === data.user_id.toString()
            ? { ...u, isOnline: data.is_online } : u
        ));
      } else if (data.type === 'chat_message') {
        setMessages(prev => [...prev, {
          id: data.message_id,
          content: data.content,
          sender: { id: data.sender_id },
          receiver: { id: data.receiver_id },
          timestamp: data.timestamp,
          reaction: data.reaction || null,
          replyTo: data.reply_to_id ? { id: data.reply_to_id, content: data.reply_to_content } : null,
        }]);
      } else if (data.type === 'reaction_update') {
        setMessages(prev => prev.map(m =>
          m.id?.toString() === data.message_id?.toString()
            ? { ...m, reaction: data.reaction } : m
        ));
      } else if (data.type === 'notification') {
        const notif = { id: Date.now(), text: data.message };
        setNotifications(prev => [...prev, notif]);
        setTimeout(() => setNotifications(prev => prev.filter(n => n.id !== notif.id)), 4000);
      }
    };

    socket.onerror = () => {};
    socket.onclose = () => {
      setWsConnected(false);
      if (!isClosingIntentionally.current) {
        reconnectTimer.current = setTimeout(connectWebSocket, 3000);
      }
    };
  }, []);

  useEffect(() => {
    connectWebSocket();
    return () => {
      isClosingIntentionally.current = true;
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      if (ws.current) ws.current.close();
    };
  }, [connectWebSocket]);

  // ── Load messages ──
  useEffect(() => {
    if (activeUser) {
      fetchMessages({ userId: parseInt(activeUser.id) }).then(({ data }) => {
        if (data?.messages) setMessages(data.messages);
      }).catch(() => {});
    }
  }, [activeUser, fetchMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!messageInput.trim() || !activeUser) return;
    if (!ws.current || ws.current.readyState !== WebSocket.OPEN) {
      const notif = { id: Date.now(), text: 'Connection lost. Reconnecting...' };
      setNotifications(prev => [...prev, notif]);
      setTimeout(() => setNotifications(prev => prev.filter(n => n.id !== notif.id)), 3000);
      connectWebSocket();
      return;
    }

    const payload = { type: 'chat_message', receiver_id: activeUser.id, content: messageInput };
    if (replyTo) payload.reply_to = replyTo.id;

    ws.current.send(JSON.stringify(payload));
    setMessageInput('');
    setReplyTo(null);
  };

  const handleReaction = useCallback((msgId, emoji) => {
    if (!ws.current || ws.current.readyState !== WebSocket.OPEN) return;
    ws.current.send(JSON.stringify({ type: 'add_reaction', message_id: msgId, reaction: emoji }));
    setMessages(prev => prev.map(m =>
      m.id?.toString() === msgId?.toString() ? { ...m, reaction: emoji } : m
    ));
    setHoverMsg(null);
  }, []);

  const handleReply = useCallback((msg) => {
    setReplyTo(msg);
    setTimeout(() => inputRef.current?.focus(), 50);
  }, []);

  const handleLogout = () => {
    isClosingIntentionally.current = true;
    if (ws.current) ws.current.close();
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    window.location.href = '/signin';
  };

  const selectUser = (user) => {
    setActiveUser(user);
    setShowMobileSidebar(false);
  };

  const EMOJIS = ['👍', '❤️', '😂', '😮', '🔥'];

  const formatTime = (ts) => {
    if (!ts) return '';
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="chat-container">
      {/* Notifications */}
      <div className="notification-stack">
        {notifications.map(n => (
          <div key={n.id} className="notification">
            <MessageCircle size={16} /> {n.text}
          </div>
        ))}
      </div>

      {/* Sidebar */}
      <div className={`sidebar ${showMobileSidebar ? 'mobile-show' : 'mobile-hide'}`}>
        <div className="sidebar-header">
          <div className="sidebar-user-info">
            <div className="avatar avatar-sm">
              {me?.username?.charAt(0).toUpperCase()}
              <div className="status-indicator online"></div>
            </div>
            <div className="sidebar-user-name">
              <span className="username-text">{me?.username}</span>
              <span className="status-text">
                {wsConnected ? <><Wifi size={10} /> Connected</> : <><WifiOff size={10} /> Reconnecting...</>}
              </span>
            </div>
          </div>
          <button onClick={handleLogout} className="icon-btn" title="Sign out">
            <LogOut size={18} />
          </button>
        </div>

        <div className="user-list">
          {users.length === 0 && (
            <div style={{ padding: '2rem 1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              No other users yet. Share the link!
            </div>
          )}
          {users.map(user => (
            <div
              key={user.id}
              className={`user-item ${activeUser?.id === user.id ? 'active' : ''}`}
              onClick={() => selectUser(user)}
            >
              <div className="avatar">
                {user.username.charAt(0).toUpperCase()}
                <div className={`status-indicator ${user.isOnline ? 'online' : ''}`}></div>
              </div>
              <div className="user-item-info">
                <div className="user-item-name">{user.username}</div>
                <div className="user-item-status">
                  {user.isOnline ? '● Online' : '○ Offline'}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Chat area */}
      <div className={`chat-main ${!showMobileSidebar ? 'mobile-show' : 'mobile-hide'}`}>
        {activeUser ? (
          <>
            <div className="chat-header">
              <button className="back-btn icon-btn" onClick={() => setShowMobileSidebar(true)}>←</button>
              <div className="avatar avatar-sm">
                {activeUser.username.charAt(0).toUpperCase()}
                <div className={`status-indicator ${activeUser.isOnline ? 'online' : ''}`}></div>
              </div>
              <div className="chat-header-info">
                <div className="chat-header-name">{activeUser.username}</div>
                <div className="chat-header-status">
                  {activeUser.isOnline ? 'Active now' : 'Offline'}
                </div>
              </div>
            </div>

            <div className="messages-area">
              {messages
                .filter(msg => {
                  if (!msg.receiver) return true;
                  return msg.sender.id.toString() === activeUser.id.toString() ||
                         msg.receiver.id.toString() === activeUser.id.toString();
                })
                .map(msg => {
                  const isSent = msg.sender.id.toString() === me?.id?.toString();
                  return (
                    <div
                      key={msg.id}
                      className={`message-wrapper ${isSent ? 'sent' : 'received'}`}
                      onMouseEnter={() => setHoverMsg(msg.id)}
                      onMouseLeave={() => setHoverMsg(null)}
                    >
                      <div className={`message-bubble ${isSent ? 'sent' : 'received'}`}>
                        {msg.replyTo && (
                          <div className="reply-preview">
                            <div className="reply-preview-label">↩ Reply</div>
                            <div className="reply-preview-text">
                              {typeof msg.replyTo === 'object' ? msg.replyTo.content?.slice(0, 50) : 'Original message'}
                            </div>
                          </div>
                        )}
                        <div className="message-content">{msg.content}</div>
                        <div className="message-meta">
                          <span className="message-time">{formatTime(msg.timestamp)}</span>
                          {msg.reaction && <span className="reaction-badge">{msg.reaction}</span>}
                        </div>
                      </div>
                      {hoverMsg === msg.id && (
                        <div className={`msg-actions ${isSent ? 'actions-left' : 'actions-right'}`}>
                          <button className="action-btn" onClick={() => handleReply(msg)} title="Reply">
                            <Reply size={14} />
                          </button>
                          <div className="emoji-picker-mini">
                            {EMOJIS.map(e => (
                              <span key={e} className="emoji-option" onClick={() => handleReaction(msg.id, e)}>{e}</span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              <div ref={messagesEndRef} />
            </div>

            <form className="message-input-area" onSubmit={handleSendMessage}>
              {replyTo && (
                <div className="reply-bar">
                  <div className="reply-bar-content">
                    <Reply size={14} />
                    <span>Replying to: <em>{replyTo.content?.slice(0, 50)}</em></span>
                  </div>
                  <button type="button" onClick={() => setReplyTo(null)} className="reply-cancel">
                    <X size={14} />
                  </button>
                </div>
              )}
              <div className="input-row">
                <input ref={inputRef} type="text" placeholder="Type a message..." value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)} autoComplete="off" />
                <button type="submit" className="send-btn" disabled={!messageInput.trim()}>
                  <Send size={18} />
                </button>
              </div>
            </form>
          </>
        ) : (
          <div className="empty-chat">
            <div className="empty-chat-icon"><MessageCircle size={72} strokeWidth={1} /></div>
            <h2>Welcome{me ? `, ${me.username}` : ''}!</h2>
            <p>Select a conversation to start messaging</p>
          </div>
        )}
      </div>
    </div>
  );
}
