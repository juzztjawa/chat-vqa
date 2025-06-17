import React, { useState, useRef, useEffect } from 'react'
import axios from 'axios'

export default function ChatVQA() {
  const [messages, setMessages] = useState(() => {
    const saved = localStorage.getItem('vqa_messages')
    return saved ? JSON.parse(saved) : []
  })
  const [question, setQuestion] = useState('')
  const [image, setImage] = useState(null)
  const [loading, setLoading] = useState(false)
  const [darkMode, setDarkMode] = useState(true)
  const [typing, setTyping] = useState(false)
  const fileRef = useRef(null)

  useEffect(() => {
    axios.get('http://localhost:8000/messages')
      .then(res => setMessages(res.data))
  }, [])

  useEffect(() => {
    if (darkMode) {
      document.body.classList.add('dark')
    } else {
      document.body.classList.remove('dark')
    }
  }, [darkMode])
  const send = async (e) => {
    e.preventDefault()
    if (!question.trim()) return

    setQuestion('')
    setLoading(true)
    setTyping(true)

    const fd = new FormData()
    fd.append('question', question)
    if (image) {
      fd.append('image', image)
    }

    try {
      const res = await axios.post('http://localhost:8000/vqa', fd)

      const userMsg = {
        type: 'user',
        question,
        ...(res.data.image_url && { image: res.data.image_url })
      }

      const botMsg = {
        type: 'bot',
        answer: res.data.answer
      }

      setMessages(prev => [...prev, userMsg, botMsg])
    } catch (err) {
      setMessages(prev => [...prev, { type: 'bot', answer: 'Error' }])
    } finally {
      setLoading(false)
      setTyping(false)
      fileRef.current.value = null
      setImage(null)
    }
  }


  const resolveImageURL = (url) => url?.startsWith('http') ? url : `http://localhost:8000${url}`
  return (
    <div className={`${darkMode ? 'bg-gray-900 text-white' : 'bg-gray-100 text-black'} flex flex-col items-center min-h-screen w-full`}>
      <div className="w-full max-w-2xl p-4 flex flex-col flex-1">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-xl font-semibold">🧠 Visual QA Chat</h1>
          <button onClick={() => setDarkMode(d => !d)}
            className="px-3 py-1 rounded border text-sm">
            {darkMode ? 'Light Mode' : 'Dark Mode'}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-4 pb-4">
          {messages.map((msg, i) => msg.type === 'user'
            ? <div key={i} className="flex justify-end">
                <div className="bg-green-600 text-white p-3 rounded-xl max-w-xs relative shadow">
                  <p className="font-medium text-sm">{msg.question}</p>
                  {msg.image && <img src={resolveImageURL(msg.image)} className="w-28 mt-2 rounded shadow-sm" />}
                  <div className="absolute -right-2 top-3 border-l-8 border-l-green-600 border-t-8 border-t-transparent border-b-8 border-b-transparent" />
                </div>
              </div>
            : <div key={i} className="flex justify-start">
                <div className="bg-blue-600 text-white p-3 rounded-xl max-w-xs relative shadow">
                  <p className="font-medium text-sm whitespace-pre-line">{msg.answer}</p>
                  <div className="absolute -left-2 top-3 border-r-8 border-r-blue-600 border-t-8 border-t-transparent border-b-8 border-b-transparent" />
                </div>
              </div>
          )}
          {typing && (
            <div className="flex justify-start">
              <div className="bg-blue-500 text-white p-3 rounded-xl max-w-xs shadow inline-flex items-center">
                <span className="text-sm">Typing</span>
                <div className="flex ml-2 space-x-1">
                  <span className="w-2 h-2 bg-white rounded-full animate-bounce" />
                  <span className="w-2 h-2 bg-white rounded-full animate-bounce delay-150" />
                  <span className="w-2 h-2 bg-white rounded-full animate-bounce delay-300" />
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end mb-2">
          <button
            onClick={async () => {
              await axios.delete('http://localhost:8000/messages')
              setMessages([])
            }}
            className="text-sm border px-3 py-1 rounded bg-red-600 text-white hover:bg-red-700"
          >
            Clear Chat
          </button>
        </div>

        <form onSubmit={send} className="flex flex-wrap sm:flex-nowrap items-center justify-center gap-2 pt-3 border-t">
          <label className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-4 py-2 rounded cursor-pointer">
            Upload Image
            <input type="file" accept="image/*" ref={fileRef}
              onChange={e => setImage(e.target.files[0])}
              className="hidden" />
          </label>
          {image && (
            <div className="flex items-center gap-2 text-sm">
              <img src={URL.createObjectURL(image)} alt="preview" className="h-10 w-auto rounded" />
              <span className="truncate max-w-[150px]">{image.name}</span>
            </div>
          )}
          <input
            type="text" placeholder="Ask about the image..."
            value={question} onChange={e => setQuestion(e.target.value)}
            className="flex-1 border px-3 py-2 rounded text-sm"
          />
          <button type="submit" disabled={loading}
            className={`px-5 py-2 rounded text-white text-sm font-semibold ${
              loading ? 'bg-gray-400' : 'bg-blue-600 hover:bg-blue-700'
            }`}>
            {loading ? 'Waiting...' : 'Ask'}
          </button>
        </form>
      </div>
    </div>
  )
}
