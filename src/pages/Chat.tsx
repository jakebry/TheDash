import { useState, useEffect, useRef } from 'react';
import { MessageSquare, Search, Send, Plus, Users, ChevronLeft, User } from 'lucide-react';
import Layout from '../components/Layout';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/useAuth';
import toast from 'react-hot-toast';
import { CreateChatModal } from '../components/chat/CreateChatModal';

type ChatType = 'group' | 'private';

interface ChatMessage {
  id: string;
  message: string;
  created_at: string;
  sender_id: string;
  sender?: {
    id: string;
    full_name: string;
    email: string;
    avatar_url: string | null;
  };
}

interface ChatRoom {
  id: string;
  name: string;
  last_message?: string;
  last_message_time?: string;
  type: ChatType;
  unread_count: number;
  business_id: string;
  business_name: string;
  recipient_id?: string;
  recipient?: {
    id: string;
    full_name: string;
    email: string;
    avatar_url: string | null;
  };
}

interface Business {
  id: string;
  name: string;
}

export default function Chat() {
  const [chatRooms, setChatRooms] = useState<ChatRoom[]>([]);
  const [selectedChat, setSelectedChat] = useState<ChatRoom | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [loading, setLoading] = useState(true);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isMobileView, setIsMobileView] = useState(false);
  const [showChatList, setShowChatList] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();

  useEffect(() => {
    if (window.innerWidth < 768) {
      setIsMobileView(true);
    }

    const handleResize = () => {
      setIsMobileView(window.innerWidth < 768);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (user) {
      fetchUserBusinesses();
    }
  }, [user]);

  useEffect(() => {
    if (user && businesses.length > 0) {
      fetchChatRooms();
    }
  }, [user, businesses]);

  useEffect(() => {
    if (selectedChat) {
      setLoadingMessages(true);
      fetchMessages(selectedChat);
      if (isMobileView) {
        setShowChatList(false);
      }
      
      // Set up subscription for new messages
      const subscription = supabase
        .channel(`chat-${selectedChat.id}`)
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: selectedChat.type === 'group' 
            ? `business_id=eq.${selectedChat.business_id} AND is_private=eq.false`
            : `((sender_id=eq.${user?.id} AND recipient_id=eq.${selectedChat.recipient_id}) OR 
                (sender_id=eq.${selectedChat.recipient_id} AND recipient_id=eq.${user?.id}))`
        }, (payload) => {
          // Add user details to new messages
          fetchSenderDetails(payload.new.sender_id).then(sender => {
            const newMessage = {
              ...payload.new,
              sender
            } as ChatMessage;
            setMessages(prev => [...prev, newMessage]);
          });
        })
        .subscribe();

      return () => {
        subscription.unsubscribe();
      };
    }
  }, [selectedChat]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchUserBusinesses = async () => {
    try {
      const { data: membershipData, error: membershipError } = await supabase
        .from('business_members')
        .select('business_id')
        .eq('user_id', user?.id);
        
      if (membershipError) throw membershipError;
      
      if (!membershipData || membershipData.length === 0) {
        setLoading(false);
        return;
      }
      
      const businessIds = membershipData.map(membership => membership.business_id);
      
      const { data: businessesData, error: businessesError } = await supabase
        .from('businesses')
        .select('id, name')
        .in('id', businessIds);
        
      if (businessesError) throw businessesError;
      
      setBusinesses(businessesData || []);
    } catch (error) {
      console.error('Error fetching businesses:', error);
      toast.error('Failed to load businesses');
    } finally {
      setLoading(false);
    }
  };

  const fetchChatRooms = async () => {
    try {
      setLoading(true);
      
      // First get group chats for each business
      const groupChats = await Promise.all(
        businesses.map(async (business) => {
          // Get the latest message to show in the chat list
          const { data: latestMessage, error: messageError } = await supabase
            .from('chat_messages')
            .select('message, created_at')
            .eq('business_id', business.id)
            .eq('is_private', false)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle(); // Changed from .single() to .maybeSingle()
          
          // Calculate timestamp 2 days ago in JavaScript instead of using SQL
          const twoDaysAgo = new Date();
          twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
          
          // Get unread count
          const { count, error: countError } = await supabase
            .from('chat_messages')
            .select('*', { count: 'exact', head: true })
            .eq('business_id', business.id)
            .eq('is_private', false)
            .gt('created_at', twoDaysAgo.toISOString());
            
          return {
            id: `group-${business.id}`,
            name: `${business.name} Group Chat`,
            last_message: latestMessage?.message || '',
            last_message_time: latestMessage?.created_at || '',
            type: 'group' as ChatType,
            unread_count: count || 0,
            business_id: business.id,
            business_name: business.name
          };
        })
      );
      
      // Initialize array for private chats
      let privateChats: ChatRoom[] = [];
      
      // Instead of using the complex join, fetch chats separately and combine
      const { data: sentMessages, error: sentError } = await supabase
        .from('chat_messages')
        .select('id, message, created_at, business_id, is_private, recipient_id')
        .eq('sender_id', user?.id)
        .eq('is_private', true)
        .order('created_at', { ascending: false });
        
      if (sentError) throw sentError;
      
      // Get received messages
      const { data: receivedMessages, error: receivedError } = await supabase
        .from('chat_messages')
        .select('id, message, created_at, business_id, is_private, sender_id')
        .eq('recipient_id', user?.id)
        .eq('is_private', true)
        .order('created_at', { ascending: false });
        
      if (receivedError) throw receivedError;
      
      // Process private chats
      const processedPrivateChats: Record<string, ChatRoom> = {};
      
      // Get business names for sent messages
      if (sentMessages && sentMessages.length > 0) {
        // Get recipient details for each message
        for (const message of sentMessages) {
          if (!message.recipient_id) continue;
          
          // Get business name
          const business = businesses.find(b => b.id === message.business_id);
          if (!business) continue;
          
          // Get recipient details
          const { data: recipientData, error: recipientError } = await supabase
            .from('profiles')
            .select('id, full_name, email, avatar_url')
            .eq('id', message.recipient_id)
            .single();
            
          if (recipientError || !recipientData) continue;
          
          const chatId = `private-${message.business_id}-${recipientData.id}`;
          
          if (!processedPrivateChats[chatId]) {
            processedPrivateChats[chatId] = {
              id: chatId,
              name: recipientData.full_name || recipientData.email,
              last_message: message.message,
              last_message_time: message.created_at,
              type: 'private',
              unread_count: 0,
              business_id: message.business_id,
              business_name: business.name,
              recipient_id: recipientData.id,
              recipient: recipientData
            };
          }
        }
      }
      
      // Process received messages
      if (receivedMessages && receivedMessages.length > 0) {
        // Get sender details for each message
        for (const message of receivedMessages) {
          if (!message.sender_id) continue;
          
          // Get business name
          const business = businesses.find(b => b.id === message.business_id);
          if (!business) continue;
          
          // Get sender details
          const { data: senderData, error: senderError } = await supabase
            .from('profiles')
            .select('id, full_name, email, avatar_url')
            .eq('id', message.sender_id)
            .single();
            
          if (senderError || !senderData) continue;
          
          const chatId = `private-${message.business_id}-${senderData.id}`;
          
          if (!processedPrivateChats[chatId]) {
            processedPrivateChats[chatId] = {
              id: chatId,
              name: senderData.full_name || senderData.email,
              last_message: message.message,
              last_message_time: message.created_at,
              type: 'private',
              unread_count: 0,
              business_id: message.business_id,
              business_name: business.name,
              recipient_id: senderData.id,
              recipient: senderData
            };
          }
        }
      }
      
      // Combine group and private chats
      setChatRooms([
        ...groupChats, 
        ...Object.values(processedPrivateChats)
      ].sort((a, b) => {
        if (!a.last_message_time) return 1;
        if (!b.last_message_time) return -1;
        return new Date(b.last_message_time).getTime() - new Date(a.last_message_time).getTime();
      }));
      
      // Select first chat if none is selected
      if (!selectedChat && groupChats.length > 0) {
        setSelectedChat(groupChats[0]);
      }
    } catch (error) {
      console.error('Error fetching chat rooms:', error);
      toast.error('Failed to load chat rooms');
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async (chat: ChatRoom) => {
    try {
      setLoadingMessages(true);
      
      let messages;
      
      if (chat.type === 'group') {
        // Group chat - fetch messages directly without join
        const { data: messageData, error: messageError } = await supabase
          .from('chat_messages')
          .select('id, message, created_at, sender_id')
          .eq('business_id', chat.business_id)
          .eq('is_private', false)
          .order('created_at', { ascending: true });
          
        if (messageError) throw messageError;
        
        // Fetch sender details for each message
        messages = await Promise.all((messageData || []).map(async (message) => {
          const sender = await fetchSenderDetails(message.sender_id);
          return {
            ...message,
            sender
          };
        }));
      } else {
        // Private chat - fetch messages directly without join
        const { data: messageData, error: messageError } = await supabase
          .from('chat_messages')
          .select('id, message, created_at, sender_id')
          .eq('business_id', chat.business_id)
          .eq('is_private', true)
          .or(`sender_id.eq.${user?.id},recipient_id.eq.${user?.id}`)
          .or(`sender_id.eq.${chat.recipient_id},recipient_id.eq.${chat.recipient_id}`)
          .order('created_at', { ascending: true });
          
        if (messageError) throw messageError;
        
        // Fetch sender details for each message
        messages = await Promise.all((messageData || []).map(async (message) => {
          const sender = await fetchSenderDetails(message.sender_id);
          return {
            ...message,
            sender
          };
        }));
      }
      
      setMessages(messages || []);
    } catch (error) {
      console.error('Error fetching messages:', error);
      toast.error('Failed to load messages');
    } finally {
      setLoadingMessages(false);
    }
  };

  const fetchSenderDetails = async (senderId: string) => {
    if (!senderId) return null;
    
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email, avatar_url')
        .eq('id', senderId)
        .single();
        
      if (error) throw error;
      
      return data;
    } catch (error) {
      console.error('Error fetching sender details:', error);
      return null;
    }
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedChat || !newMessage.trim() || !user) return;
    
    try {
      setSendingMessage(true);
      
      const messageData = {
        business_id: selectedChat.business_id,
        message: newMessage.trim(),
        user_id: user.id,
        sender_id: user.id,
        is_private: selectedChat.type === 'private',
        recipient_id: selectedChat.type === 'private' ? selectedChat.recipient_id : null
      };
      
      const { error } = await supabase
        .from('chat_messages')
        .insert(messageData);
        
      if (error) throw error;
      
      setNewMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Failed to send message');
    } finally {
      setSendingMessage(false);
    }
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (timestamp: string) => {
    const date = new Date(timestamp);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString();
    }
  };

  const filteredChatRooms = chatRooms.filter(chat => 
    chat.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const renderChatList = () => {
    if (isMobileView && !showChatList) return null;
    
    return (
      <div className={`${isMobileView ? 'w-full' : 'w-96'} bg-highlight-blue/50 backdrop-blur-xl rounded-l-xl overflow-hidden flex flex-col border-r border-light-blue/30`}>
        <div className="p-4 border-b border-light-blue">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-white">Messages</h2>
            <button
              onClick={() => setShowNewChatModal(true)}
              className="p-2 bg-neon-blue/10 hover:bg-neon-blue/20 text-neon-blue rounded-full transition-all duration-200"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search chats..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2.5 bg-light-blue/50 border border-light-blue/30 rounded-lg text-white focus:outline-none focus:border-neon-blue/50 focus:bg-light-blue/80 transition-all duration-200"
            />
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto py-2">
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-neon-blue"></div>
            </div>
          ) : filteredChatRooms.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              No chats found
            </div>
          ) : (
            <div className="space-y-1">
              {filteredChatRooms.map((chat) => (
                <button
                  key={chat.id}
                  onClick={() => {
                    setSelectedChat(chat);
                    if (isMobileView) setShowChatList(false);
                  }}
                  className={`w-full px-4 py-3 flex items-center text-left hover:bg-light-blue/30 transition-all duration-200 ${
                    selectedChat?.id === chat.id ? 'bg-light-blue/50 shadow-lg' : ''
                  }`}
                >
                  <div className="flex-shrink-0 w-12 h-12 rounded-full bg-neon-blue/10 flex items-center justify-center overflow-hidden mr-3 border-2 border-neon-blue/20">
                    {chat.type === 'group' ? (
                      <Users className="w-5 h-5 text-neon-blue" />
                    ) : chat.recipient?.avatar_url ? (
                      <img
                        src={chat.recipient.avatar_url}
                        alt={chat.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <User className="w-5 h-5 text-neon-blue" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-baseline">
                      <p className="font-medium text-white truncate">{chat.name}</p>
                      {chat.last_message_time && (
                        <span className="text-xs text-gray-400 ml-1">
                          {formatTime(chat.last_message_time)}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-400 truncate">
                      {chat.last_message || `Start chatting in ${chat.business_name}`}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderChatWindow = () => {
    if (isMobileView && showChatList) return null;
    
    return (
      <div className="flex-1 flex flex-col bg-highlight-blue/50 backdrop-blur-xl rounded-r-xl overflow-hidden">
        {selectedChat ? (
          <>
            <div className="px-6 py-4 border-b border-light-blue/30 flex items-center bg-highlight-blue/30 backdrop-blur-xl">
              {isMobileView && (
                <button
                  onClick={() => setShowChatList(true)}
                  className="mr-3 text-gray-400 hover:text-white transition-colors"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
              )}
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-neon-blue/10 flex items-center justify-center overflow-hidden mr-3 border-2 border-neon-blue/20">
                {selectedChat.type === 'group' ? (
                  <Users className="w-4 h-4 text-neon-blue" />
                ) : selectedChat.recipient?.avatar_url ? (
                  <img
                    src={selectedChat.recipient.avatar_url}
                    alt={selectedChat.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <User className="w-4 h-4 text-neon-blue" />
                )}
              </div>
              <div>
                <h3 className="font-medium text-white">{selectedChat.name}</h3>
                <p className="text-xs text-gray-400">{selectedChat.business_name}</p>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4">
              {loadingMessages ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-neon-blue"></div>
                </div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <MessageSquare className="w-12 h-12 text-gray-500 mb-4" />
                  <p className="text-gray-400 mb-2">No messages yet</p>
                  <p className="text-sm text-gray-500">
                    {selectedChat.type === 'group' 
                      ? `Start the conversation in ${selectedChat.business_name}` 
                      : `Start chatting with ${selectedChat.name}`}
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Sticky header */}
                  <div className="sticky top-0 left-0 right-0 z-10 flex justify-center py-2">
                    <div className="px-4 py-1.5 bg-highlight-blue/70 backdrop-blur-sm rounded-full text-sm text-gray-300 shadow-lg">
                      {selectedChat.business_name} • {selectedChat.type === 'group' ? 'Group Chat' : 'Private Chat'}
                    </div>
                  </div>
                  {/* Messages */}
                  {messages.map((message, index) => {
                    const isFirstOfDay = index === 0 || 
                      formatDate(message.created_at) !== formatDate(messages[index - 1].created_at);
                    
                    const isCurrentUser = message.sender_id === user?.id;
                    
                    return (
                      <div key={message.id}>
                        {isFirstOfDay && (
                          <div className="flex justify-center my-4">
                            <span className="px-3 py-1.5 bg-light-blue/30 backdrop-blur-sm rounded-full text-xs text-gray-400 shadow-lg">
                              {formatDate(message.created_at)}
                            </span>
                          </div>
                        )}
                        
                        <div className={`flex ${isCurrentUser ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-[75%] ${isCurrentUser ? 'order-2' : 'order-1'}`}>
                            {!isCurrentUser && selectedChat.type === 'group' && (
                              <p className="text-xs text-gray-400 ml-10 mb-1">
                                {message.sender?.full_name || message.sender?.email}
                              </p>
                            )}
                            
                            <div className="flex items-end gap-2">
                              {!isCurrentUser && (
                                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-light-blue/30 flex items-center justify-center overflow-hidden border border-light-blue/30">
                                  {message.sender?.avatar_url ? (
                                    <img
                                      src={message.sender.avatar_url}
                                      alt={message.sender.full_name || message.sender.email}
                                      className="w-full h-full object-cover"
                                    />
                                  ) : (
                                    <span className="text-xs text-white">
                                      {(message.sender?.full_name || message.sender?.email || '?')[0].toUpperCase()}
                                    </span>
                                  )}
                                </div>
                              )}
                              
                              <div className={`rounded-xl py-2 px-4 ${
                                isCurrentUser 
                                  ? 'bg-neon-blue text-white rounded-br-none shadow-lg'
                                  : message.is_system_message
                                    ? 'bg-gray-500/20 backdrop-blur-sm text-gray-300 rounded-lg shadow-lg'
                                  : message.is_system_message
                                    ? 'bg-gray-500/20 backdrop-blur-sm text-gray-300 rounded-lg shadow-lg'
                                    : 'bg-light-blue/50 backdrop-blur-sm text-white rounded-bl-none shadow-lg'
                              }`}>
                                <p>{message.message}</p>
                                <p className="text-xs opacity-70 mt-1">
                                  {formatTime(message.created_at)}
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>
            
            <form onSubmit={sendMessage} className="p-4 border-t border-light-blue/30 bg-highlight-blue/30 backdrop-blur-xl">
              <div className="flex items-center gap-2">
                <input
                  autoComplete="off"
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Type a message..."
                  className="flex-1 px-4 py-2.5 bg-light-blue/50 border border-light-blue/30 rounded-lg text-white focus:outline-none focus:border-neon-blue/50 focus:bg-light-blue/80 transition-all duration-200 placeholder-gray-400"
                  disabled={sendingMessage}
                />
                <button
                  type="submit"
                  disabled={!newMessage.trim() || sendingMessage}
                  className="p-2.5 bg-neon-blue text-white rounded-lg hover:bg-blue-600 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0"
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </form>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center p-8">
            <MessageSquare className="w-16 h-16 text-gray-500 mb-6" />
            <h3 className="text-xl font-semibold text-white mb-2">No Chat Selected</h3>
            <p className="text-gray-400 mb-8">
              Select a chat from the list or start a new conversation
            </p>
            <button
              onClick={() => setShowNewChatModal(true)}
              className="flex items-center gap-2 px-6 py-3 bg-neon-blue text-white rounded-lg hover:bg-blue-600 transition-all duration-200 shadow-lg hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0"
            >
              <Plus className="w-4 h-4" />
              New Conversation
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <Layout>
      <div className="h-full flex flex-col">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-white">Chat</h1>
          <button
            onClick={() => setShowNewChatModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-neon-blue/10 hover:bg-neon-blue/20 text-neon-blue rounded-lg transition-all duration-200 border border-neon-blue/20"
          >
            <Plus className="w-4 h-4" />
            New Chat
          </button>
        </div>
        
        {loading && chatRooms.length === 0 ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-neon-blue"></div>
          </div>
        ) : (
          <div className="flex-1 flex overflow-hidden rounded-xl shadow-2xl shadow-black/20">
            {renderChatList()}
            {renderChatWindow()}
          </div>
        )}
      </div>
      
      {showNewChatModal && (
        <CreateChatModal 
          businesses={businesses}
          onClose={() => setShowNewChatModal(false)}
          onChatCreated={(chat) => {
            setChatRooms(prev => [chat, ...prev]);
            setSelectedChat(chat);
            setShowNewChatModal(false);
            fetchChatRooms(); // Refresh chat list
          }}
        />
      )}
    </Layout>
  );
}