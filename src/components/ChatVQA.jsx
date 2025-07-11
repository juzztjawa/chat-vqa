import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';

const API_BASE_URL = 'http://localhost:8000';

export default function ChatVQA() {
  const [messages, setMessages] = useState([]);
  const [question, setQuestion] = useState('');
  const [image, setImage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [darkMode, setDarkMode] = useState(true);
  const [mode, setMode] = useState('auto');
  const [enableSearch, setEnableSearch] = useState(false);
  const [extractionInstruction, setExtractionInstruction] = useState('');
  const fileRef = useRef(null);
  const chatEndRef = useRef(null);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    const fetchMessages = async () => {
      try {
        const res = await axios.get(`${API_BASE_URL}/messages`);
        setMessages(res.data || []);
      } catch (err) {
        console.error("Error loading messages:", err);
      }
    };
    fetchMessages();
  }, []);

  useEffect(() => {
    document.body.classList.toggle('dark', darkMode);
  }, [darkMode]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const processImage = async () => {
    if (!image) return;

    setLoading(true);
    const formData = new FormData();
    formData.append('image', image);
    formData.append('mode', mode);
    formData.append('instruction', extractionInstruction);

    try {
      const res = await axios.post(`${API_BASE_URL}/process-image`, formData);

      setMessages(prev => [
        ...prev,
        { role: 'user', content: `Analyzed: ${image.name}`, image: res.data.image_url },
        { role: 'assistant', content: res.data.message }
      ]);

      setImage(null);
      if (fileRef.current) fileRef.current.value = null;

    } catch (err) {
      console.error("Error processing image:", err);
      setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${err.response?.data?.detail || err.message}` }]);
    } finally {
      setLoading(false);
    }
  };

  const sendQuestion = async (e) => {
    e.preventDefault(); // This is critical for SPA behavior
    if (!question.trim() || loading) return;

    const currentQuestion = question;
    setMessages(prev => [...prev, { role: 'user', content: currentQuestion }]);
    setQuestion('');
    setLoading(true);

    try {
      const res = await axios.post(`${API_BASE_URL}/chat`, {
        question: currentQuestion,
        enable_search: enableSearch
      });

      setMessages(prev => [...prev, { role: 'assistant', content: res.data.answer }]);

    } catch (err) {
      console.error("Error sending question:", err);
      setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${err.response?.data?.detail || err.message}` }]);
    } finally {
      setLoading(false);
    }
  };

  const clearChat = async () => {
    try {
      await axios.delete(`${API_BASE_URL}/clear`);
      setMessages([]);
      setImage(null);
      if (fileRef.current) fileRef.current.value = null;
    } catch (err) {
      console.error("Error clearing chat:", err);
    }
  };
  
  const resolveImageURL = (url) => {
    if (!url) return '';
    return url.startsWith('http') ? url : `${API_BASE_URL}${url}`;
  }

  return (
    <div className={`${darkMode ? 'bg-gray-900 text-white' : 'bg-gray-100 text-black'} flex flex-col items-center min-h-screen w-full`}>
      <div className="w-full max-w-3xl p-4 flex flex-col h-screen">
        <header className="flex-shrink-0 flex justify-between items-center mb-4">
          <h1 className="text-xl font-semibold">🖼️ VisionAI Chat</h1>
          <div>
            <button 
              type="button" // Set explicit type
              onClick={clearChat} 
              className="mr-2 px-3 py-1 rounded bg-red-600 text-white text-sm hover:bg-red-700"
            >
              Clear Chat
            </button>
            <button 
              type="button" // Set explicit type
              onClick={() => setDarkMode(d => !d)} 
              className="px-3 py-1 rounded border text-sm"
            >
              {darkMode ? 'Light' : 'Dark'} Mode
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto space-y-4 pb-4 pr-2">
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`p-3 rounded-xl max-w-md shadow ${msg.role === 'user' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-white'}`}>
                {msg.image && (
                  <img 
                    src={resolveImageURL(msg.image)} 
                    alt="Processed content" 
                    className="w-full max-w-xs mb-2 rounded-lg shadow-sm" 
                  />
                )}
                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
              </div>
            </div>
          ))}
          {loading && (
             <div className="flex justify-start">
               <div className="bg-gray-700 text-white p-3 rounded-xl max-w-xs shadow inline-flex items-center">
                 <span className="text-sm">Thinking...</span>
               </div>
             </div>
          )}
          <div ref={chatEndRef} />
        </main>
        
        
        <footer className="flex-shrink-0 pt-4 border-t border-gray-700">
          
          {/* Section 1: Image Processing - This is NOT a form */}
          <div className="mb-4">
            <div className="flex gap-2 items-center">
              <label className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-4 py-2 rounded cursor-pointer">
                Choose Image
                <input type="file" accept="image/*" ref={fileRef} onChange={e => setImage(e.target.files[0])} className="hidden" />
              </label>
              {image && (
                <div className="flex items-center gap-2 text-sm">
                  <img src={URL.createObjectURL(image)} alt="preview" className="h-10 w-auto rounded" />
                  <span className="truncate max-w-[150px]">{image.name}</span>
                </div>
              )}
              <button 
                type="button" 
                onClick={processImage} 
                disabled={!image || loading} 
                className="px-4 py-2 rounded text-white text-sm bg-green-600 hover:bg-green-700 disabled:bg-gray-500"
              >
                Process Image
              </button>
            </div>
          </div>

          {/* Section 2: Chat Input - This IS a form */}
          <form onSubmit={sendQuestion} className="flex gap-2">
            <input 
              type="text" 
              placeholder="Ask a follow-up question..." 
              value={question} 
              onChange={e => setQuestion(e.target.value)} 
              className="flex-1 border px-3 py-2 rounded text-sm bg-gray-700 border-gray-600" 
            />
            <button 
              type="submit" // This is correct, as it's meant to submit this form
              disabled={loading || !question.trim()} 
              className="px-5 py-2 rounded text-white text-sm font-semibold bg-blue-600 hover:bg-blue-700 disabled:bg-gray-500"
            >
              Ask
            </button>
          </form>

        </footer>
      </div>
    </div>
  );
}