const DB_KEY = 'vajehyar_words_v1';
const GAME_KEY = 'vajehyar_game_v1';
const HISTORY_KEY = 'vajehyar_search_history_v1';
const INTERVALS = [1, 2, 4, 8, 16];

let words = loadJson(DB_KEY, []);
let game = loadJson(GAME_KEY, defaultGame());
let searchHistory = loadJson(HISTORY_KEY, []);
let currentResult = null;
let reviewQueue = [];
let reviewIndex = 0;
let sessionXp = 0;
let currentLibraryFilter = 'all';
let deferredPrompt = null;

const $ = id => document.getElementById(id);
const nowDateKey = () => new Date().toISOString().slice(0, 10);
const todayStart = () => { const d = new Date(); d.setHours(0,0,0,0); return d.getTime(); };
const addDays = days => { const d = new Date(); d.setHours(0,0,0,0); d.setDate(d.getDate() + days); return d.getTime(); };
const normalizeWord = value => String(value || '').trim().toLowerCase();
const unique = values => [...new Set(values.filter(Boolean).map(v => String(v).trim()).filter(Boolean))];
const escapeHtml = value => String(value || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));

function defaultGame(){
  return {xp:0,streak:0,lastActiveDate:null,dailyDate:nowDateKey(),dailyReviews:0,dailyXp:0,dailyGoal:10,totalReviews:0,correctReviews:0,wrongReviews:0,goalBonusDate:null};
}
function loadJson(key, fallback){ try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } }
function persist(){ localStorage.setItem(DB_KEY, JSON.stringify(words)); localStorage.setItem(GAME_KEY, JSON.stringify(game)); localStorage.setItem(HISTORY_KEY, JSON.stringify(searchHistory)); }
function resetDailyIfNeeded(){
  const today = nowDateKey();
  if(game.dailyDate !== today){ game.dailyDate = today; game.dailyReviews = 0; game.dailyXp = 0; game.goalBonusDate = null; persist(); }
}
function dayDiff(a, b){
  const one = new Date(a + 'T00:00:00'); const two = new Date(b + 'T00:00:00');
  return Math.round((two - one) / 86400000);
}
function markActivity(){
  resetDailyIfNeeded();
  const today = nowDateKey();
  if(game.lastActiveDate === today) return;
  if(game.lastActiveDate && dayDiff(game.lastActiveDate, today) === 1) game.streak += 1;
  else game.streak = 1;
  game.lastActiveDate = today;
}
function awardXp(amount, reason, countReview=false){
  resetDailyIfNeeded(); markActivity();
  game.xp += amount; game.dailyXp += amount; sessionXp += countReview ? amount : 0;
  if(countReview){ game.dailyReviews += 1; game.totalReviews += 1; }
  if(game.dailyReviews >= game.dailyGoal && game.goalBonusDate !== nowDateKey()){
    game.goalBonusDate = nowDateKey(); game.xp += 25; game.dailyXp += 25; sessionXp += 25;
    toast('Daily goal complete! +25 bonus XP'); confetti();
  } else if(reason) toast(`${reason} +${amount} XP`);
  persist(); refreshAll();
}
function toast(message){ const t=$('toast'); t.textContent=message; t.classList.add('show'); clearTimeout(toast.timer); toast.timer=setTimeout(()=>t.classList.remove('show'),2200); }
function confetti(){
  const host=$('confetti'); const colors=['#5b5cf0','#8b5cf6','#f4a623','#22c55e','#38bdf8','#f43f5e'];
  for(let i=0;i<42;i++){
    const piece=document.createElement('i'); piece.style.left=`${Math.random()*100}%`; piece.style.background=colors[i%colors.length]; piece.style.animationDelay=`${Math.random()*.35}s`; piece.style.setProperty('--drift',`${(Math.random()-.5)*260}px`); host.appendChild(piece); setTimeout(()=>piece.remove(),1900);
  }
}
function dueWords(){ const now=todayStart(); return words.filter(w=>!w.learned && Number(w.nextReview || 0) <= now).sort((a,b)=>Number(a.nextReview||0)-Number(b.nextReview||0)); }

