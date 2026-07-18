const DB_KEY = 'vajehyar_words_v1';
const GAME_KEY = 'vajehyar_game_v1';
const HISTORY_KEY = 'vajehyar_search_history_v1';
const PRACTICE_KEY = 'vajehyar_practice_v1';
const INTERVALS = [1, 2, 4, 8, 16];
const APP_VERSION = '2.3.0';

// Helpers are intentionally declared before state initialization.
// v2.0 initialized game state too early, which stopped all JavaScript,
// including the bottom navigation, on some devices.
const $ = id => document.getElementById(id);
function nowDateKey(){
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
const todayStart = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); };
const addDays = days => { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + days); return d.getTime(); };
const normalizeWord = value => String(value || '').trim().toLowerCase();
const unique = values => [...new Set((values || []).filter(Boolean).map(v => String(v).trim()).filter(Boolean))];
const escapeHtml = value => String(value || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
const on = (id, eventName, handler) => { const element = $(id); if (element) element.addEventListener(eventName, handler); };

function defaultGame(){
  return {xp:0, streak:0, lastActiveDate:null, dailyDate:nowDateKey(), dailyReviews:0, dailyXp:0, dailyGoal:10, totalReviews:0, correctReviews:0, wrongReviews:0, goalBonusDate:null, practiceBonusDate:null, activePracticeCount:0};
}
function loadJson(key, fallback){
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
  catch { return fallback; }
}

let words = loadJson(DB_KEY, []);
let game = {...defaultGame(), ...loadJson(GAME_KEY, {})};
let searchHistory = loadJson(HISTORY_KEY, []);
let practiceSessions = loadJson(PRACTICE_KEY, []);
let currentResult = null;
let reviewQueue = [];
let reviewIndex = 0;
let sessionXp = 0;
let currentLibraryFilter = 'all';
let deferredPrompt = null;
let customReviewQueue = null;
let currentReviewMode = 'recognition';
let currentPracticeWords = [];
let pendingSharedContext = null;

function persist(){
  localStorage.setItem(DB_KEY, JSON.stringify(words));
  localStorage.setItem(GAME_KEY, JSON.stringify(game));
  localStorage.setItem(HISTORY_KEY, JSON.stringify(searchHistory));
  localStorage.setItem(PRACTICE_KEY, JSON.stringify(practiceSessions));
}
function resetDailyIfNeeded(){
  const today = nowDateKey();
  if (game.dailyDate !== today){
    game.dailyDate = today;
    game.dailyReviews = 0;
    game.dailyXp = 0;
    game.goalBonusDate = null;
    persist();
  }
}
function dayDiff(a, b){
  const one = new Date(`${a}T00:00:00`);
  const two = new Date(`${b}T00:00:00`);
  return Math.round((two - one) / 86400000);
}
function markActivity(){
  resetDailyIfNeeded();
  const today = nowDateKey();
  if (game.lastActiveDate === today) return;
  if (game.lastActiveDate && dayDiff(game.lastActiveDate, today) === 1) game.streak += 1;
  else game.streak = 1;
  game.lastActiveDate = today;
}
function awardXp(amount, reason, countReview = false){
  resetDailyIfNeeded();
  markActivity();
  game.xp += amount;
  game.dailyXp += amount;
  sessionXp += countReview ? amount : 0;
  if (countReview){ game.dailyReviews += 1; game.totalReviews += 1; }
  if (game.dailyReviews >= game.dailyGoal && game.goalBonusDate !== nowDateKey()){
    game.goalBonusDate = nowDateKey();
    game.xp += 25;
    game.dailyXp += 25;
    sessionXp += 25;
    toast('Daily goal complete! +25 bonus XP');
    confetti();
  } else if (reason) toast(`${reason} +${amount} XP`);
  persist();
  refreshAll();
}
function toast(message){
  const element = $('toast');
  if (!element) return;
  element.textContent = message;
  element.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => element.classList.remove('show'), 2200);
}
function confetti(){
  const host = $('confetti');
  if (!host) return;
  const colors = ['#5b5cf0','#8b5cf6','#f4a623','#22c55e','#38bdf8','#f43f5e'];
  for (let i = 0; i < 42; i += 1){
    const piece = document.createElement('i');
    piece.style.left = `${Math.random() * 100}%`;
    piece.style.background = colors[i % colors.length];
    piece.style.animationDelay = `${Math.random() * .35}s`;
    piece.style.setProperty('--drift', `${(Math.random() - .5) * 260}px`);
    host.appendChild(piece);
    setTimeout(() => piece.remove(), 1900);
  }
}
function dueWords(){
  const now = todayStart();
  return words.filter(w => !w.learned && Number(w.nextReview || 0) <= now).sort((a, b) => Number(a.nextReview || 0) - Number(b.nextReview || 0));
}

function switchView(id, options = {}){
  const destination = $(id);
  if (!destination) return;
  document.querySelectorAll('.view').forEach(view => view.classList.toggle('active', view.id === id));
  document.querySelectorAll('.bottom-nav [data-view]').forEach(button => button.classList.toggle('active', button.dataset.view === id));
  if (id === 'reviewView'){
    if (Array.isArray(options.queue)){
      reviewQueue = options.queue;
      reviewIndex = 0;
      sessionXp = 0;
      if ($('sessionXp')) $('sessionXp').textContent = '0';
      showReviewCard();
    } else if (customReviewQueue){
      const queue = customReviewQueue;
      customReviewQueue = null;
      reviewQueue = queue;
      reviewIndex = 0;
      sessionXp = 0;
      if ($('sessionXp')) $('sessionXp').textContent = '0';
      showReviewCard();
    } else prepareReview();
  }
  if (id === 'wordsView') renderWords();
  if (id === 'practiceView') prepareActivePractice();
  try { history.replaceState(null, '', `#${id.replace('View', '')}`); } catch {}
  window.scrollTo({top:0, behavior:'smooth'});
}

const bottomNav = document.querySelector('.bottom-nav');
if (bottomNav){
  bottomNav.addEventListener('click', event => {
    const button = event.target.closest('[data-view]');
    if (!button) return;
    event.preventDefault();
    switchView(button.dataset.view);
  });
}
on('startReviewBtn', 'click', () => switchView('reviewView'));
on('emptySearchBtn', 'click', () => switchView('searchView'));
on('emptyPracticeBtn', 'click', () => switchView('practiceView'));
on('startPracticeBtn', 'click', () => switchView('practiceView'));
on('practiceBackBtn', 'click', () => switchView('homeView'));
on('practiceFindWordBtn', 'click', () => switchView('searchView'));

