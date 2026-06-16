// ===== ANANTA10X — chat logic =====

const chatScroll = document.getElementById('chatScroll');
const heroState = document.getElementById('heroState');
const chatInner = document.getElementById('chatInner');
const userInput = document.getElementById('userInput');
const sendBtn = document.getElementById('sendBtn');
const langSelect = document.getElementById('langSelect');

let conversation = []; // {role: 'user'|'assistant', content: '...'}
let isStreaming = false;

function autoGrow(el){
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 160) + 'px';
}

function handleKey(e){
  if(e.key === 'Enter' && !e.shiftKey){
    e.preventDefault();
    sendMessage();
  }
}

function fillPrompt(el){
  userInput.value = el.textContent;
  userInput.focus();
  autoGrow(userInput);
}

function startNewChat(){
  conversation = [];
  chatInner.innerHTML = '';
  chatInner.style.display = 'none';
  heroState.style.display = 'flex';
  userInput.value = '';
  autoGrow(userInput);
}

function escapeHtml(str){
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// Minimal markdown-ish renderer: code blocks, inline code, bold, lists
function renderMarkdown(text){
  let html = escapeHtml(text);

  // code blocks ```lang\ncode```
  html = html.replace(/```([a-zA-Z0-9]*)\n([\s\S]*?)```/g, (m, lang, code) => {
    return `<pre><code>${code}</code></pre>`;
  });

  // inline code
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

  // bold
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

  // simple numbered/bulleted lines into lists
  const lines = html.split('\n');
  let out = [];
  let inList = false;
  let listType = null;

  for(let line of lines){
    const bulletMatch = line.match(/^\s*[-*]\s+(.*)/);
    const numMatch = line.match(/^\s*\d+\.\s+(.*)/);

    if(bulletMatch){
      if(!inList || listType !== 'ul'){ if(inList) out.push(`</${listType}>`); out.push('<ul>'); inList = true; listType = 'ul'; }
      out.push(`<li>${bulletMatch[1]}</li>`);
    } else if(numMatch){
      if(!inList || listType !== 'ol'){ if(inList) out.push(`</${listType}>`); out.push('<ol>'); inList = true; listType = 'ol'; }
      out.push(`<li>${numMatch[1]}</li>`);
    } else {
      if(inList){ out.push(`</${listType}>`); inList = false; listType = null; }
      if(line.trim() !== ''){ out.push(`<p>${line}</p>`); }
    }
  }
  if(inList) out.push(`</${listType}>`);

  return out.join('\n');
}

function addMessage(role, content){
  if(heroState.style.display !== 'none'){
    heroState.style.display = 'none';
    chatInner.style.display = 'flex';
  }

  const msgEl = document.createElement('div');
  msgEl.className = `msg ${role === 'user' ? 'user' : 'bot'}`;

  const avatarSvg = role === 'user'
    ? `<span>YOU</span>`
    : `<svg viewBox="0 0 24 24" fill="none" stroke="#c9a04f" stroke-width="1.4"><path d="M12 2L4 7v10l8 5 8-5V7l-8-5z"/><path d="M12 2v20M4 7l8 5 8-5"/></svg>`;

  msgEl.innerHTML = `
    <div class="msg-avatar">${avatarSvg}</div>
    <div class="msg-body">
      <div class="msg-name">${role === 'user' ? 'You' : 'ANANTA10X'}</div>
      <div class="msg-text">${role === 'user' ? `<p>${escapeHtml(content)}</p>` : renderMarkdown(content)}</div>
    </div>
  `;
  chatInner.appendChild(msgEl);
  chatScroll.scrollTop = chatScroll.scrollHeight;
  return msgEl;
}

function addTypingIndicator(){
  const msgEl = document.createElement('div');
  msgEl.className = 'msg bot';
  msgEl.id = 'typingIndicator';
  msgEl.innerHTML = `
    <div class="msg-avatar"><svg viewBox="0 0 24 24" fill="none" stroke="#c9a04f" stroke-width="1.4"><path d="M12 2L4 7v10l8 5 8-5V7l-8-5z"/><path d="M12 2v20M4 7l8 5 8-5"/></svg></div>
    <div class="msg-body">
      <div class="msg-name">ANANTA10X</div>
      <div class="typing"><span></span><span></span><span></span></div>
    </div>
  `;
  chatInner.appendChild(msgEl);
  chatScroll.scrollTop = chatScroll.scrollHeight;
}

function removeTypingIndicator(){
  const el = document.getElementById('typingIndicator');
  if(el) el.remove();
}

async function sendMessage(){
  const text = userInput.value.trim();
  if(!text || isStreaming) return;

  addMessage('user', text);
  conversation.push({ role: 'user', content: text });

  userInput.value = '';
  autoGrow(userInput);
  isStreaming = true;
  sendBtn.disabled = true;

  addTypingIndicator();

  try{
    const langPref = langSelect.value;
    const langInstruction = langPref === 'auto'
      ? 'Respond in the same language the user writes in.'
      : `Respond in ${langSelect.options[langSelect.selectedIndex].text}, unless the user explicitly asks for another language.`;

    const reply = await callANANTA10X(conversation, langInstruction);

    removeTypingIndicator();
    addMessage('assistant', reply);
    conversation.push({ role: 'assistant', content: reply });

  } catch(err){
    removeTypingIndicator();
    addMessage('assistant', `**Connection issue.** ANANTA10X could not reach the model right now.\n\n${err.message || 'Please check your setup and try again.'}`);
  } finally {
    isStreaming = false;
    sendBtn.disabled = false;
    userInput.focus();
  }
}

// Calls our backend proxy (api/chat.js) — never calls Groq directly from the browser.
async function callANANTA10X(messages, langInstruction){
  const systemPrompt = `You are ANANTA10X, an advanced multilingual AI assistant. You help with coding (writing, explaining, debugging in any language), answering questions on any topic, and giving clear step-by-step guidance on building webpages, websites, apps, and full-stack applications. ${langInstruction} Be clear, structured, and use code blocks for code. Keep a confident, capable tone.`;

  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages: [{ role: 'system', content: systemPrompt }, ...messages]
    })
  });

  if(!response.ok){
    const errText = await response.text();
    throw new Error(`Server error (${response.status}): ${errText}`);
  }

  const data = await response.json();
  return data.reply;
}