function switchView(id){
  document.querySelectorAll('.view').forEach(v=>v.classList.toggle('active',v.id===id));
  document.querySelectorAll('.bottom-nav button').forEach(b=>b.classList.toggle('active',b.dataset.view===id));
  if(id==='reviewView') prepareReview();
  if(id==='wordsView') renderWords();
  window.scrollTo({top:0,behavior:'smooth'});
}
document.querySelectorAll('.bottom-nav button').forEach(b=>b.addEventListener('click',()=>switchView(b.dataset.view)));
$('startReviewBtn').addEventListener('click',()=>switchView('reviewView'));
$('emptySearchBtn').addEventListener('click',()=>switchView('searchView'));

function refreshStats(){
  resetDailyIfNeeded();
  const level=Math.floor(game.xp/100)+1; const within=game.xp%100;
  $('levelLabel').textContent=`Level ${level}`; $('levelOrb').textContent=level; $('xpLabel').textContent=`${game.xp} XP`; $('xpNextLabel').textContent=`${100-within} XP to next level`; $('xpProgress').style.width=`${within}%`;
  $('streakCount').textContent=game.streak;
  $('dueCount').textContent=dueWords().length; $('totalCount').textContent=words.length; $('learnedCount').textContent=words.filter(w=>w.learned).length; $('todayXpCount').textContent=game.dailyXp;
  const goal=Math.max(1,game.dailyGoal); const progress=Math.min(1,game.dailyReviews/goal);
  $('goalProgressText').textContent=`${game.dailyReviews}/${goal}`; $('goalRing').style.setProperty('--pct',`${progress*360}deg`); $('goalStatus').textContent=progress>=1?'Goal complete!':'Keep the streak alive';
  const box=$('boxStats'); box.innerHTML=''; const colors=['#5b5cf0','#7c6cf3','#8b5cf6','#b453d6','#e24a61'];
  for(let i=1;i<=5;i++){
    const count=words.filter(w=>!w.learned&&Number(w.box||1)===i).length; const item=document.createElement('div'); item.className='box-item'; item.style.setProperty('--box-color',colors[i-1]); item.innerHTML=`<strong>${count}</strong><span>Box ${i}</span>`; box.appendChild(item);
  }
  renderBadges();
  document.querySelectorAll('#goalOptions button').forEach(b=>b.classList.toggle('active',Number(b.dataset.goal)===Number(game.dailyGoal)));
}

const BADGES=[
  {id:'first-word',icon:'🌱',name:'First Word',desc:'Save 1 word',ok:()=>words.length>=1},
  {id:'collector',icon:'📚',name:'Collector',desc:'Save 25 words',ok:()=>words.length>=25},
  {id:'century',icon:'💯',name:'Century',desc:'Save 100 words',ok:()=>words.length>=100},
  {id:'first-review',icon:'⚡',name:'First Recall',desc:'Complete 1 review',ok:()=>game.totalReviews>=1},
  {id:'reviewer',icon:'🧠',name:'Memory Builder',desc:'Get 25 correct',ok:()=>game.correctReviews>=25},
  {id:'master',icon:'🏆',name:'Word Master',desc:'Master 10 words',ok:()=>words.filter(w=>w.learned).length>=10},
  {id:'streak3',icon:'🔥',name:'On Fire',desc:'3-day streak',ok:()=>game.streak>=3},
  {id:'streak7',icon:'👑',name:'Unstoppable',desc:'7-day streak',ok:()=>game.streak>=7}
];
function renderBadges(){
  const host=$('badgesGrid'); host.innerHTML=''; let unlocked=0;
  BADGES.forEach(b=>{ const ok=b.ok(); if(ok)unlocked++; const el=document.createElement('div'); el.className=`badge-card ${ok?'unlocked':''}`; el.innerHTML=`<div class="badge-icon">${b.icon}</div><strong>${b.name}</strong><span>${ok?'Unlocked':b.desc}</span>`; host.appendChild(el); });
  $('badgeSummary').textContent=`${unlocked}/${BADGES.length} unlocked`;
}

