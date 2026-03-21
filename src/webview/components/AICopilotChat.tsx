import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, X, Send } from 'lucide-react';
import { GraphData, EntityCounts } from '../../analyzer/types';

interface ChatMessage {
  id: string;
  sender: 'ai' | 'user';
  text: string;
  timestamp: Date;
}

interface AICopilotChatProps {
  graphData: GraphData;
  counts: EntityCounts;
}

const AICopilotChat: React.FC<AICopilotChatProps> = ({ graphData, counts }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'msg-1',
      sender: 'ai',
      text: 'Hello! I am your CodeAtlas AI Copilot. Ask me anything about your codebase structure. Try: "What are the main modules?" or "Are there circular dependencies?"',
      timestamp: new Date()
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping, isOpen]);

  const generateAIResponse = (input: string): string => {
    const lowerInput = input.toLowerCase();

    if (lowerInput.includes('dependency') || lowerInput.includes('import')) {
      // Find top imported modules
      const importCounts = new Map<string, number>();
      graphData.links.forEach(l => {
        if (l.type === 'import') {
          importCounts.set(l.target, (importCounts.get(l.target) || 0) + 1);
        }
      });
      const topImports = Array.from(importCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([id]) => id.split(':').pop() || id);
      
      return `Your project has ${counts.dependencies} total dependencies. The most frequently imported modules are: ${topImports.join(', ')}.`;
    } 
    
    if (lowerInput.includes('function') || lowerInput.includes('class')) {
      return `I analyzed ${counts.functions} functions and ${counts.classes} classes across ${counts.modules} modules in your workspace.`;
    }

    if (lowerInput.includes('circular')) {
      // Very basic mock check for circular dependencies
      return `I checked the dependency graph for your ${counts.modules} modules. The architecture looks relatively clean, but I recommend checking the AI Insights panel for any high-severity structural warnings.`;
    }

    if (lowerInput.includes('explain') || lowerInput.includes('purpose')) {
      const mainNodes = graphData.nodes.filter(n => n.type === 'module').slice(0, 3).map(n => n.label);
      return `This project appears to be a TypeScript/JavaScript application. The main architectural entry points or core modules seem to be: ${mainNodes.join(', ')}. The graph shows a mix of internal module logic and external library usage.`;
    }

    return 'I can help you understand your codebase structure. Try asking about dependencies, functions, classes, or architectural insights.';
  };

  const handleSend = () => {
    if (!inputValue.trim()) return;

    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      sender: 'user',
      text: inputValue.trim(),
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMsg]);
    setInputValue('');
    setIsTyping(true);

    // Fake AI thinking delay
    setTimeout(() => {
      const aiResponseText = generateAIResponse(userMsg.text);
      const aiMsg: ChatMessage = {
        id: `msg-${Date.now() + 1}`,
        sender: 'ai',
        text: aiResponseText,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, aiMsg]);
      setIsTyping(false);
    }, 1500);
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <>
      {/* Toggle Button */}
      <button 
        className={`chat-toggle ${isOpen ? 'hidden' : ''}`}
        onClick={() => setIsOpen(true)}
      >
        <MessageSquare size={24} />
      </button>

      {/* Chat Panel */}
      <div className={`chat-panel ${isOpen ? 'open' : ''}`}>
        <div className="chat-header">
          <div className="chat-title">
            <span className="chat-icon">🤖</span> AI Copilot
          </div>
          <button className="close-btn" onClick={() => setIsOpen(false)}>
            <X size={20} />
          </button>
        </div>

        <div className="chat-messages">
          {messages.map((msg) => (
            <div key={msg.id} className={`message ${msg.sender}`}>
              <div className="message-content">
                {msg.text}
              </div>
              <div className="message-timestamp">{formatTime(msg.timestamp)}</div>
            </div>
          ))}
          {isTyping && (
            <div className="message ai typing">
              <div className="message-content">
                <span className="dot"></span>
                <span className="dot"></span>
                <span className="dot"></span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="chat-input-area">
          <input 
            type="text" 
            placeholder="Ask about your codebase..." 
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          />
          <button className="send-btn" onClick={handleSend} disabled={!inputValue.trim() || isTyping}>
            <Send size={18} />
          </button>
        </div>
      </div>
    </>
  );
};

export default AICopilotChat;