function refreshStats(){
  resetDailyIfNeeded();
  const level = Math.floor(game.xp / 100) + 1;
  const within = game.xp % 100;
  if ($('levelLabel')) $('levelLabel').textContent = `Level ${level}`;
  if ($('levelOrb')) $('levelOrb').textContent = level;
  if ($('xpLabel')) $('xpLabel').textContent = `${game.xp} XP`;
  if ($('xpNextLabel')) $('xpNextLabel').textContent = `${100 - within} XP to next level`;
  if ($('xpProgress')) $('xpProgress').style.width = `${within}%`;
  if ($('streakCount')) $('streakCount').textContent = game.streak;
  if ($('dueCount')) $('dueCount').textContent = dueWords().length;
  if ($('totalCount')) $('totalCount').textContent = words.length;
  if ($('learnedCount')) $('learnedCount').textContent = words.filter(w => w.learned).length;
  if ($('todayXpCount')) $('todayXpCount').textContent = game.dailyXp;
  const goal = Math.max(1, game.dailyGoal);
  const progress = Math.min(1, game.dailyReviews / goal);
  if ($('goalProgressText')) $('goalProgressText').textContent = `${game.dailyReviews}/${goal}`;
  if ($('goalRing')) $('goalRing').style.setProperty('--pct', `${progress * 360}deg`);
  if ($('goalStatus')) $('goalStatus').textContent = progress >= 1 ? 'Goal complete!' : 'Keep the streak alive';
  const box = $('boxStats');
  if (box){
    box.innerHTML = '';
    const colors = ['#5b5cf0','#7c6cf3','#8b5cf6','#b453d6','#e24a61'];
    for (let i = 1; i <= 5; i += 1){
      const count = words.filter(w => !w.learned && Number(w.box || 1) === i).length;
      const item = document.createElement('div');
      item.className = 'box-item';
      item.style.setProperty('--box-color', colors[i - 1]);
      item.innerHTML = `<strong>${count}</strong><span>Box ${i}</span>`;
      box.appendChild(item);
    }
  }
  refreshActivePracticeHome();
  renderBadges();
  document.querySelectorAll('#goalOptions button').forEach(button => button.classList.toggle('active', Number(button.dataset.goal) === Number(game.dailyGoal)));
}

const BADGES = [
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
  const host = $('badgesGrid');
  if (!host) return;
  host.innerHTML = '';
  let unlocked = 0;
  BADGES.forEach(badge => {
    const isUnlocked = badge.ok();
    if (isUnlocked) unlocked += 1;
    const element = document.createElement('div');
    element.className = `badge-card ${isUnlocked ? 'unlocked' : ''}`;
    element.innerHTML = `<div class="badge-icon">${badge.icon}</div><strong>${badge.name}</strong><span>${isUnlocked ? 'Unlocked' : badge.desc}</span>`;
    host.appendChild(element);
  });
  if ($('badgeSummary')) $('badgeSummary').textContent = `${unlocked}/${BADGES.length} unlocked`;
}