async function fetchDictionary(word){
  const response=await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`);
  if(!response.ok) throw new Error('not-found');
  const entries=await response.json();
  const allMeanings=[]; const phonetics=[]; const sources=[];
  entries.forEach(entry=>{
    (entry.phonetics||[]).forEach(p=>phonetics.push({text:p.text||'',audio:p.audio||'',sourceUrl:p.sourceUrl||''}));
    (entry.sourceUrls||[]).forEach(s=>sources.push(s));
    (entry.meanings||[]).forEach(m=>allMeanings.push({partOfSpeech:m.partOfSpeech||'other',synonyms:m.synonyms||[],antonyms:m.antonyms||[],definitions:(m.definitions||[]).map(d=>({definition:d.definition||'',example:d.example||'',synonyms:d.synonyms||[],antonyms:d.antonyms||[]}))}));
  });
  const audio=phonetics.find(p=>p.audio)?.audio||'';
  const phonetic=entries.find(e=>e.phonetic)?.phonetic||phonetics.find(p=>p.text)?.text||'';
  return {word:entries[0]?.word||word,phonetic,audio,meanings:allMeanings,sourceUrl:sources[0]||'',license:entries[0]?.license||null};
}
async function fetchPersian(word){
  try{
    const response=await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(word)}&langpair=en|fa`);
    if(!response.ok)return '';
    const data=await response.json(); const translated=String(data?.responseData?.translatedText||'').trim();
    return translated.toLowerCase()===word.toLowerCase()?'':translated;
  }catch{return ''}
}
function firstDefinition(result){
  for(const m of result.meanings||[]) for(const d of m.definitions||[]) if(d.definition) return {definition:d.definition,example:d.example||'',partOfSpeech:m.partOfSpeech||''};
  return {definition:'',example:'',partOfSpeech:''};
}
function aggregateRelations(result, key){
  const items=[]; (result.meanings||[]).forEach(m=>{ items.push(...(m[key]||[])); (m.definitions||[]).forEach(d=>items.push(...(d[key]||[]))); }); return unique(items).slice(0,24);
}
function addSearchHistory(word){ searchHistory=[word,...searchHistory.filter(w=>w!==word)].slice(0,12); persist(); renderSearchHistory(); }
function renderSearchHistory(){
  const host=$('recentSearches'); host.innerHTML='';
  if(!searchHistory.length){host.innerHTML='<span class="muted mini">No recent searches yet.</span>';return}
  searchHistory.forEach(word=>{const b=document.createElement('button');b.className='chip';b.textContent=word;b.addEventListener('click',()=>{$('wordInput').value=word;$('searchForm').requestSubmit()});host.appendChild(b)});
}
$('clearHistoryBtn').addEventListener('click',()=>{searchHistory=[];persist();renderSearchHistory()});

