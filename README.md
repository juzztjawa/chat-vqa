Chat based VQA

Currrent features:
You can chat with VQA.
Chats are stored in local. So each new session, the progress will be restored, including images.
Clear history clears the entire chat.

Upcoming features:
Memory - saves above chats for the current prompt.
PostgreSQL - SQL integration for login/signup.
RAG for research papers - look into more it.

Open two terminals 

1 - go to src directory and run:
    uvicorn main:app --reload

2 - npm install
npm run dev

