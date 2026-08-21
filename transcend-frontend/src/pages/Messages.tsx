import React, { useState, useEffect, useMemo } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { translateTextDetailed } from '../services/translationService';
import './Messages.css';

interface Conversation {
  id: string;
  providerName: string;
  providerService: string;
  lastMessage: string;
  lastMessageTime: string;
  contactInfo?: { phone?: string; email?: string };
  messages: Array<{
    id: string;
    sender: 'client' | 'provider';
    text: string;
    timestamp: string;
  }>;
}

const MOCK_CONVERSATIONS: Conversation[] = [
  {
    id: '1',
    providerName: 'Sarah Johnson, Esq.',
    providerService: 'Family Law',
    lastMessage: 'I can help with your custody case. Let me share my contact info.',
    lastMessageTime: '2m ago',
    contactInfo: { phone: '(555) 123-4567', email: 'sarah@lawfirm.com' },
    messages: [
      { id: '1', sender: 'provider', text: 'Hi! I received your intake form for Family Law services.', timestamp: '10m ago' },
      { id: '2', sender: 'provider', text: 'I can help with your custody case. Let me share my contact info.', timestamp: '2m ago' },
      { id: '3', sender: 'provider', text: '📞 Phone: (555) 123-4567\n📧 Email: sarah@lawfirm.com', timestamp: '2m ago' },
    ],
  },
  {
    id: '2',
    providerName: 'James Miller, Esq.',
    providerService: 'Personal Injury',
    lastMessage: 'Happy to discuss your case further.',
    lastMessageTime: '1h ago',
    contactInfo: { phone: '(555) 987-6543', email: 'james@injurylaw.com' },
    messages: [
      { id: '1', sender: 'provider', text: 'I reviewed your intake form. This looks like a strong case.', timestamp: '1h ago' },
      { id: '2', sender: 'provider', text: 'Happy to discuss your case further.', timestamp: '1h ago' },
    ],
  },
];

type TranslationState = {
  status: 'idle' | 'pending' | 'done' | 'unavailable';
  text: string;
};

/**
 * Translates message bodies for DISPLAY in the reader's selected language.
 *
 * The stored `text` on each message is never modified - it stays the source of
 * truth and remains viewable via "Show original". Keyed by the original text so
 * repeated wording resolves from cache.
 */