$('searchForm').addEventListener('submit',async event=>{
  event.preventDefault(); const word=normalizeWord($('wordInput').value); if(!word)return;
  $('searchStatus').textContent='Searching the dictionary...'; $('resultCard').classList.add('hidden');
  const saved=words.find(w=>normalizeWord(w.word)===word);
  try{
    const result=await fetchDictionary(word); $('searchStatus').textContent='Finding a Persian translation...';
    const persian=saved?.faMeaning || await fetchPersian(result.word);
    currentResult={...result,faMeaning:persian,note:saved?.note||'',savedId:saved?.id||null};
    renderDictionaryResult(currentResult); addSearchHistory(result.word); $('searchStatus').textContent='';
  }catch{
    if(saved){
      currentResult=storedWordToResult(saved); renderDictionaryResult(currentResult); addSearchHistory(saved.word); $('searchStatus').textContent='Showing the saved offline entry.';
    } else $('searchStatus').textContent='The word was not found, or the internet connection is unavailable.';
  }
});
function storedWordToResult(w){
  return {word:w.word,phonetic:w.phonetic||'',audio:w.audio||'',meanings:w.meanings||[{partOfSpeech:w.partOfSpeech||'saved',synonyms:w.synonyms||[],antonyms:w.antonyms||[],definitions:[{definition:w.enDefinition||'',example:w.example||'',synonyms:[],antonyms:[]}]}],sourceUrl:w.sourceUrl||'',faMeaning:w.faMeaning||'',note:w.note||'',savedId:w.id};
}
function renderDictionaryResult(result){
  $('resultWord').textContent=result.word; $('phonetic').textContent=result.phonetic||'Pronunciation not available'; $('faMeaning').value=result.faMeaning||''; $('personalNote').value=result.note||'';
  $('savedBadge').classList.toggle('hidden',!result.savedId); $('saveWordBtn').textContent=result.savedId?'Update saved word':'Add to Leitner Box 1 · +5 XP';
  const parts=unique((result.meanings||[]).map(m=>m.partOfSpeech)); $('partOfSpeechChips').innerHTML=parts.map(p=>`<span class="chip pos">${escapeHtml(p)}</span>`).join('');
  const meanings=$('meaningsList'); meanings.innerHTML=''; let definitionCount=0;
  (result.meanings||[]).forEach(group=>{
    const defs=(group.definitions||[]).filter(d=>d.definition).slice(0,5); if(!defs.length)return; definitionCount+=defs.length;
    const el=document.createElement('article'); el.className='meaning-group'; el.innerHTML=`<div class="meaning-group-head">${escapeHtml(group.partOfSpeech||'Meaning')}</div>${defs.map((d,i)=>`<div class="definition-item"><p class="definition-text"><strong>${i+1}.</strong> ${escapeHtml(d.definition)}</p>${d.example?`<p class="definition-example">“${escapeHtml(d.example)}”</p>`:''}</div>`).join('')}`; meanings.appendChild(el);
  });
  $('definitionCount').textContent=`${definitionCount} definition${definitionCount===1?'':'s'}`;
  const synonyms=aggregateRelations(result,'synonyms'), antonyms=aggregateRelations(result,'antonyms');
  renderRelation('synonyms',synonyms); renderRelation('antonyms',antonyms); $('wordRelations').classList.toggle('hidden',!synonyms.length&&!antonyms.length);
  if(result.sourceUrl){$('sourceBlock').classList.remove('hidden');$('sourceLink').href=result.sourceUrl}else $('sourceBlock').classList.add('hidden');
  $('resultCard').classList.remove('hidden');
}
function renderRelation(type,items){
  const block=$(`${type}Block`),list=$(`${type}List`); block.classList.toggle('hidden',!items.length); list.innerHTML='';
  items.forEach(word=>{const b=document.createElement('button');b.className='chip';b.textContent=word;b.addEventListener('click',()=>{$('wordInput').value=word;$('searchForm').requestSubmit()});list.appendChild(b)});
}
function speak(text,audioUrl=''){
  if(audioUrl){ const audio=new Audio(audioUrl); audio.play().catch(()=>speakWithTts(text)); } else speakWithTts(text);
}
function speakWithTts(text){ speechSynthesis.cancel(); const u=new SpeechSynthesisUtterance(text);u.lang='en-US';speechSynthesis.speak(u); }
$('speakBtn').addEventListener('click',()=>currentResult&&speak(currentResult.word,currentResult.audio));