async function fetchDictionary(word){
  const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`);
  if (!response.ok) throw new Error('not-found');
  const entries = await response.json();
  const allMeanings = [];
  const phonetics = [];
  const sources = [];
  const origins = [];
  entries.forEach(entry => {
    if (entry.origin) origins.push(entry.origin);
    (entry.phonetics || []).forEach(p => phonetics.push({text:p.text || '', audio:p.audio || '', sourceUrl:p.sourceUrl || ''}));
    (entry.sourceUrls || []).forEach(source => sources.push(source));
    (entry.meanings || []).forEach(meaning => allMeanings.push({
      partOfSpeech: meaning.partOfSpeech || 'other',
      synonyms: meaning.synonyms || [],
      antonyms: meaning.antonyms || [],
      definitions: (meaning.definitions || []).map(definition => ({
        definition: definition.definition || '',
        example: definition.example || '',
        synonyms: definition.synonyms || [],
        antonyms: definition.antonyms || []
      }))
    }));
  });
  const audio = phonetics.find(p => p.audio)?.audio || '';
  const phonetic = entries.find(entry => entry.phonetic)?.phonetic || phonetics.find(p => p.text)?.text || '';
  return {word:entries[0]?.word || word, phonetic, audio, meanings:allMeanings, sourceUrl:sources[0] || '', origins:unique(origins), license:entries[0]?.license || null};
}
async function fetchPersian(word){
  try {
    const response = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(word)}&langpair=en|fa`);
    if (!response.ok) return '';
    const data = await response.json();
    const translated = String(data?.responseData?.translatedText || '').trim();
    return translated.toLowerCase() === word.toLowerCase() ? '' : translated;
  } catch { return ''; }
}
async function fetchDatamuse(params){
  try {
    const query = new URLSearchParams({...params, max:String(params.max || 24)});
    const response = await fetch(`https://api.datamuse.com/words?${query.toString()}`);
    if (!response.ok) return [];
    const data = await response.json();
    return unique(data.map(item => item.word)).filter(word => /^[a-z][a-z'-]*$/i.test(word));
  } catch { return []; }
}

function estimateBaseForms(word){
  const value = normalizeWord(word).replace(/[^a-z'-]/g, '');
  if (!value) return [];
  const candidates = [value];
  const add = candidate => { if (candidate && candidate.length >= 3) candidates.push(candidate); };
  const undouble = candidate => /([b-df-hj-np-tv-z])\1$/i.test(candidate) ? candidate.slice(0, -1) : candidate;

  if (value.endsWith('ies') && value.length > 4) add(`${value.slice(0, -3)}y`);
  if (value.endsWith('ied') && value.length > 4) add(`${value.slice(0, -3)}y`);
  if (value.endsWith('ing') && value.length > 5){
    const base = value.slice(0, -3); add(base); add(undouble(base)); add(`${base}e`);
  }
  if (value.endsWith('ed') && value.length > 4){
    const base = value.slice(0, -2); add(base); add(undouble(base)); add(`${base}e`);
  }
  if (value.endsWith('er') && value.length > 4) add(undouble(value.slice(0, -2)));
  if (value.endsWith('est') && value.length > 5) add(undouble(value.slice(0, -3)));

  const suffixes = ['ization','isation','ational','fulness','ousness','iveness','ability','ibility','ement','ments','ingly','edly','ation','ition','tion','sion','ness','ment','ance','ence','ancy','ency','able','ible','ally','ical','ity','ive','ous','ful','less','ism','ist','ize','ise','ly'];
  suffixes.forEach(suffix => {
    if (value.endsWith(suffix) && value.length - suffix.length >= 3){
      const stem = value.slice(0, -suffix.length);
      add(stem);
      if (suffix === 'ity') add(`${stem}e`);
      if (suffix === 'ation' || suffix === 'ition' || suffix === 'tion' || suffix === 'sion') add(`${stem}e`);
      if (suffix === 'ence' && stem.endsWith('i')) add(`${stem.slice(0, -1)}ent`);
      if (suffix === 'ance' && stem.endsWith('i')) add(`${stem.slice(0, -1)}ant`);
    }
  });

  const prefixes = ['counter','under','inter','trans','super','over','anti','auto','post','pre','non','mis','dis','sub','re','un','im','in','ir','il','de','co'];
  prefixes.forEach(prefix => {
    if (value.startsWith(prefix) && value.length - prefix.length >= 4) add(value.slice(prefix.length));
  });
  return unique(candidates).sort((a, b) => a.length - b.length).slice(0, 6);
}

async function fetchWordFamily(word){
  const bases = estimateBaseForms(word);
  const preferredBase = bases.find(base => base !== normalizeWord(word)) || normalizeWord(word);
  const queryBase = preferredBase.length >= 4 ? preferredBase : normalizeWord(word).slice(0, Math.max(3, normalizeWord(word).length - 2));
  const matches = await fetchDatamuse({sp:`${queryBase}*`, md:'p', max:80});
  const family = matches.filter(item => {
    if (item === normalizeWord(word)) return false;
    if (item.includes(' ')) return false;
    return item.startsWith(queryBase) && item.length <= queryBase.length + 11;
  });
  return {bases:unique(bases.filter(base => base !== normalizeWord(word))).slice(0, 4), family:unique([...bases, ...family]).filter(item => item !== normalizeWord(word)).slice(0, 24)};
}

async function fetchLexicalExtras(word, dictionaryResult){
  const builtInSynonyms = aggregateRelations(dictionaryResult, 'synonyms');
  const builtInAntonyms = aggregateRelations(dictionaryResult, 'antonyms');
  const [synonymsApi, antonymsApi, relatedApi, familyData] = await Promise.all([
    fetchDatamuse({rel_syn:word, max:30}),
    fetchDatamuse({rel_ant:word, max:24}),
    fetchDatamuse({ml:word, max:30}),
    fetchWordFamily(word)
  ]);
  const synonyms = unique([...builtInSynonyms, ...synonymsApi]).filter(item => normalizeWord(item) !== normalizeWord(word)).slice(0, 24);
  const antonyms = unique([...builtInAntonyms, ...antonymsApi]).filter(item => normalizeWord(item) !== normalizeWord(word)).slice(0, 24);
  const blocked = new Set([normalizeWord(word), ...synonyms.map(normalizeWord), ...antonyms.map(normalizeWord)]);
  const related = unique(relatedApi).filter(item => !blocked.has(normalizeWord(item))).slice(0, 24);
  return {synonyms, antonyms, related, family:familyData.family, rootCandidates:familyData.bases};
}

function firstDefinition(result){
  for (const meaning of result.meanings || []){
    for (const definition of meaning.definitions || []){
      if (definition.definition) return {definition:definition.definition, example:definition.example || '', partOfSpeech:meaning.partOfSpeech || ''};
    }
  }
  return {definition:'', example:'', partOfSpeech:''};
}
function aggregateRelations(result, key){
  const items = [];
  (result.meanings || []).forEach(meaning => {
    items.push(...(meaning[key] || []));
    (meaning.definitions || []).forEach(definition => items.push(...(definition[key] || [])));
  });
  return unique(items).slice(0, 24);
}
function addSearchHistory(word){
  searchHistory = [word, ...searchHistory.filter(item => item !== word)].slice(0, 12);
  persist();
  renderSearchHistory();
}
function submitDictionaryWord(word){
  if (!$('wordInput') || !$('searchForm')) return;
  $('wordInput').value = word;
  if (typeof $('searchForm').requestSubmit === 'function') $('searchForm').requestSubmit();
  else $('searchForm').dispatchEvent(new Event('submit', {cancelable:true, bubbles:true}));
}
function renderSearchHistory(){
  const host = $('recentSearches');
  if (!host) return;
  host.innerHTML = '';
  if (!searchHistory.length){
    host.innerHTML = '<span class="muted mini">No recent searches yet.</span>';
    return;
  }
  searchHistory.forEach(word => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'chip';
    button.textContent = word;
    button.addEventListener('click', () => submitDictionaryWord(word));
    host.appendChild(button);
  });
}
on('clearHistoryBtn', 'click', () => { searchHistory = []; persist(); renderSearchHistory(); });

on('searchForm', 'submit', async event => {
  event.preventDefault();
  const word = normalizeWord($('wordInput')?.value);
  if (!word) return;
  if ($('searchStatus')) $('searchStatus').textContent = 'Searching definitions, pronunciation, and word relations...';
  if ($('resultCard')) $('resultCard').classList.add('hidden');
  const saved = words.find(item => normalizeWord(item.word) === word);
  try {
    const result = await fetchDictionary(word);
    const [persian, extras] = await Promise.all([
      saved?.faMeaning ? Promise.resolve(saved.faMeaning) : fetchPersian(result.word),
      fetchLexicalExtras(result.word, result)
    ]);
    currentResult = {
      ...result,
      ...extras,
      faMeaning:persian,
      note:saved?.note || '',
      contextSentence:saved?.contextSentence || pendingSharedContext?.sentence || '',
      sourceTitle:saved?.sourceTitle || pendingSharedContext?.sourceTitle || '',
      sourceType:saved?.sourceType || pendingSharedContext?.sourceType || '',
      sourceUrlInput:saved?.sourceUrlInput || pendingSharedContext?.sourceUrl || '',
      savedId:saved?.id || null
    };
    renderDictionaryResult(currentResult);
    addSearchHistory(result.word);
    if ($('searchStatus')) $('searchStatus').textContent = '';
  } catch {
    if (saved){
      currentResult = storedWordToResult(saved);
      renderDictionaryResult(currentResult);
      addSearchHistory(saved.word);
      if ($('searchStatus')) $('searchStatus').textContent = 'Showing the saved offline entry.';
    } else if ($('searchStatus')) $('searchStatus').textContent = 'The word was not found, or the internet connection is unavailable.';
  }
});

function storedWordToResult(word){
  return {
    word:word.word,
    phonetic:word.phonetic || '',
    audio:word.audio || '',
    meanings:word.meanings || [{partOfSpeech:word.partOfSpeech || 'saved', synonyms:word.synonyms || [], antonyms:word.antonyms || [], definitions:[{definition:word.enDefinition || '', example:word.example || '', synonyms:[], antonyms:[]}]}],
    sourceUrl:word.sourceUrl || '',
    origins:word.origins || [],
    synonyms:word.synonyms || [],
    antonyms:word.antonyms || [],
    family:word.family || [],
    related:word.related || [],
    rootCandidates:word.rootCandidates || [],
    faMeaning:word.faMeaning || '',
    note:word.note || '',
    contextSentence:word.contextSentence || word.example || '',
    sourceTitle:word.sourceTitle || '',
    sourceType:word.sourceType || '',
    sourceUrlInput:word.sourceUrlInput || '',
    savedId:word.id
  };
}
function renderDictionaryResult(result){
  if ($('resultWord')) $('resultWord').textContent = result.word;
  if ($('phonetic')) $('phonetic').textContent = result.phonetic || 'Pronunciation not available';
  if ($('faMeaning')) $('faMeaning').value = result.faMeaning || '';
  if ($('personalNote')) $('personalNote').value = result.note || '';
  if ($('contextSentence')) $('contextSentence').value = result.contextSentence || pendingSharedContext?.sentence || '';
  if ($('sourceTitle')) $('sourceTitle').value = result.sourceTitle || pendingSharedContext?.sourceTitle || '';
  if ($('sourceType')) $('sourceType').value = result.sourceType || pendingSharedContext?.sourceType || '';
  if ($('sourceUrlInput')) $('sourceUrlInput').value = result.sourceUrlInput || pendingSharedContext?.sourceUrl || '';
  if ($('savedBadge')) $('savedBadge').classList.toggle('hidden', !result.savedId);
  if ($('saveWordBtn')) $('saveWordBtn').textContent = result.savedId ? 'Update saved word' : 'Add to Leitner Box 1 · +5 XP';

  const parts = unique((result.meanings || []).map(meaning => meaning.partOfSpeech));
  if ($('partOfSpeechChips')) $('partOfSpeechChips').innerHTML = parts.map(part => `<span class="chip pos">${escapeHtml(part)}</span>`).join('');

  const meaningsHost = $('meaningsList');
  let definitionCount = 0;
  if (meaningsHost){
    meaningsHost.innerHTML = '';
    (result.meanings || []).forEach(group => {
      const definitions = (group.definitions || []).filter(item => item.definition).slice(0, 6);
      if (!definitions.length) return;
      definitionCount += definitions.length;
      const element = document.createElement('article');
      element.className = 'meaning-group';
      element.innerHTML = `<div class="meaning-group-head">${escapeHtml(group.partOfSpeech || 'Meaning')}</div>${definitions.map((definition, index) => `<div class="definition-item"><p class="definition-text"><strong>${index + 1}.</strong> ${escapeHtml(definition.definition)}</p>${definition.example ? `<p class="definition-example">“${escapeHtml(definition.example)}”</p>` : ''}</div>`).join('')}`;
      meaningsHost.appendChild(element);
    });
  }
  if ($('definitionCount')) $('definitionCount').textContent = `${definitionCount} definition${definitionCount === 1 ? '' : 's'}`;

  const synonyms = unique([...(result.synonyms || []), ...aggregateRelations(result, 'synonyms')]).slice(0, 24);
  const antonyms = unique([...(result.antonyms || []), ...aggregateRelations(result, 'antonyms')]).slice(0, 24);
  const family = unique(result.family || []).slice(0, 24);
  const related = unique(result.related || []).slice(0, 24);
  renderRelation('synonyms', synonyms);
  renderRelation('antonyms', antonyms);
  renderRelation('family', family);
  renderRelation('related', related);

  const roots = unique(result.rootCandidates || []).filter(root => normalizeWord(root) !== normalizeWord(result.word));
  if ($('rootHint')){
    $('rootHint').textContent = roots.length ? `Possible base form${roots.length > 1 ? 's' : ''}: ${roots.join(' · ')}` : '';
    $('rootHint').classList.toggle('hidden', !roots.length);
  }
  const hasRelations = synonyms.length || antonyms.length || family.length || related.length;
  if ($('wordRelations')) $('wordRelations').classList.toggle('hidden', !hasRelations);

  const origins = unique(result.origins || []);
  if ($('originBlock')) $('originBlock').classList.toggle('hidden', !origins.length);
  if ($('originText')) $('originText').textContent = origins.join('\n\n');

  if (result.sourceUrl && $('sourceBlock') && $('sourceLink')){
    $('sourceBlock').classList.remove('hidden');
    $('sourceLink').href = result.sourceUrl;
  } else if ($('sourceBlock')) $('sourceBlock').classList.add('hidden');
  if ($('resultCard')) $('resultCard').classList.remove('hidden');
}
function renderRelation(type, items){
  const block = $(`${type}Block`);
  const list = $(`${type}List`);
  if (!block || !list) return;
  block.classList.toggle('hidden', !items.length);
  list.innerHTML = '';
  items.forEach(word => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'chip';
    button.textContent = word;
    button.addEventListener('click', () => submitDictionaryWord(word));
    list.appendChild(button);
  });
}
function speak(text, audioUrl = ''){
  if (audioUrl){
    const audio = new Audio(audioUrl);
    audio.play().catch(() => speakWithTts(text));
  } else speakWithTts(text);
}
function speakWithTts(text){
  if (!('speechSynthesis' in window)) return;
  speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'en-US';
  speechSynthesis.speak(utterance);
}
on('speakBtn', 'click', () => currentResult && speak(currentResult.word, currentResult.audio));

on('saveWordBtn', 'click', () => {
  if (!currentResult) return;
  const primary = firstDefinition(currentResult);
  const existing = words.find(word => word.id === currentResult.savedId) || words.find(word => normalizeWord(word.word) === normalizeWord(currentResult.word));
  const id = existing?.id || (crypto.randomUUID ? crypto.randomUUID() : `word-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  const record = {
    id,
    word:currentResult.word,
    phonetic:currentResult.phonetic || '',
    audio:currentResult.audio || '',
    faMeaning:$('faMeaning')?.value.trim() || '',
    note:$('personalNote')?.value.trim() || '',
    contextSentence:$('contextSentence')?.value.trim() || primary.example || '',
    sourceTitle:$('sourceTitle')?.value.trim() || '',
    sourceType:$('sourceType')?.value || '',
    sourceUrlInput:$('sourceUrlInput')?.value.trim() || '',
    enDefinition:primary.definition,
    example:primary.example,
    partOfSpeech:primary.partOfSpeech,
    meanings:currentResult.meanings || [],
    synonyms:unique([...(currentResult.synonyms || []), ...aggregateRelations(currentResult, 'synonyms')]),
    antonyms:unique([...(currentResult.antonyms || []), ...aggregateRelations(currentResult, 'antonyms')]),
    family:currentResult.family || [],
    related:currentResult.related || [],
    rootCandidates:currentResult.rootCandidates || [],
    origins:currentResult.origins || [],
    sourceUrl:currentResult.sourceUrl || '',
    box:existing?.box || 1,
    nextReview:existing?.nextReview ?? todayStart(),
    createdAt:existing?.createdAt || Date.now(),
    updatedAt:Date.now(),
    learned:existing?.learned || false,
    reviewCount:existing?.reviewCount || 0,
    correctCount:existing?.correctCount || 0,
    wrongCount:existing?.wrongCount || 0,
    lastReviewedDate:existing?.lastReviewedDate || null,
    lastRating:existing?.lastRating || null,
    lastReviewMode:existing?.lastReviewMode || null
  };
  if (existing) words = words.map(word => word.id === existing.id ? record : word);
  else words.unshift(record);
  persist();
  if (!existing) awardXp(5, 'New word saved');
  else { refreshAll(); toast('Saved word updated.'); }
  pendingSharedContext = null;
  switchView('homeView');
});

function prepareReview(){
  reviewQueue = dueWords();
  reviewIndex = 0;
  sessionXp = 0;
  if ($('sessionXp')) $('sessionXp').textContent = '0';
  showReviewCard();
}
function reviewModesFor(word){
  const modes = ['recognition'];
  if (word.faMeaning || word.enDefinition) modes.push('reverse');
  const sentence = word.contextSentence || word.example || '';
  if (sentence && new RegExp(`\\b${escapeRegExp(word.word)}\\b`, 'i').test(sentence)) modes.push('cloze');
  modes.push('listening');
  return unique(modes);
}
function escapeRegExp(value){ return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function chooseReviewMode(word){
  const modes = reviewModesFor(word);
  const seed = Number(word.reviewCount || 0) + reviewIndex + Number(word.box || 1);
  return modes[seed % modes.length] || 'recognition';
}
function clozeSentence(word){
  const sentence = word.contextSentence || word.example || '';
  if (!sentence) return '';
  return sentence.replace(new RegExp(`\\b${escapeRegExp(word.word)}\\b`, 'ig'), '_____');
}
function showReviewCard(){
  const empty = $('reviewEmpty');
  const content = $('reviewContent');
  if (!empty || !content) return;
  if (reviewIndex >= reviewQueue.length){
    empty.classList.remove('hidden');
    content.classList.add('hidden');
    if (reviewQueue.length) confetti();
    refreshAll();
    return;
  }
  empty.classList.add('hidden');
  content.classList.remove('hidden');
  const word = reviewQueue[reviewIndex];
  currentReviewMode = chooseReviewMode(word);
  const modeLabels = {recognition:'Meaning recall', reverse:'Reverse recall', cloze:'Fill in the blank', listening:'Listening'};
  if ($('reviewModeLabel')) $('reviewModeLabel').textContent = modeLabels[currentReviewMode];
  if ($('reviewBox')) $('reviewBox').textContent = `Leitner Box ${word.box || 1}`;
  if ($('reviewCounter')) $('reviewCounter').textContent = `${reviewIndex + 1} of ${reviewQueue.length}`;
  if ($('reviewCorrectWord')) $('reviewCorrectWord').textContent = word.word;
  if ($('reviewFa')) $('reviewFa').textContent = word.faMeaning || 'No Persian meaning saved';
  if ($('reviewEn')) $('reviewEn').textContent = word.enDefinition || firstDefinition(storedWordToResult(word)).definition || '';
  const context = word.contextSentence || word.example || '';
  if ($('reviewExample')){
    $('reviewExample').textContent = context;
    $('reviewExample').classList.toggle('hidden', !context);
  }
  const sourceParts = [word.sourceType, word.sourceTitle].filter(Boolean);
  if ($('reviewSource')){
    const sourceLabel = sourceParts.join(' · ');
    $('reviewSource').innerHTML = sourceLabel || word.sourceUrlInput ? `${sourceLabel ? escapeHtml(sourceLabel) : 'Saved source'}${word.sourceUrlInput ? ` · <a href="${escapeHtml(word.sourceUrlInput)}" target="_blank" rel="noopener">Open link ↗</a>` : ''}` : '';
    $('reviewSource').classList.toggle('hidden', !(sourceLabel || word.sourceUrlInput));
  }

  const prompt = $('reviewPrompt');
  const question = $('reviewWord');
  const inputPanel = $('reviewInputPanel');
  const input = $('reviewAnswerInput');
  const speakButton = $('reviewSpeakBtn');
  if (input) input.value = '';
  if ($('answerFeedback')) {
    $('answerFeedback').textContent = '';
    $('answerFeedback').className = 'answer-feedback hidden';
  }
  $('answerPanel')?.classList.add('hidden');
  $('revealBtn')?.classList.remove('hidden');
  inputPanel?.classList.add('hidden');
  speakButton?.classList.add('hidden');
  question?.classList.remove('persian-text');
  question?.removeAttribute('dir');

  if (currentReviewMode === 'recognition'){
    if (prompt) prompt.textContent = 'What does this word mean?';
    if (question) question.textContent = word.word;
    if ($('reviewHint')) $('reviewHint').textContent = word.partOfSpeech ? `Part of speech: ${word.partOfSpeech}` : '';
    speakButton?.classList.remove('hidden');
  } else if (currentReviewMode === 'reverse'){
    if (prompt) prompt.textContent = 'Type the English word for this meaning.';
    if (question) {
      question.textContent = word.faMeaning || word.enDefinition || '';
      if (word.faMeaning){ question.classList.add('persian-text'); question.setAttribute('dir','rtl'); }
    }
    if ($('reviewHint')) $('reviewHint').textContent = word.partOfSpeech ? `Part of speech: ${word.partOfSpeech}` : '';
    inputPanel?.classList.remove('hidden');
  } else if (currentReviewMode === 'cloze'){
    if (prompt) prompt.textContent = 'Complete the sentence with the missing word.';
    if (question) question.textContent = clozeSentence(word);
    if ($('reviewHint')) $('reviewHint').textContent = word.faMeaning ? `Meaning: ${word.faMeaning}` : '';
    inputPanel?.classList.remove('hidden');
  } else {
    if (prompt) prompt.textContent = 'Listen, then type the word you hear.';
    if (question) question.textContent = '🔊';
    if ($('reviewHint')) $('reviewHint').textContent = 'You can replay the audio as many times as needed.';
    inputPanel?.classList.remove('hidden');
    speakButton?.classList.remove('hidden');
    setTimeout(() => speak(word.word, word.audio), 180);
  }

  if ($('reviewProgress')) $('reviewProgress').style.width = `${reviewIndex / Math.max(1, reviewQueue.length) * 100}%`;
  if (!inputPanel?.classList.contains('hidden')) setTimeout(() => input?.focus(), 120);
}
function revealReviewAnswer(feedback = ''){
  const word = reviewQueue[reviewIndex];
  if (!word) return;
  $('answerPanel')?.classList.remove('hidden');
  $('revealBtn')?.classList.add('hidden');
  if (feedback && $('answerFeedback')){
    $('answerFeedback').textContent = feedback;
    $('answerFeedback').classList.remove('hidden');
  }
}
on('revealBtn', 'click', () => revealReviewAnswer());
on('checkAnswerBtn', 'click', () => {
  const word = reviewQueue[reviewIndex];
  if (!word) return;
  const answer = normalizeWord($('reviewAnswerInput')?.value).replace(/[^a-z'-]/g,'');
  const expected = normalizeWord(word.word).replace(/[^a-z'-]/g,'');
  const correct = answer === expected;
  if ($('answerFeedback')){
    $('answerFeedback').className = `answer-feedback ${correct ? 'correct' : 'incorrect'}`;
  }
  revealReviewAnswer(correct ? 'Correct — now rate how easy the recall felt.' : `The correct word is “${word.word}”. Rate the recall honestly.`);
});
on('reviewAnswerInput', 'keydown', event => {
  if (event.key === 'Enter'){ event.preventDefault(); $('checkAnswerBtn')?.click(); }
});
on('reviewSpeakBtn', 'click', () => { const word = reviewQueue[reviewIndex]; if (word) speak(word.word, word.audio); });
on('ratingButtons', 'click', event => {
  const button = event.target.closest('[data-rating]');
  if (button) rateReview(button.dataset.rating);
});
function rateReview(rating){
  const current = reviewQueue[reviewIndex];
  if (!current) return;
  const currentBox = Math.max(1, Math.min(5, Number(current.box || 1)));
  const today = nowDateKey();
  const ratingConfig = {
    again:{xp:2,label:'Keep going'},
    hard:{xp:5,label:'Hard recall'},
    good:{xp:10,label:'Good recall'},
    easy:{xp:15,label:'Easy recall'}
  }[rating] || {xp:10,label:'Good recall'};

  words = words.map(word => {
    if (word.id !== current.id) return word;
    let box = currentBox;
    let nextReview = addDays(INTERVALS[currentBox - 1]);
    let learned = false;

    if (rating === 'again'){
      box = 1; nextReview = addDays(1);
    } else if (rating === 'hard'){
      box = currentBox; nextReview = addDays(Math.max(1, Math.ceil(INTERVALS[currentBox - 1] / 2)));
    } else if (rating === 'easy'){
      if (currentBox >= 4){ learned = true; nextReview = null; box = 5; }
      else { box = Math.min(5, currentBox + 2); nextReview = addDays(INTERVALS[box - 1]); }
    } else {
      if (currentBox >= 5){ learned = true; nextReview = null; box = 5; }
      else { box = currentBox + 1; nextReview = addDays(INTERVALS[box - 1]); }
    }

    return {
      ...word, box, nextReview, learned, updatedAt:Date.now(),
      reviewCount:Number(word.reviewCount || 0) + 1,
      correctCount:Number(word.correctCount || 0) + (rating === 'again' ? 0 : 1),
      wrongCount:Number(word.wrongCount || 0) + (rating === 'again' ? 1 : 0),
      lastReviewedDate:today, lastRating:rating, lastReviewMode:currentReviewMode
    };
  });

  if (rating === 'again') game.wrongReviews += 1;
  else game.correctReviews += 1;
  awardXp(ratingConfig.xp, ratingConfig.label, true);
  if ($('sessionXp')) $('sessionXp').textContent = sessionXp;
  reviewIndex += 1;
  persist();
  showReviewCard();
}

function renderWords(){
  const filterInput = $('filterWords');
  const host = $('wordsList');
  if (!host) return;
  const query = normalizeWord(filterInput?.value);
  host.innerHTML = '';
  const dueIds = new Set(dueWords().map(word => word.id));
  const filtered = words.filter(word => {
    const relationText = [...(word.synonyms || []), ...(word.antonyms || []), ...(word.family || []), ...(word.related || [])].join(' ');
    const queryOk = !query || normalizeWord(word.word).includes(query) || normalizeWord(word.enDefinition).includes(query) || String(word.faMeaning || '').includes(query) || normalizeWord(relationText).includes(query);
    const filterOk = currentLibraryFilter === 'all' || (currentLibraryFilter === 'due' && dueIds.has(word.id)) || (currentLibraryFilter === 'learning' && !word.learned) || (currentLibraryFilter === 'mastered' && word.learned);
    return queryOk && filterOk;
  });
  if (!filtered.length){
    host.innerHTML = '<p class="muted">No words match this view yet.</p>';
    return;
  }
  filtered.forEach(word => {
    const item = document.createElement('article');
    item.className = 'word-item';
    const relationPreview = unique([...(word.synonyms || []), ...(word.family || [])]).slice(0, 5);
    const contextPreview = word.contextSentence || word.example || '';
    const sourcePreview = [word.sourceType, word.sourceTitle].filter(Boolean).join(' · ');
    item.innerHTML = `<div class="word-top"><div><h3>${escapeHtml(word.word)}</h3><div class="phonetic">${escapeHtml(word.phonetic || '')}</div></div><span class="badge ${word.learned ? 'mastered' : ''}">${word.learned ? 'Mastered' : `Box ${word.box || 1}`}</span></div><p class="word-meaning persian-text" dir="rtl">${escapeHtml(word.faMeaning || '')}</p><p class="word-definition">${escapeHtml(word.enDefinition || '')}</p>${contextPreview ? `<div class="context-preview">“${escapeHtml(contextPreview)}”</div>` : ''}${sourcePreview ? `<div class="source-preview">${escapeHtml(sourcePreview)}</div>` : ''}${relationPreview.length ? `<div class="library-relations">${relationPreview.map(item => `<span>${escapeHtml(item)}</span>`).join('')}</div>` : ''}<div class="word-actions"><button type="button" class="secondary" data-action="study" data-id="${word.id}">Study now</button><button type="button" data-action="reset" data-id="${word.id}">Reset</button><button type="button" class="danger" data-action="delete" data-id="${word.id}">Delete</button></div>`;
    host.appendChild(item);
  });
}
on('filterWords', 'input', renderWords);
on('libraryFilters', 'click', event => {
  const button = event.target.closest('button');
  if (!button) return;
  currentLibraryFilter = button.dataset.filter;
  document.querySelectorAll('#libraryFilters button').forEach(item => item.classList.toggle('active', item === button));
  renderWords();
});
on('wordsList', 'click', event => {
  const button = event.target.closest('button');
  if (!button) return;
  const id = button.dataset.id;
  const word = words.find(item => item.id === id);
  if (!word) return;
  if (button.dataset.action === 'delete' && confirm(`Delete “${word.word}”?`)){
    words = words.filter(item => item.id !== id);
    persist();
    refreshAll();
    renderWords();
  }
  if (button.dataset.action === 'reset'){
    words = words.map(item => item.id === id ? {...item, box:1, nextReview:todayStart(), learned:false} : item);
    persist();
    refreshAll();
    renderWords();
    toast('Word returned to Box 1.');
  }
  if (button.dataset.action === 'study'){
    customReviewQueue = [word];
    switchView('reviewView');
  }
});

on('exportBtn', 'click', () => {
  const payload = {app:'VajehYar', version:APP_VERSION, exportedAt:new Date().toISOString(), words, game, searchHistory, practiceSessions};
  const blob = new Blob([JSON.stringify(payload, null, 2)], {type:'application/json'});
  const anchor = document.createElement('a');
  anchor.href = URL.createObjectURL(blob);
  anchor.download = `vajehyar-backup-${nowDateKey()}.json`;
  anchor.click();
  URL.revokeObjectURL(anchor.href);
});
on('importInput', 'change', async event => {
  const file = event.target.files[0];
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    const incoming = Array.isArray(data) ? data : data.words;
    if (!Array.isArray(incoming)) throw new Error('invalid');
    words = incoming;
    if (data.game) game = {...defaultGame(), ...data.game};
    if (Array.isArray(data.searchHistory)) searchHistory = data.searchHistory;
    if (Array.isArray(data.practiceSessions)) practiceSessions = data.practiceSessions;
    persist();
    refreshAll();
    toast('Backup restored successfully.');
  } catch { toast('This backup file is not valid.'); }
  event.target.value = '';
});
on('goalOptions', 'click', event => {
  const button = event.target.closest('button');
  if (!button) return;
  game.dailyGoal = Number(button.dataset.goal);
  persist();
  refreshStats();
  toast(`Daily goal set to ${game.dailyGoal} reviews.`);
});

window.addEventListener('beforeinstallprompt', event => {
  event.preventDefault();
  deferredPrompt = event;
  $('installBtn')?.classList.remove('hidden');
});
on('installBtn', 'click', async () => {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  await deferredPrompt.userChoice;
  deferredPrompt = null;
  $('installBtn')?.classList.add('hidden');
});

async function registerServiceWorker(){
  if (!('serviceWorker' in navigator)) return;
  try {
    const registration = await navigator.serviceWorker.register('./sw-v2.3.js?release=2.3.0', {updateViaCache:'none'});
    await registration.update();
  } catch (error) {
    console.warn('Service worker registration failed:', error);
  }
}
if (document.readyState === 'complete') registerServiceWorker();
else window.addEventListener('load', registerServiceWorker, {once:true});


function dateKeyFromTimestamp(timestamp){
  if (!timestamp) return '';
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
function todayActiveWords(){
  const today = nowDateKey();
  return words.filter(word => word.lastReviewedDate === today || dateKeyFromTimestamp(word.createdAt) === today).slice(0,6);
}
function refreshActivePracticeHome(){
  const selected = todayActiveWords();
  if ($('todayWordsCount')) $('todayWordsCount').textContent = selected.length;
  if ($('todayWordsPreview')){
    $('todayWordsPreview').innerHTML = selected.length
      ? selected.slice(0,5).map(word => `<span class="chip">${escapeHtml(word.word)}</span>`).join('')
      : '<span class="muted mini">Save or review words to unlock active practice.</span>';
  }
}
const PRACTICE_PROMPTS = [
  words => `Write a short personal story using ${words.slice(0,3).join(', ')}.`,
  words => `Describe a real or imaginary day and naturally include ${words.slice(0,3).join(', ')}.`,
  words => `Write a mini-dialogue that uses at least two of these words: ${words.join(', ')}.`,
  words => `Explain an idea, problem, or goal while using ${words.slice(0,4).join(', ')}.`,
  words => `Write 2–4 connected sentences and make the target words feel natural.`
];
function prepareActivePractice(){
  currentPracticeWords = todayActiveWords();
  const empty = $('practiceEmpty');
  const content = $('practiceContent');
  if (!empty || !content) return;
  if (!currentPracticeWords.length){
    empty.classList.remove('hidden');
    content.classList.add('hidden');
    return;
  }
  empty.classList.add('hidden');
  content.classList.remove('hidden');
  renderPracticeWords();
  setPracticePrompt();
  if ($('practiceText')) $('practiceText').value = '';
  updatePracticeUsage();
  renderPracticeHistory();
}
function setPracticePrompt(){
  if (!currentPracticeWords.length) return;
  const wordsList = currentPracticeWords.map(word => word.word);
  const template = PRACTICE_PROMPTS[Math.floor(Math.random() * PRACTICE_PROMPTS.length)];
  if ($('practicePrompt')) $('practicePrompt').textContent = template(wordsList);
}
function usedPracticeWords(text){
  const value = normalizeWord(text);
  return currentPracticeWords.filter(word => new RegExp(`\\b${escapeRegExp(normalizeWord(word.word))}\\b`, 'i').test(value));
}
function renderPracticeWords(){
  const host = $('practiceWordChips');
  if (!host) return;
  host.innerHTML = currentPracticeWords.map(word => `<span class="chip" data-word="${escapeHtml(normalizeWord(word.word))}">${escapeHtml(word.word)}</span>`).join('');
}
function updatePracticeUsage(){
  const text = $('practiceText')?.value || '';
  const used = usedPracticeWords(text);
  const usedSet = new Set(used.map(word => normalizeWord(word.word)));
  document.querySelectorAll('#practiceWordChips [data-word]').forEach(chip => chip.classList.toggle('used', usedSet.has(chip.dataset.word)));
  if ($('practiceUsageLabel')) $('practiceUsageLabel').textContent = `${used.length}/${currentPracticeWords.length} words used`;
  if ($('practiceMeter')) $('practiceMeter').style.width = `${Math.min(100, used.length / Math.max(2,currentPracticeWords.length) * 100)}%`;
  return used;
}
on('practiceText', 'input', updatePracticeUsage);
on('newPracticePromptBtn', 'click', setPracticePrompt);
on('savePracticeBtn', 'click', () => {
  const text = $('practiceText')?.value.trim() || '';
  const used = updatePracticeUsage();
  const minimum = Math.min(2, currentPracticeWords.length);
  if (text.length < 30){
    if ($('practiceFeedback')) {
      $('practiceFeedback').textContent = 'Write a little more — aim for at least 30 characters.';
      $('practiceFeedback').className = 'answer-feedback incorrect';
    }
    return;
  }
  if (used.length < minimum){
    if ($('practiceFeedback')) {
      $('practiceFeedback').textContent = `Use at least ${minimum} target word${minimum === 1 ? '' : 's'} before completing the practice.`;
      $('practiceFeedback').className = 'answer-feedback incorrect';
    }
    return;
  }
  const session = {
    id:crypto.randomUUID ? crypto.randomUUID() : `practice-${Date.now()}`,
    date:nowDateKey(), createdAt:Date.now(), text,
    wordIds:currentPracticeWords.map(word => word.id),
    usedWords:used.map(word => word.word),
    prompt:$('practicePrompt')?.textContent || ''
  };
  practiceSessions.unshift(session);
  practiceSessions = practiceSessions.slice(0,50);
  game.activePracticeCount = Number(game.activePracticeCount || 0) + 1;
  let rewarded = false;
  if (game.practiceBonusDate !== nowDateKey()){
    game.practiceBonusDate = nowDateKey();
    awardXp(20, 'Active practice complete');
    rewarded = true;
  } else {
    markActivity();
    persist();
    refreshAll();
  }
  if ($('practiceFeedback')){
    $('practiceFeedback').textContent = rewarded ? 'Practice saved. You earned +20 XP for active use today.' : 'Practice saved. Today’s active-practice XP was already collected.';
    $('practiceFeedback').className = 'answer-feedback correct';
  }
  renderPracticeHistory();
  confetti();
});
function renderPracticeHistory(){
  const host = $('practiceHistory');
  if (!host) return;
  const recent = practiceSessions.slice(0,5);
  if ($('practiceSessionCount')) $('practiceSessionCount').textContent = `${practiceSessions.length} saved`;
  host.innerHTML = recent.length ? recent.map(session => `
    <article class="practice-history-item">
      <div class="mini"><strong>${escapeHtml(session.date)}</strong><span>${(session.usedWords || []).map(escapeHtml).join(' · ')}</span></div>
      <p>${escapeHtml(session.text)}</p>
    </article>`).join('') : '<p class="muted">No active-practice writing saved yet.</p>';
}

function extractSharedWord(text){
  const matches = String(text || '').match(/[A-Za-z][A-Za-z'-]*/g) || [];
  if (!matches.length) return '';
  return matches[0].toLowerCase();
}
function handleIncomingShare(){
  const params = new URLSearchParams(location.search);
  if (!(params.has('share') || params.has('text') || params.has('title') || params.has('url') || params.has('word'))) return;
  const rawText = params.get('text') || params.get('word') || '';
  const sharedTitle = params.get('title') || '';
  const sharedUrl = params.get('url') || '';
  const candidate = params.get('word') || extractSharedWord(rawText || sharedTitle);
  const sentence = rawText && normalizeWord(rawText) !== normalizeWord(candidate) ? rawText : '';
  pendingSharedContext = {
    sentence,
    sourceTitle:sharedTitle,
    sourceUrl:sharedUrl,
    sourceType:sharedUrl ? 'Article / Website' : ''
  };
  if ($('shareCaptureCard')){
    $('shareCaptureCard').classList.remove('hidden');
    $('shareCaptureSummary').textContent = candidate
      ? `Ready to look up “${candidate}”${sentence ? ' with its shared context.' : '.'}`
      : 'Shared content received. Enter the word you want to save.';
  }
  switchView('searchView');
  if (candidate && $('wordInput')){
    $('wordInput').value = candidate;
    setTimeout(() => submitDictionaryWord(candidate), 120);
  }
  try { history.replaceState(null, '', `${location.pathname}#search`); } catch {}
}
on('dismissShareBtn', 'click', () => {
  $('shareCaptureCard')?.classList.add('hidden');
  pendingSharedContext = null;
});

function refreshAll(){ refreshStats(); renderWords(); renderSearchHistory(); }
resetDailyIfNeeded();
refreshAll();
handleIncomingShare();