const useTranslatedMessages = (texts: string[], language: string) => {
  const [translations, setTranslations] = useState<Record<string, TranslationState>>({});

  // Stable key so the effect only re-runs when the actual set of texts changes.
  const textsKey = useMemo(() => JSON.stringify([...new Set(texts)].sort()), [texts]);

  useEffect(() => {
    const unique = [...new Set(texts)].filter(t => t.trim().length > 0);

    if (language === 'en' || unique.length === 0) {
      setTranslations({});
      return;
    }

    let cancelled = false;

    setTranslations(prev => {
      const next = { ...prev };
      for (const text of unique) {
        if (!next[text] || next[text].status === 'idle') {
          next[text] = { status: 'pending', text };
        }
      }
      return next;
    });

    // Fire-and-forget translation pass; cancellation is handled via `cancelled`.
    void (async () => {
      for (const text of unique) {
        const outcome = await translateTextDetailed(text, language);
        if (cancelled) return;
        setTranslations(prev => ({
          ...prev,
          [text]: {
            status: outcome.translated ? 'done' : 'unavailable',
            text: outcome.text,
          },
        }));
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [textsKey, language]);

  return translations;
};

export const Messages: React.FC = () => {
  const { t, language } = useLanguage();
  const [selectedId, setSelectedId] = useState('1');
  const [messageText, setMessageText] = useState('');
  const [conversations, setConversations] = useState(MOCK_CONVERSATIONS);
  const [showCompose, setShowCompose] = useState(false);
  const [newMessageData, setNewMessageData] = useState({ providerName: '', service: '', message: '' });
  // Message ids the reader has chosen to see in the original wording.
  const [showingOriginal, setShowingOriginal] = useState<Record<string, boolean>>({});

  const selected = conversations.find(c => c.id === selectedId);

  // Everything the reader can currently see: thread bodies + list previews.
  const translatableTexts = useMemo(
    () => [
      ...conversations.map(c => c.lastMessage),
      ...(selected ? selected.messages.map(m => m.text) : []),
    ],
    [conversations, selected]
  );

  const translations = useTranslatedMessages(translatableTexts, language);

  // Display copy for a stored message. Returns the raw text unless a real
  // translation exists and the reader has not asked for the original.
  const displayFor = (id: string, raw: string) => {
    const entry = translations[raw];
    const wantsOriginal = showingOriginal[id];
    const hasTranslation = entry?.status === 'done';

    return {
      text: hasTranslation && !wantsOriginal ? entry.text : raw,
      hasTranslation,
      isPending: entry?.status === 'pending',
      isUnavailable: entry?.status === 'unavailable',
      showingOriginal: !!wantsOriginal,
    };
  };

  const toggleOriginal = (id: string) =>
    setShowingOriginal(prev => ({ ...prev, [id]: !prev[id] }));

  const handleSendMessage = () => {
    if (!messageText.trim() || !selected) return;

    const newMessage = {
      id: `msg-${Date.now()}`,
      sender: 'client' as const,
      text: messageText,
      timestamp: 'now',
    };

    setConversations(convs =>
      convs.map(c =>
        c.id === selectedId
          ? { ...c, messages: [...c.messages, newMessage], lastMessage: messageText, lastMessageTime: 'now' }
          : c
      )
    );

    setMessageText('');
  };

  const handleStartNewMessage = () => {
    if (!newMessageData.providerName || !newMessageData.service || !newMessageData.message) return;

    const newConv: Conversation = {
      id: `conv-${Date.now()}`,
      providerName: newMessageData.providerName,
      providerService: newMessageData.service,
      lastMessage: newMessageData.message,
      lastMessageTime: 'now',
      messages: [
        {
          id: `msg-${Date.now()}`,
          sender: 'client',
          text: newMessageData.message,
          timestamp: 'now',
        },
      ],
    };

    setConversations([newConv, ...conversations]);
    setSelectedId(newConv.id);
    setShowCompose(false);
    setNewMessageData({ providerName: '', service: '', message: '' });
  };

  return (
    <div className="messages-container">
      <div className="conversations-list">
        <div className="list-header">
          <h2>{t('messagesPage.title')}</h2>
          <button className="new-message-btn" onClick={() => setShowCompose(true)}>
            + New Message
          </button>
        </div>
        {conversations.map(conv => (
          <div
            key={conv.id}
            className={`conversation-item ${selectedId === conv.id ? 'active' : ''}`}
            onClick={() => setSelectedId(conv.id)}
          >
            <div className="conv-header">
              <div className="conv-name">{conv.providerName}</div>
              <div className="conv-time">{conv.lastMessageTime}</div>
            </div>
            <div className="conv-service">{conv.providerService}</div>
            <div className="conv-preview">{displayFor(`preview-${conv.id}`, conv.lastMessage).text}</div>
          </div>
        ))}
      </div>

      {selected && (
        <div className="message-thread">
          <div className="thread-header">
            <div>
              <h2>{selected.providerName}</h2>
              <p>{selected.providerService}</p>
            </div>
            {selected.contactInfo && (
              <div className="contact-info">
                {selected.contactInfo.phone && <div>{t('messagesPage.phone')}: {selected.contactInfo.phone}</div>}
                {selected.contactInfo.email && <div>{t('messagesPage.email')}: {selected.contactInfo.email}</div>}
              </div>
            )}
          </div>

          <div className="messages-list">
            {selected.messages.map(msg => {
              const view = displayFor(msg.id, msg.text);
              return (
                <div key={msg.id} className={`message ${msg.sender}`}>
                  <div className="message-content">{view.text}</div>

                  {view.isPending && (
                    <div className="message-translation-note">{t('messagesPage.translating')}</div>
                  )}

                  {view.hasTranslation && (
                    <div className="message-translation-note">
                      <span>
                        {view.showingOriginal
                          ? t('messagesPage.originalLabel')
                          : t('messagesPage.translatedNotice')}
                      </span>
                      <button
                        type="button"
                        className="translation-toggle"
                        onClick={() => toggleOriginal(msg.id)}
                      >
                        {view.showingOriginal
                          ? t('messagesPage.showTranslation')
                          : t('messagesPage.showOriginal')}
                      </button>
                    </div>
                  )}

                  {view.isUnavailable && (
                    <div className="message-translation-note is-warning">
                      {t('messagesPage.translationUnavailable')}
                    </div>
                  )}

                  <div className="message-time">{msg.timestamp}</div>
                </div>
              );
            })}
          </div>

          <div className="message-composer">
            <p className="composer-note">{t('messagesPage.sentRawNotice')}</p>
            <div className="message-input">
              {/* What the user types is stored and sent verbatim - never translated. */}
              <input
                type="text"
                placeholder={t('messagesPage.inputPlaceholder')}
                value={messageText}
                onChange={e => setMessageText(e.target.value)}
                onKeyPress={e => e.key === 'Enter' && handleSendMessage()}
              />
              <button onClick={handleSendMessage} disabled={!messageText.trim()}>
                {t('messagesPage.send')}
              </button>
            </div>
          </div>
        </div>
      )}

      {showCompose && (
        <div className="compose-modal-overlay" onClick={() => setShowCompose(false)}>
          <div className="compose-modal" onClick={e => e.stopPropagation()}>
            <div className="compose-header">
              <h3>New Message</h3>
              <button className="close-btn" onClick={() => setShowCompose(false)}>✕</button>
            </div>
            <div className="compose-body">
              <div className="compose-field">
                <label>Service Provider</label>
                <input
                  type="text"
                  placeholder="Enter provider name..."
                  value={newMessageData.providerName}
                  onChange={e => setNewMessageData({ ...newMessageData, providerName: e.target.value })}
                />
              </div>
              <div className="compose-field">
                <label>Service Type</label>
                <input
                  type="text"
                  placeholder="e.g., Legal Research, Notary..."
                  value={newMessageData.service}
                  onChange={e => setNewMessageData({ ...newMessageData, service: e.target.value })}
                />
              </div>
              <div className="compose-field">
                <label>Message</label>
                <textarea
                  placeholder="Type your message..."
                  rows={5}
                  value={newMessageData.message}
                  onChange={e => setNewMessageData({ ...newMessageData, message: e.target.value })}
                />
              </div>
              <div className="compose-actions">
                <button
                  className="btn-cancel"
                  onClick={() => setShowCompose(false)}
                >
                  Cancel
                </button>
                <button
                  className="btn-send"
                  onClick={handleStartNewMessage}
                  disabled={!newMessageData.providerName || !newMessageData.service || !newMessageData.message}
                >
                  Send
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Messages;