$('saveWordBtn').addEventListener('click',()=>{
  if(!currentResult)return;
  const primary=firstDefinition(currentResult); const existing=words.find(w=>w.id===currentResult.savedId)||words.find(w=>normalizeWord(w.word)===normalizeWord(currentResult.word));
  const record={id:existing?.id||crypto.randomUUID(),word:currentResult.word,phonetic:currentResult.phonetic||'',audio:currentResult.audio||'',faMeaning:$('faMeaning').value.trim(),note:$('personalNote').value.trim(),enDefinition:primary.definition,example:primary.example,partOfSpeech:primary.partOfSpeech,meanings:currentResult.meanings||[],synonyms:aggregateRelations(currentResult,'synonyms'),antonyms:aggregateRelations(currentResult,'antonyms'),sourceUrl:currentResult.sourceUrl||'',box:existing?.box||1,nextReview:existing?.nextReview??todayStart(),createdAt:existing?.createdAt||Date.now(),updatedAt:Date.now(),learned:existing?.learned||false};
  if(existing) words=words.map(w=>w.id===existing.id?record:w); else words.unshift(record);
  persist(); if(!existing) awardXp(5,'New word saved'); else {refreshAll();toast('Saved word updated.')} switchView('homeView');
});

function prepareReview(){ reviewQueue=dueWords(); reviewIndex=0; sessionXp=0; $('sessionXp').textContent='0'; showReviewCard(); }
function showReviewCard(){
  const empty=$('reviewEmpty'),content=$('reviewContent');
  if(reviewIndex>=reviewQueue.length){empty.classList.remove('hidden');content.classList.add('hidden');if(reviewQueue.length)confetti();refreshAll();return}
  empty.classList.add('hidden');content.classList.remove('hidden'); const w=reviewQueue[reviewIndex];
  $('reviewWord').textContent=w.word; $('reviewBox').textContent=`Leitner Box ${w.box||1}`; $('reviewCounter').textContent=`${reviewIndex+1} of ${reviewQueue.length}`; $('reviewHint').textContent=w.partOfSpeech?`Part of speech: ${w.partOfSpeech}`:'';
  $('reviewFa').textContent=w.faMeaning||'No Persian meaning saved'; $('reviewEn').textContent=w.enDefinition||firstDefinition(storedWordToResult(w)).definition||''; $('reviewExample').textContent=w.example||''; $('reviewExample').classList.toggle('hidden',!w.example);
  $('answerPanel').classList.add('hidden'); $('revealBtn').classList.remove('hidden'); $('reviewProgress').style.width=`${reviewIndex/Math.max(1,reviewQueue.length)*100}%`;
}
$('revealBtn').addEventListener('click',()=>{$('answerPanel').classList.remove('hidden');$('revealBtn').classList.add('hidden')});
$('reviewSpeakBtn').addEventListener('click',()=>{const w=reviewQueue[reviewIndex];if(w)speak(w.word,w.audio)});
$('wrongBtn').addEventListener('click',()=>answerReview(false)); $('correctBtn').addEventListener('click',()=>answerReview(true));
function answerReview(correct){
  const current=reviewQueue[reviewIndex]; if(!current)return;
  words=words.map(w=>{
    if(w.id!==current.id)return w;
    if(!correct)return {...w,box:1,nextReview:addDays(1),learned:false,updatedAt:Date.now()};
    if(Number(w.box||1)>=5)return {...w,learned:true,nextReview:null,updatedAt:Date.now()};
    const nextBox=Number(w.box||1)+1; return {...w,box:nextBox,nextReview:addDays(INTERVALS[nextBox-1]),learned:false,updatedAt:Date.now()};
  });
  if(correct){game.correctReviews+=1;awardXp(10,'Correct',true)}else{game.wrongReviews+=1;awardXp(2,'Effort counts',true)}
  $('sessionXp').textContent=sessionXp; reviewIndex+=1; persist(); showReviewCard();
}

