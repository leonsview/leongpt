'use client';

import { useState, useEffect, useRef } from 'react';
import { Menu, X, Send, PlusCircle, Trash2 } from 'lucide-react';
import TextareaAutosize from 'react-textarea-autosize';
import { streamMessage, ChatMessage } from '../actions/stream-message';
import { readStreamableValue } from 'ai/rsc';

interface Chat {
  id: string;
  name: string;
  messages: ChatMessage[];
}

export default function Home() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [message, setMessage] = useState('');
  const [chats, setChats] = useState<Chat[]>([]);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [editingChatId, setEditingChatId] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const savedChats = JSON.parse(localStorage.getItem('chats') || '[]');
    if (savedChats.length === 0) {
      const initialChat = createNewChat();
      setChats([initialChat]);
      setCurrentChatId(initialChat.id);
    } else {
      setChats(savedChats);
      setCurrentChatId(savedChats[0].id);
    }
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chats, currentChatId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || !currentChatId) return;

    const userMessage: ChatMessage = { id: Date.now(), role: 'user', content: message };
    const updatedChats = chats.map(chat => 
      chat.id === currentChatId 
        ? { ...chat, messages: [...chat.messages, userMessage] }
        : chat
    );
    setChats(updatedChats);
    localStorage.setItem('chats', JSON.stringify(updatedChats));
    setMessage('');

    try {
      const currentChat = updatedChats.find(chat => chat.id === currentChatId);
      if (!currentChat) return;

      const { output } = await streamMessage(currentChat.messages);
      
      const aiMessageId = Date.now();
      const aiMessage: ChatMessage = { id: aiMessageId, role: 'assistant', content: '' };
      
      setChats(prev => prev.map(chat => 
        chat.id === currentChatId 
          ? { ...chat, messages: [...chat.messages, aiMessage] }
          : chat
      ));

      let fullContent = '';
      for await (const chunk of readStreamableValue(output)) {
        fullContent += chunk;
        setChats(prev => prev.map(chat => 
          chat.id === currentChatId 
            ? {
                ...chat,
                messages: chat.messages.map(msg => 
                  msg.id === aiMessageId ? { ...msg, content: fullContent } : msg
                )
              }
            : chat
        ));
      }
      localStorage.setItem('chats', JSON.stringify(chats));
    } catch (error) {
      console.error('Error in streaming message:', error);
    }
  };

  const createNewChat = () => {
    return {
      id: Date.now().toString(),
      name: "New Chat",
      messages: []
    };
  };

  const handleNewChat = () => {
    const newChat = createNewChat();
    const updatedChats = [...chats, newChat];
    setChats(updatedChats);
    setCurrentChatId(newChat.id);
    localStorage.setItem('chats', JSON.stringify(updatedChats));
  };

  const handleDeleteChat = (chatId: string) => {
    const updatedChats = chats.filter(chat => chat.id !== chatId);
    
    if (updatedChats.length === 0) {
      const newChat = createNewChat();
      updatedChats.push(newChat);
    }
    
    setChats(updatedChats);
    localStorage.setItem('chats', JSON.stringify(updatedChats));
    setCurrentChatId(updatedChats[0].id);
  };

  const handleRenameChat = (chatId: string, newName: string) => {
    const updatedChats = chats.map(chat => 
      chat.id === chatId ? { ...chat, name: newName } : chat
    );
    setChats(updatedChats);
    localStorage.setItem('chats', JSON.stringify(updatedChats));
    setEditingChatId(null);
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e as unknown as React.FormEvent);
    }
  };

  return (
    <div className="flex bg-black min-h-screen text-white relative">
      <div className={`w-[300px] border-r border-gray-700 transition-all duration-300 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <h2 className="p-4 pt-16 text-xl font-semibold">Chats</h2>
        <button
          onClick={handleNewChat}
          className="absolute top-4 right-4 p-2 rounded text-white transition-all duration-300 ease-in-out hover:scale-110 hover:animate-glow"
        >
          <PlusCircle size={24} />
        </button>
        <ul className="mt-4">
          {chats.map(chat => (
            <li
              key={chat.id}
              className={`p-2 pl-4 cursor-pointer flex justify-between items-center bg-black hover:bg-gray-900 ${currentChatId === chat.id ? 'bg-gray-900' : ''}`}
              onClick={() => setCurrentChatId(chat.id)}
            >
              {editingChatId === chat.id ? (
                <input
                  type="text"
                  defaultValue={chat.name}
                  onBlur={(e) => handleRenameChat(chat.id, e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      handleRenameChat(chat.id, e.currentTarget.value);
                    }
                  }}
                  autoFocus
                  className="bg-gray-900 text-white p-1 rounded w-full"
                  onClick={(e) => e.stopPropagation()} // Prevent click from bubbling up when editing
                />
              ) : (
                <span 
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    setEditingChatId(chat.id);
                  }}
                >
                  {chat.name}
                </span>
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteChat(chat.id);
                }}
                className="p-1 rounded group"
              >
                <Trash2 size={16} className="group-hover:text-red-500 transition-colors duration-200" />
              </button>
            </li>
          ))}
        </ul>
      </div>
      <div className="flex-1 flex justify-center">
        <div className="w-full max-w-[800px] p-4 pt-16 flex flex-col h-screen">
          <h1 className="text-4xl font-bold mb-4 text-white">Chat with LeonGPT</h1>
          <div className="flex-1 overflow-y-auto mb-4 bg-black rounded-lg p-4 border border-white">
            <div className="space-y-2">
              {chats.find(chat => chat.id === currentChatId)?.messages.map((msg) => (
                <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[70%] p-3 rounded-2xl ${
                    msg.role === 'user' 
                      ? 'bg-blue-500 text-white rounded-br-none' 
                      : 'bg-green-500 text-white rounded-bl-none'
                  }`}>
                    <p>{msg.content}</p>
                  </div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>
          </div>
          <form onSubmit={handleSubmit} className="relative">
            <TextareaAutosize
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder="Type your message..."
              minRows={2}
              className="w-full bg-black text-white rounded-lg p-3 pr-12 resize-none border border-white"
            />
            <button
              type="submit"
              className="absolute right-3 bottom-3 text-white"
              disabled={!message.trim() || !currentChatId}
            >
              <Send size={20} />
            </button>
          </form>
        </div>
      </div>
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="absolute top-4 left-4 p-2 rounded z-10 text-white transition-all duration-300 ease-in-out hover:scale-110 hover:animate-glow"
      >
        {sidebarOpen ? <X size={24} /> : <Menu size={24} />}
      </button>
    </div>
  );
}