function renderWords(){
  const q=normalizeWord($('filterWords').value); const host=$('wordsList'); host.innerHTML=''; const dueIds=new Set(dueWords().map(w=>w.id));
  const filtered=words.filter(w=>{
    const queryOk=!q||normalizeWord(w.word).includes(q)||normalizeWord(w.enDefinition).includes(q)||String(w.faMeaning||'').includes(q);
    const filterOk=currentLibraryFilter==='all'||(currentLibraryFilter==='due'&&dueIds.has(w.id))||(currentLibraryFilter==='learning'&&!w.learned)||(currentLibraryFilter==='mastered'&&w.learned);
    return queryOk&&filterOk;
  });
  if(!filtered.length){host.innerHTML='<p class="muted">No words match this view yet.</p>';return}
  filtered.forEach(w=>{
    const item=document.createElement('article');item.className='word-item';item.innerHTML=`<div class="word-top"><div><h3>${escapeHtml(w.word)}</h3><div class="phonetic">${escapeHtml(w.phonetic||'')}</div></div><span class="badge ${w.learned?'mastered':''}">${w.learned?'Mastered':`Box ${w.box||1}`}</span></div><p class="word-meaning persian-text" dir="rtl">${escapeHtml(w.faMeaning||'')}</p><p class="word-definition">${escapeHtml(w.enDefinition||'')}</p><div class="word-actions"><button class="secondary" data-action="study" data-id="${w.id}">Study now</button><button data-action="reset" data-id="${w.id}">Reset</button><button class="danger" data-action="delete" data-id="${w.id}">Delete</button></div>`;host.appendChild(item);
  });
}
$('filterWords').addEventListener('input',renderWords);
$('libraryFilters').addEventListener('click',event=>{const b=event.target.closest('button');if(!b)return;currentLibraryFilter=b.dataset.filter;document.querySelectorAll('#libraryFilters button').forEach(x=>x.classList.toggle('active',x===b));renderWords()});
$('wordsList').addEventListener('click',event=>{
  const b=event.target.closest('button');if(!b)return;const id=b.dataset.id;const word=words.find(w=>w.id===id);if(!word)return;
  if(b.dataset.action==='delete'){if(confirm(`Delete “${word.word}”?`)){words=words.filter(w=>w.id!==id);persist();refreshAll();renderWords();}}
  if(b.dataset.action==='reset'){words=words.map(w=>w.id===id?{...w,box:1,nextReview:todayStart(),learned:false}:w);persist();refreshAll();renderWords();toast('Word returned to Box 1.');}
  if(b.dataset.action==='study'){reviewQueue=[word];reviewIndex=0;sessionXp=0;switchView('reviewView');}
});

$('exportBtn').addEventListener('click',()=>{
  const payload={app:'VajehYar',version:2,exportedAt:new Date().toISOString(),words,game,searchHistory}; const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}); const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`vajehyar-backup-${nowDateKey()}.json`;a.click();URL.revokeObjectURL(a.href);
});
$('importInput').addEventListener('change',async event=>{
  const file=event.target.files[0];if(!file)return;
  try{const data=JSON.parse(await file.text());const incoming=Array.isArray(data)?data:data.words;if(!Array.isArray(incoming))throw new Error();words=incoming;if(data.game)game={...defaultGame(),...data.game};if(Array.isArray(data.searchHistory))searchHistory=data.searchHistory;persist();refreshAll();toast('Backup restored successfully.');}
  catch{toast('This backup file is not valid.')} event.target.value='';
});
$('goalOptions').addEventListener('click',event=>{const b=event.target.closest('button');if(!b)return;game.dailyGoal=Number(b.dataset.goal);persist();refreshStats();toast(`Daily goal set to ${game.dailyGoal} reviews.`)});

window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();deferredPrompt=event;$('installBtn').classList.remove('hidden')});
$('installBtn').addEventListener('click',async()=>{if(!deferredPrompt)return;deferredPrompt.prompt();await deferredPrompt.userChoice;deferredPrompt=null;$('installBtn').classList.add('hidden')});
if('serviceWorker' in navigator) window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js'));

function refreshAll(){refreshStats();renderWords();renderSearchHistory();}
resetDailyIfNeeded(); refreshAll();
