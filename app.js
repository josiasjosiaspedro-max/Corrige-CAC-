'use strict';
/* Corrige+ (CAC) v2.7 — importação apenas dos nomes da ata, QR+OMR, diário por trimestre e disciplina. */
const STORE_KEY='corrige-cac-demonstracao-v2';
const L=['A','B','C','D','E'];
const POINTS=[[30,28],[770,28],[770,805],[30,805]];
const MENU=[['home','Início','home'],['classes','Turmas','users'],['subjects','Disciplinas','file'],['exams','AV1 a AV5','file'],['scan','Leitor','scan'],['results','Diário','chart']];
const el=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function icon(type){const path={home:'<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/>',users:'<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',file:'<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 8h6M9 12h6M9 16h4"/>',scan:'<path d="M8 3H5a2 2 0 0 0-2 2v3M16 3h3a2 2 0 0 1 2 2v3M3 16v3a2 2 0 0 0 2 2h3M21 16v3a2 2 0 0 1-2 2h-3M4 12h16"/>',chart:'<path d="M4 20V10M10 20V4M16 20v-9M22 20v-6M2 20h20"/>',add:'<path d="M12 5v14M5 12h14"/>',print:'<path d="M6 9V3h12v6M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M6 15h12v6H6z"/>',camera:'<path d="M14 4h-4l-2 3H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-4z"/><circle cx="12" cy="14" r="4"/>',download:'<path d="M12 3v12m-5-5 5 5 5-5M4 17v4h16v-4"/>',trash:'<path d="M3 6h18M8 6V4h8v2m3 0-1 15H6L5 6M10 10v7m4-7v7"/>',check:'<path d="m4 12 5 5L20 6"/>',arrow:'<path d="M5 12h14m-6-6 6 6-6 6"/>'}[type]||'';return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`;}
const emptyDB=()=>({classes:[],students:[],exams:[],results:[],gradeEntries:[],subjects:[],classSubjects:[]});
let db=emptyDB();
let tab='home', creating=false, draft={name:'',classroomId:'',count:10,key:Array(10).fill(''),avSlot:1,maxScore:10};
let scanExamId='', cameraStream=null, scanCanvas=null,manualCorners=[],proposed=null,manualMode=false;
let mode='demo', client=null,user=null,authSignup=false,passwordReset=false,selectedClassId='',detailResultId='';
let stagedNames=[],rosterPhotoUrl='',rosterBusy=false;
let rosterColumnLeft=30,rosterColumnRight=88; // Fração horizontal escolhida para a coluna Nome; matrícula e assinaturas ficam fora.
function toast(msg){const t=el('toast');t.textContent=msg;t.classList.add('visible');clearTimeout(toast.timer);toast.timer=setTimeout(()=>t.classList.remove('visible'),4700);}
function uid(){if(globalThis.crypto?.randomUUID)return crypto.randomUUID();return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,c=>{const r=Math.random()*16|0;return(c==='x'?r:(r&3|8)).toString(16);});}
const fmt=x=>Number(x||0).toLocaleString('pt-BR',{minimumFractionDigits:1,maximumFractionDigits:2});
const grade=(hits,count,max)=>+((Number(hits)||0)/Math.max(1,Number(count)||1)*(Number(max)||10)).toFixed(2);
const numPT=s=>Number(String(s??'').trim().replace(',','.'));
const avOf=e=>{const v=Number(e?.avSlot);return Number.isInteger(v)&&v>=1&&v<=5?v:null;};
const errList=(answers,key)=>key.map((answer,i)=>({number:i+1,given:answers[i]||'',correct:answer})).filter(item=>item.given!==item.correct);
const latestResult=(examId,studentId)=>db.results.filter(r=>r.examId===examId&&r.studentId===studentId).sort((a,b)=>new Date(b.created)-new Date(a.created))[0]||null;
const today=s=>s?new Date(s).toLocaleDateString('pt-BR'):'—';
const btn=(action,label,cls='btn',extra='')=>`<button type="button" data-action="${action}" class="${cls}" ${extra}>${label}</button>`;
function useDemo(){mode='demo';db=emptyDB();try{const saved=JSON.parse(localStorage.getItem(STORE_KEY)||'{}');if(['classes','students','exams','results'].every(k=>Array.isArray(saved[k])))db=saved;}catch{}syncHeader();showShell();}
function persistDemo(){if(mode!=='demo')return;try{localStorage.setItem(STORE_KEY,JSON.stringify(db));}catch{toast('Armazenamento indisponível neste navegador.');}}
function configured(){const c=window.CORRIGE_CONFIG||{};return /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(c.SUPABASE_URL||'')&&!!(c.SUPABASE_PUBLISHABLE_KEY||'');}
function syncHeader(){el('storageStatus').textContent=mode==='cloud'?'Conta sincronizada':'Demonstração local';el('accountLabel').textContent=mode==='cloud'?(user?.email||'Professor'):'Modo demonstração';el('accountDetail').textContent=mode==='cloud'?'Cada professor acessa somente seus dados.':'Use dados fictícios. Nada é enviado ao servidor.';el('logoutButton').hidden=mode!=='cloud';el('demoExitButton').hidden=mode!=='demo'||!configured();}
function showShell(){el('authScreen').hidden=true;el('pendingScreen').hidden=true;el('appShell').hidden=false;el('bottomNav').hidden=false;render();}
function showAuth(){el('appShell').hidden=true;el('pendingScreen').hidden=true;el('bottomNav').hidden=true;el('authScreen').hidden=false;el('authEmail').closest('label').hidden=passwordReset;el('authEmail').required=!passwordReset;el('authTitle').innerHTML=passwordReset?'Definir nova senha':'Corrige<span>+</span> <small>(CAC)</small>';el('authSubmit').textContent=passwordReset?'Salvar nova senha':authSignup?'Criar minha conta':'Entrar';const signup=el('authScreen').querySelector('[data-action=toggleSignup]');signup.textContent=authSignup?'Já tenho conta — entrar':'Criar conta';signup.hidden=passwordReset||(!window.CORRIGE_CONFIG?.ALLOW_SIGNUP&&!authSignup);el('authPassword').autocomplete=authSignup?'new-password':'current-password';}
function showPending(){
  el('authScreen').hidden=true;el('appShell').hidden=true;el('bottomNav').hidden=true;
  el('pendingScreen').hidden=false;
  el('pendingEmail').textContent=user?.email||'Professor(a)';
  el('pendingId').textContent=user?.id||'—';
}
function isPendingApproval(error){return /ainda não foi autorizada/i.test(String(error?.message||''));}
async function enterWorkspace(){
  try{await loadCloud();syncHeader();showShell();return true;}
  catch(error){db=emptyDB();if(isPendingApproval(error)){showPending();return false;}
    showAuth();toast('Falha no acesso: '+(error.message||'verifique a conexão e as permissões.'));return false;}
}
async function initialize(){
  if(!configured()){useDemo();return;}
  mode='cloud';
  if(typeof window.supabase?.createClient!=='function'){
    showAuth();toast('Biblioteca de autenticação indisponível. Confira sua conexão.');return;
  }
  const cfg=window.CORRIGE_CONFIG;
  passwordReset=/type=(recovery|invite)/.test(location.hash);
  client=window.supabase.createClient(cfg.SUPABASE_URL.replace(/\/$/,''),cfg.SUPABASE_PUBLISHABLE_KEY,
    {auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
  client.auth.onAuthStateChange((event)=>{
    if(event==='PASSWORD_RECOVERY'){passwordReset=true;queueMicrotask(()=>showAuth());}
    if(event==='SIGNED_OUT')queueMicrotask(()=>{
      user=null;db=emptyDB();passwordReset=false;authSignup=false;
      stopCamera();showAuth();
    });
  });
  try{
    const {data,error}=await client.auth.getUser();
    if(error&&!/missing|auth session/i.test(error.message))console.info('Verificação de sessão:',error.message);
    if(data?.user){user=data.user;if(passwordReset)showAuth();else await enterWorkspace();}
    else showAuth();
  }catch(e){showAuth();toast('Não foi possível iniciar a conta: '+(e.message||'verifique sua conexão.'));}
}
async function handleAuth(event){
  event.preventDefault();if(!client){toast('Conecte o Supabase para ativar contas individuais.');return;}
  const email=el('authEmail').value.trim(),password=el('authPassword').value,submit=el('authSubmit');
  submit.disabled=true;
  try{
    if(passwordReset){
      const {error}=await client.auth.updateUser({password});if(error)throw error;
      passwordReset=false;
      const {data}=await client.auth.getUser();user=data?.user;
      if(user){const opened=await enterWorkspace();toast(opened?'Senha atualizada com sucesso.':'Senha atualizada. Aguarde a autorização da escola.');}
      else{showAuth();toast('Senha atualizada. Entre com sua conta.');}
      return;
    }
    if(authSignup){
      if(!window.CORRIGE_CONFIG.ALLOW_SIGNUP)throw new Error('Solicite o cadastro ao responsável pela escola.');
      const {data,error}=await client.auth.signUp({email,password,options:{emailRedirectTo:location.origin+location.pathname}});
      if(error)throw error;
      if(!data.session){
        authSignup=false;showAuth();
        toast('Cadastro solicitado. Verifique sua caixa de entrada e confirme o e-mail.');return;
      }
    }else{
      const {error}=await client.auth.signInWithPassword({email,password});if(error)throw error;
    }
    const {data,error}=await client.auth.getUser();
    if(error||!data?.user)throw error||new Error('Verificação de conta pendente.');
    user=data.user;
    const opened=await enterWorkspace();
    toast(opened?'Bem-vindo(a) ao Corrige+ (CAC)!':'Conta autenticada. Aguarde autorização da escola.');
  }catch(e){toast('Acesso não concluído: '+(e.message||'verifique suas credenciais.'));}
  finally{submit.disabled=false;}
}
async function retryAccess(){
  if(!client||!user)return showAuth();
  const opened=await enterWorkspace();
  toast(opened?'Acesso liberado!':'Acesso ainda pendente ou indisponível.');
}
async function copyTeacherId(){
  if(!user?.id)return;
  try{await navigator.clipboard.writeText(user.id);toast('Identificador copiado. Envie-o ao administrador da escola.');}
  catch{toast('Copie o identificador exibido na tela.');}
}
async function forgotPassword(){if(!client)return;const email=el('authEmail').value.trim();if(!email){toast('Digite seu e-mail acima para recuperar a senha.');return;}const {error}=await client.auth.resetPasswordForEmail(email,{redirectTo:location.origin+location.pathname});toast(error?'Não foi possível solicitar: '+error.message:'Se o e-mail estiver cadastrado, você receberá instruções para redefinir a senha.');}
async function logout(){stopCamera();if(client)await client.auth.signOut();user=null;db=emptyDB();showAuth();toast('Sessão encerrada.');}
async function loadCloud(){if(!client||!user)return;
 const {data:approval,error:approvalError}=await client.from('cac_authorized_teachers').select('teacher_id').eq('teacher_id',user.id).maybeSingle();
 if(approvalError)throw new Error('Banco de dados ainda não configurado para contas autorizadas: '+approvalError.message);
 if(!approval)throw new Error('Sua conta ainda não foi autorizada pela escola para utilizar o Corrige+ (CAC).');
 const tables=['cac_classrooms','cac_students','cac_exams','cac_results'];
 const res=await Promise.all(tables.map(t=>client.from(t).select('*').eq('teacher_id',user.id).order('created_at',{ascending:false}).limit(1000)));
 const fail=res.find(x=>x.error);if(fail){db=emptyDB();throw new Error('Não foi possível carregar os registros: '+fail.error.message);}
 db.classes=res[0].data.map(x=>({id:x.id,name:x.name,grade:x.grade,shift:x.shift,year:x.year,created:x.created_at}));
 db.students=res[1].data.map(x=>({id:x.id,classroomId:x.classroom_id,name:x.name,code:x.code||'',created:x.created_at}));
 db.exams=res[2].data.map(x=>({id:x.id,classroomId:x.classroom_id,subjectId:x.subject_id,name:x.name,group:x.group_name||'',count:x.question_count,key:x.answer_key,avSlot:x.av_slot,assessmentKind:x.assessment_kind,trimester:x.trimester,columnCode:x.assessment_kind==='AVALIACAO'?'AVALIACAO':'AT'+(x.av_slot||1),maxScore:Number(x.max_score??10),created:x.created_at}));
 db.results=res[3].data.map(x=>({id:x.id,examId:x.exam_id,studentId:x.student_id||'',student:x.student_name,studentCode:x.student_code||'',answers:x.answers,hits:x.hits,score:Number(x.score),count:x.question_count,created:x.created_at}));
}
async function cloudInsert(table,row){if(mode==='demo')return true;try{const {error}=await client.from(table).insert({...row,teacher_id:user.id});if(error)throw error;return true;}catch(e){toast('Não foi possível salvar no Supabase: '+e.message);return false;}}
async function cloudDelete(table,id){if(mode==='demo')return true;try{const {error}=await client.from(table).delete().eq('id',id).eq('teacher_id',user.id);if(error)throw error;return true;}catch(e){toast('Não foi possível excluir: '+e.message);return false;}}
async function cloudUpdate(table,id,fields){if(mode==='demo')return true;try{const {data,error}=await client.from(table).update(fields).eq('id',id).eq('teacher_id',user.id).select('id');if(error)throw error;if(!data?.length)throw new Error('Registro não encontrado ou acesso negado.');return true;}catch(e){toast('Não foi possível atualizar: '+e.message);return false;}}
async function cloudInsertStudents(rows){if(mode==='demo')return true;try{const {error}=await client.from('cac_students').insert(rows.map(row=>({...row,teacher_id:user.id})));if(error)throw error;return true;}catch(e){toast('Erro ao importar estudantes: '+e.message);return false;}}
function nav(){el('desktopNav').innerHTML=MENU.map(([id,label,ic])=>`<button data-action="nav" data-tab="${id}" class="nav-link ${tab===id?'active':''}">${icon(ic)}<span>${label}</span></button>`).join('');el('bottomNav').innerHTML=MENU.map(([id,label,ic])=>`<button data-action="nav" data-tab="${id}" class="${tab===id?'active':''}">${icon(ic)}<span>${label}</span></button>`).join('');}
function go(where){if(tab==='scan'&&where!=='scan')stopCamera();tab=where;creating=false;render();window.scrollTo({top:0,behavior:'instant'});}
function render(){nav();el('pageTitle').textContent=({home:'Visão geral',classes:'Turmas e ata',exams:'Avaliações · AV1 a AV5',scan:'Leitura de cartões',results:'Tabela de notas'})[tab];el('view').innerHTML=tab==='home'?renderHome():tab==='classes'?renderClasses():tab==='exams'?renderExams():tab==='scan'?renderScan():renderResults();}
function renderHome(){const mean=db.results.length?db.results.reduce((a,r)=>{const e=db.exams.find(e=>e.id===r.examId);return a+(r.score/Number(e?.maxScore||10))*100;},0)/db.results.length:0;
 return `<section class="hero"><div><span class="chip">✦ CARTÕES-RESPOSTA + QR CODE</span><h2>Fotografe a ata.<br>Corrija e registre as notas.</h2><p>Um fluxo simples: foto da lista, avaliações AV1 a AV5, leitura por câmera e tabela pronta.</p></div><span class="hero-icon">✓</span></section>
 ${mode==='demo'?'<div class="chip-demo">Modo demonstração: utilize somente nomes fictícios. Os registros ficam neste navegador, sem sincronização.</div>':''}
 <div class="stats stats-four"><article class="stat"><span class="stat-label">Turmas</span><div class="stat-value">${db.classes.length}</div><div class="stat-foot">cadastradas</div></article><article class="stat"><span class="stat-label">Estudantes</span><div class="stat-value">${db.students.length}</div><div class="stat-foot">registrados</div></article><article class="stat"><span class="stat-label">Correções</span><div class="stat-value">${db.results.length}</div><div class="stat-foot">realizadas</div></article><article class="stat"><span class="stat-label">Aproveitamento</span><div class="stat-value">${Math.round(mean)}%</div><div class="stat-foot">média das correções</div></article></div>
 <h2 class="section-title">O que deseja fazer?</h2><div class="two-col"><article class="card"><div class="card-head"><span class="pill pill-green">01 · TURMA</span>${icon('users')}</div><h3>Importar nomes pela ata</h3><p>Fotografe a ata e confira os nomes antes de gerar a tabela AV1 a AV5.</p>${btn('gotoClasses',`${icon('camera')} Fotografar ata`,'btn btn-primary')}</article><article class="card"><div class="card-head"><span class="pill">02 · AVALIAR</span>${icon('file')}</div><h3>Nova AV1–AV5</h3><p>Defina valor e gabarito, gere QR Codes e corrija pela câmera.</p>${btn('create',`${icon('add')} Criar avaliação`,'btn btn-dark')}</article></div><p class="copyright">Corrige+ (CAC) · EREM Cônego Alexandre Cavalcanti · Versão 2.4</p>`;
}
function empty(title,desc,action,label){return `<div class="empty"><div class="big">▤</div><h3>${title}</h3><p class="muted">${desc}</p>${btn(action,label,'btn btn-primary')}</div>`;}
function className(id){return db.classes.find(x=>x.id===id)?.name||'';}
function renderClasses(){const active=selectedClassId||db.classes[0]?.id||'';selectedClassId=active;
 const options=db.classes.map(c=>`<option value="${esc(c.id)}" ${active===c.id?'selected':''}>${esc(c.name)}</option>`).join('');
 const photo=rosterPhotoUrl?`<section class="roster-column-tool"><h4>Selecione somente a coluna Nome</h4><p class="muted-note">Mova os controles até a região transparente conter todos os nomes, sem matrícula nem assinaturas. Deslize a imagem para conferir as linhas inferiores.</p><div class="roster-crop-scroll"><div class="roster-crop-stage"><img id="rosterImage" src="${esc(rosterPhotoUrl)}" alt="Foto da ata para selecionar a coluna de nomes"><div class="roster-mask roster-mask-left" style="width:${rosterColumnLeft}%"></div><div class="roster-mask roster-mask-right" style="width:${100-rosterColumnRight}%"></div><div class="roster-selection" style="left:${rosterColumnLeft}%;right:${100-rosterColumnRight}%"></div></div></div><label class="field">Início da coluna Nome <input id="rosterCropLeft" type="range" min="0" max="80" step="1" value="${rosterColumnLeft}" aria-label="Limite esquerdo da coluna Nome"></label><label class="field">Fim da coluna Nome <input id="rosterCropRight" type="range" min="20" max="100" step="1" value="${rosterColumnRight}" aria-label="Limite direito da coluna Nome"></label><div class="actions">${btn('recognizeRoster',`${icon('scan')} Ler apenas os nomes`,'btn btn-primary',rosterBusy?'disabled':'')}${btn('resetRosterCrop','Ajustar seleção inicial','btn')}</div><p class="muted-note">Apenas a parte transparente será reconhecida. O aplicativo não utiliza os números de matrícula.</p></section>`:'';
 const staged=stagedNames.length?`<section class="ocr-review"><h4>Conferência dos nomes (${stagedNames.length})</h4><p class="muted">Verifique um nome por linha. Corrija ou exclua qualquer linha incorreta antes de salvar. Somente os nomes confirmados são armazenados.</p><textarea id="rosterNames" rows="9" spellcheck="false" aria-label="Nomes extraídos da ata, um por linha">${esc(stagedNames.join('\n'))}</textarea><div class="actions">${btn('confirmRoster',`${icon('check')} Confirmar e gerar tabela`,'btn btn-primary')}${btn('clearRoster','Descartar','btn')}</div></section>`:'';
 return `<div class="toolbar"><p class="muted">Cadastre a turma e use a câmera para reconhecer os nomes da ata.</p></div>
 <div class="roster-grid"><article class="card stack"><h3>Cadastrar turma</h3><form id="classForm" class="stack"><label class="field">Nome da turma<input name="name" required maxlength="60" placeholder="Ex.: 3º Ano A"></label><div class="form-grid"><label class="field">Série<input name="grade" maxlength="40" placeholder="Ex.: 3º EM"></label><label class="field">Turno<select name="shift"><option>Integral</option><option>Manhã</option><option>Tarde</option><option>Noite</option></select></label></div><label class="field">Ano letivo<input name="year" type="number" min="2020" max="2100" value="${new Date().getFullYear()}"></label><button class="btn btn-primary" type="submit">${icon('add')} Salvar turma</button></form><div class="divider"></div><h3>Turmas cadastradas</h3>${db.classes.length?db.classes.map(c=>`<div class="exam-row"><div><strong>${esc(c.name)}</strong><p>${esc(c.grade||'')} · ${c.year||''} · ${db.students.filter(s=>s.classroomId===c.id).length} alunos</p></div><div class="actions">${btn('pickClass','Abrir','btn btn-sm',`data-id="${esc(c.id)}"`)}${btn('deleteClass',icon('trash'),'btn btn-danger btn-sm',`data-id="${esc(c.id)}"`)}</div></div>`).join(''):'<p class="muted">Nenhuma turma cadastrada.</p>'}</article>
 <article class="card stack"><h3>Importar nomes pela foto da ata</h3>${db.classes.length?`<label class="field">Escolha a turma<select id="rosterClass">${options}</select></label><div class="actions"><label class="btn btn-primary upload-label">${icon('camera')} Tirar foto da ata<input id="rosterPhotoCamera" type="file" accept="image/*" capture="environment" aria-label="Fotografar ata"></label><label class="btn upload-label">Escolher foto<input id="rosterPhotoGallery" type="file" accept="image/*" aria-label="Selecionar foto da galeria"></label></div><p class="muted-note">Selecione apenas a coluna dos nomes. Matrículas e assinaturas serão ignoradas. O reconhecimento acontece no aparelho; a imagem não é enviada nem armazenada no Supabase. A primeira leitura exige internet para carregar a ferramenta.</p>${photo}${rosterBusy?'<div class="notice">Reconhecendo os nomes… não feche esta tela.</div>':''}${staged}<details class="fallback"><summary>Adicionar nome manualmente (alternativa)</summary><form id="studentForm" class="stack" style="margin-top:12px"><label class="field">Nome<input name="name" maxlength="100" required></label><label class="field">Número (opcional)<input name="code" maxlength="50"></label><button class="btn" type="submit">Adicionar estudante</button></form></details><label class="field">Ou importar lista CSV<input id="studentCsv" type="file" accept=".csv,text/csv,text/plain"></label>`:'<p class="muted">Crie uma turma antes de fotografar a ata.</p>'}</article></div>
 ${db.classes.length?`<section class="card grade-roster"><div class="card-head"><div><h3>Quadro de notas</h3><p class="muted">A tabela nasce com os nomes da ata e 5 colunas de avaliação.</p></div><span class="pill pill-green">AV1 · AV2 · AV3 · AV4 · AV5</span></div>${gradeTableForClass(active,true)}</section>`:''}`;
}

function extractRosterLines(text){
 // A imagem passa por um recorte da coluna Nome antes do OCR.
 // Esta segunda filtragem impede números, cabeçalhos e ruído de virarem alunos.
 const banned=/\b(ATA|ESCOLA|TURMA|ALUNOS?|ESTUDANTES?|DISCIPLINA|PROFESSOR(?:A)?|ASSINATURAS?|DIRETORIA|MATR[IÍ]CULA|REGISTRO|N[ÚU]MERO|FREQU[EÊ]NCIA|DATA|ANO\s+LETIVO|P[ÁA]GINA|ENSINO|LISTA|SIMULADO|CAED|RESPONS[ÁA]VEL|UNIDADE|TOTAL|BEZERROS|RECIFE|NOME|S[ÉE]RIE|TURNO)\b/i;
 const unique=new Set(),names=[];
 for(const raw of String(text||'').normalize('NFKC').split(/\r?\n/)){
  let line=raw.replace(/[|¦©®~_=+*#<>\[\]{}]/g,' ').trim();
  line=line.replace(/^\s*(?:\d{1,9}\s+|\d{1,3}[.):-]\s*)/,'')
    .replace(/\s*\d{4,}\s*$/,'')
    .replace(/[^A-Za-zÀ-ÿ .'-]/g,' ')
    .replace(/\s+/g,' ').trim().replace(/^[.\- ]+|[.\- ]+$/g,'');
  if(line.length<7||line.length>100||banned.test(line))continue;
  const parts=line.split(/\s+/);
  if(parts.length<2||parts.length>9||parts.filter(p=>/[A-Za-zÀ-ÿ]{2,}/.test(p)).length<2)continue;
  // Distingue nomes longos de assinaturas isoladas e conteúdo de interface.
  if(/^(?:COPIAR|BAIXAR|SELECIONAR|EXPORTAR|EDITAR|COMPARTILHAR|ABRIR|ARQUIVO|DOCUMENTO|PREENCHER)\b/i.test(line))continue;
  const key=line.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleUpperCase('pt-BR');
  if(!unique.has(key)){unique.add(key);names.push(line);}
 }
 return names.slice(0,200);
}
function clearRoster(){stagedNames=[];if(rosterPhotoUrl){URL.revokeObjectURL(rosterPhotoUrl);rosterPhotoUrl='';}rosterColumnLeft=30;rosterColumnRight=88;render();}
function adjustRosterCrop(){
 const left=el('rosterCropLeft'),right=el('rosterCropRight');if(!left||!right)return;
 let l=Number(left.value),r=Number(right.value);
 if(l>r-12){if(document.activeElement===left)l=r-12;else r=l+12;}
 rosterColumnLeft=Math.max(0,l);rosterColumnRight=Math.min(100,r);
 left.value=rosterColumnLeft;right.value=rosterColumnRight;
 const stage=el('view');const a=stage.querySelector('.roster-mask-left'),b=stage.querySelector('.roster-mask-right'),c=stage.querySelector('.roster-selection');
 if(a)a.style.width=rosterColumnLeft+'%';if(b)b.style.width=(100-rosterColumnRight)+'%';
 if(c){c.style.left=rosterColumnLeft+'%';c.style.right=(100-rosterColumnRight)+'%';}
}
async function readRosterPhoto(file){
 if(!file||!selectedClassId)return toast('Selecione uma turma antes de fotografar a ata.');
 if(!/^image\//.test(file.type))return toast('Selecione uma fotografia válida.');
 if(file.size>15*1024*1024)return toast('Foto muito grande. Escolha uma imagem com até 15 MB.');
 if(rosterBusy)return;
 if(rosterPhotoUrl)URL.revokeObjectURL(rosterPhotoUrl);
 rosterPhotoUrl=URL.createObjectURL(file);stagedNames=[];rosterColumnLeft=30;rosterColumnRight=88;
 render();toast('Ajuste a região destacada para conter somente os nomes e toque em “Ler apenas os nomes”.');
}
async function recognizeRoster(){
 if(rosterBusy||!rosterPhotoUrl)return;
 rosterBusy=true;stagedNames=[];render();let worker;
 try{
  if(!window.Tesseract){await new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';script.onload=resolve;script.onerror=()=>reject(Error('Não foi possível carregar o reconhecimento de texto. Confira a internet.'));document.head.appendChild(script);});}
  const img=new Image();await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=()=>reject(Error('Foto inválida.'));img.src=rosterPhotoUrl;});
  const sx=Math.round(img.naturalWidth*rosterColumnLeft/100),sw=Math.round(img.naturalWidth*(rosterColumnRight-rosterColumnLeft)/100);
  if(sw<=0)throw Error('Ajuste a largura da seleção.');
  const scale=Math.min(2.5,3400/img.naturalHeight,2400/sw);
  const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(sw*scale));canvas.height=Math.max(1,Math.round(img.naturalHeight*scale));
  const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.fillStyle='white';ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.filter='grayscale(1) contrast(1.45)';ctx.drawImage(img,sx,0,sw,img.naturalHeight,0,0,canvas.width,canvas.height);ctx.filter='none';
  worker=await Tesseract.createWorker('por');
  await worker.setParameters({tessedit_pageseg_mode:'6',preserve_interword_spaces:'1'});
  const result=await worker.recognize(canvas);
  stagedNames=extractRosterLines(result.data?.text||'');
  toast(stagedNames.length?`${stagedNames.length} possíveis nomes identificados. Revise antes de salvar.`:'Nenhum nome identificado. Ajuste a coluna ou digite os nomes na conferência.');
  if(!stagedNames.length)stagedNames=[''];
 }catch(error){stagedNames=[''];toast('Leitura não concluída: '+(error.message||'confira a imagem e a conexão.'));}
 finally{if(worker)try{await worker.terminate();}catch{}rosterBusy=false;render();}
}
async function confirmRoster(){
 if(!selectedClassId)return toast('Escolha a turma.');
 const lines=(el('rosterNames')?.value||'').split(/\r?\n/).map(s=>s.trim().replace(/\s+/g,' ')).filter(Boolean);
 if(!lines.length||lines.length>200)return toast('Informe entre 1 e 200 nomes, um por linha.');
 const seen=new Set(),newNames=[];
 for(const name of lines){if(name.length<3||name.length>100)return toast('Revise os nomes: cada um deve ter entre 3 e 100 caracteres.');
 const norm=name.toLocaleLowerCase('pt-BR');if(seen.has(norm))continue;seen.add(norm);
 if(!db.students.some(s=>s.classroomId===selectedClassId&&s.name.toLocaleLowerCase('pt-BR')===norm))newNames.push(name);}
 if(!newNames.length)return toast('Os nomes já constam nesta turma.');
 const at=new Date().toISOString();const newStudents=newNames.map(name=>({id:uid(),classroomId:selectedClassId,name,code:'',created:at}));
 const rows=newStudents.map(s=>({id:s.id,classroom_id:s.classroomId,name:s.name,code:s.code}));
 if(!await cloudInsertStudents(rows))return;
 db.students.push(...newStudents);persistDemo();clearRoster();toast(`${newNames.length} estudantes cadastrados. Tabela AV1 a AV5 gerada!`);
}
function gradeTableForClass(classroomId,editable=false){
 const students=db.students.filter(s=>s.classroomId===classroomId).sort((a,b)=>a.name.localeCompare(b.name,'pt-BR'));
 const slots=Array.from({length:5},(_,i)=>db.exams.find(e=>e.classroomId===classroomId&&avOf(e)===i+1));
 if(!students.length)return '<div class="notice">Nenhum estudante cadastrado. Fotografe a ata para gerar a tabela de notas.</div>';
 return `<p class="tiny scroll-hint">Deslize a tabela para o lado para consultar AV1, AV2, AV3, AV4 e AV5.</p><div class="table-scroller"><table class="data-table grade-table"><thead><tr><th>Estudante</th>${slots.map((e,i)=>`<th>AV${i+1}<small>${e?`até ${fmt(e.maxScore||10)}`:'—'}</small></th>`).join('')}${editable?'<th></th>':''}</tr></thead><tbody>${students.map(s=>`<tr><td><strong>${esc(s.name)}</strong>${s.code?`<div class="tiny">${esc(s.code)}</div>`:''}</td>${slots.map(e=>{const r=e?latestResult(e.id,s.id):null;return `<td>${r?btn('showResult',fmt(r.score),'grade-link',`data-id="${esc(r.id)}" title="Ver questões erradas"`):'<span class="grade-pending">—</span>'}</td>`;}).join('')}${editable?`<td>${btn('deleteStudent',icon('trash'),'btn btn-danger btn-sm',`data-id="${esc(s.id)}" aria-label="Excluir estudante"`)}</td>`:''}</tr>`).join('')}</tbody></table></div>`;
}
function detailPanel(){const r=db.results.find(r=>r.id===detailResultId);if(!r)return '';const e=db.exams.find(e=>e.id===r.examId);if(!e)return '';
 const wrong=errList(r.answers,e.key);
 return `<article class="card result-detail"><div class="card-head"><h3>Resultado individual · ${esc(r.student)}</h3>${btn('closeResult','Fechar','btn btn-sm')}</div><p class="muted">${esc(e.group)} · AV${avOf(e)||'?'} · ${esc(e.name)} · Valor da prova: ${fmt(e.maxScore||10)}</p><div class="result-summary"><div><strong>${fmt(r.score)}</strong><span>Nota</span></div><div><strong>${r.hits}/${r.count}</strong><span>Acertos</span></div><div><strong>${wrong.length}</strong><span>Erros / brancos</span></div></div><div class="divider"></div><h4>Questões erradas</h4>${wrong.length?`<div class="table-scroller"><table class="data-table"><thead><tr><th>Questão</th><th>Marcada</th><th>Correta</th></tr></thead><tbody>${wrong.map(x=>`<tr><td>Q${x.number}</td><td class="incorrect">${esc(x.given||'Em branco / dúvida')}</td><td>${esc(x.correct)}</td></tr>`).join('')}</tbody></table></div>`:'<p class="notice green">O estudante acertou todas as questões.</p>'}</article>`;
}

async function addClass(form){const data=new FormData(form),name=String(data.get('name')||'').trim();if(!name)return;const c={id:uid(),name,grade:String(data.get('grade')||'').trim(),shift:String(data.get('shift')||''),year:Number(data.get('year')||new Date().getFullYear()),created:new Date().toISOString()};if(!await cloudInsert('cac_classrooms',{id:c.id,name:c.name,grade:c.grade,shift:c.shift,year:c.year}))return;db.classes.unshift(c);selectedClassId=c.id;persistDemo();render();toast('Turma cadastrada.');}
async function addStudent(name,code,classroomId){name=name.trim();if(!name||!classroomId)return false;const s={id:uid(),classroomId,name,code:code.trim(),created:new Date().toISOString()};if(!await cloudInsert('cac_students',{id:s.id,classroom_id:classroomId,name,code:s.code}))return false;db.students.push(s);persistDemo();return true;}
async function saveStudent(form){const data=new FormData(form);if(await addStudent(String(data.get('name')||''),String(data.get('code')||''),selectedClassId)){render();toast('Estudante cadastrado.');}}
async function importStudents(file){if(!file||!selectedClassId)return;const content=await file.text();const lines=content.replace(/^\ufeff/,'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean);if(lines.length>201){toast('Limite de 200 estudantes por arquivo.');return;}let added=0;
 for(const [i,line] of lines.entries()){const sep=line.includes(';')?';':',';const cells=line.split(sep).map(x=>x.trim().replace(/^"|"$/g,''));if(i===0&&/^(nome|aluno|estudante)$/i.test(cells[0]))continue;if(cells[0]&&!db.students.some(s=>s.classroomId===selectedClassId&&s.name.toLowerCase()===cells[0].toLowerCase())){if(await addStudent(cells[0],cells[1]||'',selectedClassId))added++;}}
 render();toast(`${added} estudantes importados do CSV.`);}
async function deleteClass(id){const c=db.classes.find(x=>x.id===id);if(!c)return;if(db.students.some(x=>x.classroomId===id)||db.exams.some(x=>x.classroomId===id)){toast('Para excluir a turma, remova antes os estudantes e avaliações vinculados.');return;}if(!confirm('Excluir a turma '+c.name+'?'))return;if(!await cloudDelete('cac_classrooms',id))return;db.classes=db.classes.filter(x=>x.id!==id);selectedClassId=db.classes[0]?.id||'';persistDemo();render();}
async function deleteStudent(id){const s=db.students.find(x=>x.id===id);if(!s||!confirm('Excluir '+s.name+' do cadastro?'))return; // registros anteriores devem manter o nome, mas a referência do estudante será removida no SQL
 if(!await cloudDelete('cac_students',id))return;db.students=db.students.filter(x=>x.id!==id);db.results.forEach(r=>{if(r.studentId===id)r.studentId='';});persistDemo();render();}
function createForm(){const cls=selectedClassId||db.classes[0]?.id||'',open=Array.from({length:5},(_,i)=>i+1).find(slot=>!db.exams.some(e=>e.classroomId===cls&&avOf(e)===slot));if(!cls)return toast('Cadastre uma turma antes de criar a avaliação.');if(!open)return toast('Esta turma já possui AV1 a AV5.');creating=true;draft={name:'',classroomId:cls,count:10,key:Array(10).fill(''),avSlot:open,maxScore:10};tab='exams';render();}
function renderCreate(){const choices=db.classes.map(c=>`<option value="${esc(c.id)}" ${draft.classroomId===c.id?'selected':''}>${esc(c.name)}</option>`).join('');
 const items=draft.key.map((letter,i)=>`<div class="key-row"><span class="key-number">${String(i+1).padStart(2,'0')}</span>${L.map(l=>`<button type="button" data-action="setKey" data-index="${i}" data-letter="${l}" class="letter-btn ${letter===l?'selected':''}">${l}</button>`).join('')}</div>`).join('');
 const occupied=new Set(db.exams.filter(e=>e.classroomId===draft.classroomId).map(e=>avOf(e)).filter(Boolean));
 const slotChoices=Array.from({length:5},(_,i)=>i+1).map(n=>`<option value="${n}" ${draft.avSlot===n?'selected':''} ${occupied.has(n)?'disabled':''}>AV${n}${occupied.has(n)?' (já cadastrada)':''}</option>`).join('');
 return `<div class="toolbar"><h2 class="section-title">Nova avaliação</h2>${btn('cancelCreate','Voltar')}</div><article class="card stack"><div class="form-grid"><label class="field">Turma<select id="examClass">${choices}</select></label><label class="field">Avaliação<select id="examSlot">${slotChoices}</select></label><label class="field">Nome / assunto<input id="examName" maxlength="100" placeholder="Ex.: Função afim" value="${esc(draft.name)}"></label><label class="field">Quantidade de questões<select id="examCount">${[5,10,15,20,30].map(n=>`<option value="${n}" ${draft.count===n?'selected':''}>${n} questões</option>`).join('')}</select></label><label class="field">Valor máximo da prova (pontos)<input type="number" id="examMaxScore" min="0.01" max="100" step="0.01" inputmode="decimal" value="${esc(draft.maxScore)}"></label></div><div class="notice green">Exemplo: 16 acertos em 20 questões, com prova valendo 8 pontos, resulta em nota 6,40.</div><div class="divider"></div><h3>Gabarito oficial</h3><p class="muted">Informe a alternativa correta de cada questão.</p><div class="answer-key">${items}</div><div class="actions">${btn('saveExam',`${icon('check')} Salvar avaliação`,'btn btn-primary')}${btn('cancelCreate','Cancelar')}</div></article>`;
}
function renderExams(){if(creating)return renderCreate();return `<div class="toolbar"><p class="muted">Até cinco avaliações por turma, cada uma com pontuação definida pelo professor.</p>${btn('create',`${icon('add')} Nova avaliação`,'btn btn-primary')}</div>${db.exams.length?`<section class="exam-list">${db.exams.slice().sort((a,b)=>(avOf(a)||99)-(avOf(b)||99)).map(e=>{const num=db.students.filter(s=>s.classroomId===e.classroomId).length;return `<article class="exam-row"><div><span class="pill pill-green">${avOf(e)?'AV'+avOf(e):'Legada'} · ${e.count} questões</span><h3>${esc(e.name)}</h3><p>${esc(e.group||'Sem turma')} · Valor ${fmt(e.maxScore||10)} pontos · ${num} estudante(s)</p></div><div class="actions">${btn('print',`${icon('print')} Em branco`,'btn btn-sm',`data-id="${esc(e.id)}"`)}${num?btn('printAll','Cartões da turma','btn btn-sm',`data-id="${esc(e.id)}"`):''}${btn('pickScan',`${icon('scan')} Corrigir`,'btn btn-primary btn-sm',`data-id="${esc(e.id)}"`)}${btn('deleteExam',icon('trash'),'btn btn-danger btn-sm',`data-id="${esc(e.id)}" aria-label="Excluir avaliação"`)}</div></article>`;}).join('')}</section>`:empty('Nenhuma avaliação','Cadastre a AV1 para imprimir os cartões e corrigir.','create','Criar AV1')}`;
}
async function saveExam(){draft.name=el('examName')?.value.trim()||draft.name;draft.classroomId=el('examClass')?.value||draft.classroomId;draft.avSlot=Number(el('examSlot')?.value||draft.avSlot);draft.maxScore=numPT(el('examMaxScore')?.value??draft.maxScore);
 if(!draft.classroomId||!db.classes.some(c=>c.id===draft.classroomId))return toast('Selecione uma turma válida.');
 if(!draft.name)return toast('Informe o assunto da avaliação.');
 if(!Number.isInteger(draft.avSlot)||draft.avSlot<1||draft.avSlot>5)return toast('Selecione AV1 a AV5.');
 if(db.exams.some(e=>e.classroomId===draft.classroomId&&avOf(e)===draft.avSlot))return toast(`AV${draft.avSlot} já foi cadastrada nessa turma.`);
 if(!Number.isFinite(draft.maxScore)||draft.maxScore<=0||draft.maxScore>100)return toast('Valor da avaliação deve estar entre 0,01 e 100.');
 if(draft.key.some(v=>!v))return toast('Marque a resposta correta de todas as questões.');
 const e={id:uid(),name:draft.name,classroomId:draft.classroomId,subjectId:draft.c26SubjectId,group:className(draft.classroomId),count:draft.count,key:[...draft.key],avSlot:draft.avSlot,maxScore:draft.maxScore,created:new Date().toISOString()};
 if(!await cloudInsert('cac_exams',{id:e.id,classroom_id:e.classroomId,name:e.name,group_name:e.group,question_count:e.count,answer_key:e.key,av_slot:e.avSlot,max_score:e.maxScore}))return;
 db.exams.unshift(e);persistDemo();creating=false;render();toast(`AV${e.avSlot} salva. Valor máximo: ${fmt(e.maxScore)} pontos.`);
}
async function deleteExam(id){const e=db.exams.find(x=>x.id===id);if(!e)return;if(db.results.some(r=>r.examId===id)){toast('Esta avaliação possui correções. Exclua-as antes de remover a avaliação.');return;}if(!confirm('Excluir a avaliação '+e.name+'?'))return;if(!await cloudDelete('cac_exams',id))return;db.exams=db.exams.filter(x=>x.id!==id);persistDemo();render();}
function bubbleSVG(exam){const n=exam.count,rows=Math.ceil(n/(n>15?2:1)),out=[];for(const [x,y] of POINTS)out.push(`<rect x="${x-16}" y="${y-16}" width="32" height="32" fill="#000"/>`);out.push('<text x="400" y="75" text-anchor="middle" font-size="19" fill="#222" font-weight="600">PREENCHA UMA ALTERNATIVA POR QUESTÃO</text>');
 for(let q=0;q<n;q++){const col=Math.floor(q/rows),row=q%rows,y=118+row*45,base=col?555:175,labelX=col?463:82;out.push(`<text x="${labelX}" y="${y+7}" font-size="23" font-weight="700" fill="#111">${String(q+1).padStart(2,'0')}.</text>`);for(let j=0;j<5;j++){const cx=base+j*37;out.push(`<circle cx="${cx}" cy="${y}" r="12" stroke="#000" stroke-width="2.6" fill="#fff"/>`);out.push(`<text x="${cx}" y="${y+26}" text-anchor="middle" font-size="13" font-weight="600" fill="#444">${L[j]}</text>`);}}
 return `<svg class="paper-svg" xmlns="http://www.w3.org/2000/svg" width="184mm" height="191.82mm" viewBox="0 0 800 834" role="img" aria-label="Cartão com ${n} questões">${out.join('')}</svg>`;}
function printExam(id, all=false){const e=db.exams.find(x=>x.id===id);if(!e)return;const students=all?db.students.filter(s=>s.classroomId===e.classroomId).sort((a,b)=>a.name.localeCompare(b.name,'pt-BR')):[null];if(!students.length)return toast('Não existem estudantes cadastrados nesta turma.');if(students.length>100)return toast('Imprima no máximo 100 cartões de cada vez.');
 el('printRoot').innerHTML=students.map((s,i)=>`<section class="print-sheet"><div class="print-head"><div><h1>Corrige+ (CAC) · ${esc(e.name)}</h1><p><strong>Turma:</strong> ${esc(e.group||'________________')}</p><p><strong>Avaliação:</strong> ${esc(e.id)}</p><p><strong>EREM Cônego Alexandre Cavalcanti</strong></p></div><div class="print-qr"><div id="qr-${i}"></div>Identificação</div></div><div class="print-fields"><span>Estudante: ${s?esc(s.name):'________________________________'}</span><span>Nº: ${s?esc(s.code||'___'):'______'}</span></div>${bubbleSVG(e)}<div class="print-foot">Preencha as bolhas totalmente com caneta preta ou azul-escura. Preserve os quatro quadrados de referência.</div></section>`).join('');
 students.forEach((s,i)=>{const element=el('qr-'+i);const raw=`CAC2|${e.id}|${s?.id||''}`;if(typeof QRCode==='function'){try{new QRCode(element,{text:raw,width:103,height:103,correctLevel:QRCode.CorrectLevel.M});}catch(err){element.textContent=e.id;}}else element.textContent=e.id;});
 setTimeout(()=>window.print(),350);}
function renderScan(){const options=db.exams.map(e=>`<option value="${esc(e.id)}" ${e.id===scanExamId?'selected':''}>${avOf(e)?`AV${avOf(e)} · `:''}${esc(e.group)} · ${esc(e.name)}</option>`).join('');return `<section class="stack"><div class="card"><div class="form-grid"><label class="field">Avaliação<select id="scanExam"><option value="">Selecione a avaliação</option>${options}</select></label><div class="field"><span>QR Code</span><div class="notice">O QR Code identifica a avaliação e o estudante. Confira a associação antes de registrar.</div></div></div></div><div class="scan-layout"><div><div id="cameraStage" class="camera-box"><div class="camera-placeholder"><div class="big">▣</div><strong>Leitura do cartão-resposta</strong><p>Enquadre os quatro marcadores pretos e o QR Code.</p></div></div><div class="scan-tools"><div class="actions">${btn('startCamera',`${icon('camera')} Ligar câmera`,'btn btn-primary')}${btn('capture',`${icon('scan')} Capturar e ler`,'btn btn-dark','id="captureBtn" disabled')}<label class="btn upload-label">Usar foto<input id="photoInput" type="file" accept="image/*" capture="environment" aria-label="Fotografia do cartão-resposta"></label></div><p class="tiny">O cartão é processado neste aparelho. Apenas as respostas e notas confirmadas são salvas.</p></div><div id="manualBox"></div></div><aside class="card"><h3>Leitura em cinco passos</h3><ol class="numbered"><li>Prepare uma avaliação AV1 a AV5.</li><li>Imprima os cartões individuais com QR Code.</li><li>O estudante marca uma alternativa por questão.</li><li>Fotografe o cartão e confira as marcações reconhecidas.</li><li>Confirme para salvar a nota na tabela da turma.</li></ol><div class="notice warn">A leitura óptica é experimental. Antes de registrar notas oficiais, confira o QR Code, o nome e cada alternativa.</div></aside></div><div id="scanStatus"></div><div id="reviewCard"></div></section>`;}
function stopCamera(){if(cameraStream){cameraStream.getTracks().forEach(t=>t.stop());cameraStream=null;}}
async function startCamera(){if(!db.exams.length)return toast('Cadastre uma avaliação antes de corrigir.');stopCamera();const host=el('cameraStage');if(!host)return;host.innerHTML='<video id="camVideo" autoplay playsinline muted></video><div class="camera-overlay"></div>';
 try{if(!navigator.mediaDevices?.getUserMedia)throw new Error('Câmera disponível somente por HTTPS ou localhost.');cameraStream=await navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:{ideal:'environment'},width:{ideal:1920},height:{ideal:1080}}});const v=el('camVideo');if(!v){stopCamera();return;}v.srcObject=cameraStream;await v.play();el('captureBtn').disabled=false;toast('Câmera ligada. Enquadre o cartão.');}catch(e){host.innerHTML=`<div class="camera-placeholder"><p>Não foi possível abrir a câmera.</p><p>${esc(e.message)}</p></div>`;toast('Confira a permissão da câmera ou use uma foto.');}}
function capture(){const v=el('camVideo');if(!v?.videoWidth)return toast('Ligue a câmera primeiro.');const c=document.createElement('canvas');c.width=v.videoWidth;c.height=v.videoHeight;c.getContext('2d',{willReadFrequently:true}).drawImage(v,0,0);stopCamera();el('captureBtn').disabled=true;handleImage(c);}
async function fromPhoto(file){if(!file)return;const url=URL.createObjectURL(file),img=new Image();img.onload=()=>{const c=document.createElement('canvas'),factor=Math.min(1,2400/Math.max(img.naturalWidth,img.naturalHeight));c.width=Math.round(img.naturalWidth*factor);c.height=Math.round(img.naturalHeight*factor);c.getContext('2d',{willReadFrequently:true}).drawImage(img,0,0,c.width,c.height);URL.revokeObjectURL(url);stopCamera();handleImage(c);};img.onerror=()=>{URL.revokeObjectURL(url);toast('Não foi possível ler a foto.');};img.src=url;}
function handleImage(c){scanCanvas=c;manualMode=false;manualCorners=[];proposed=null;el('cameraStage').innerHTML='<div class="capture-preview"><canvas id="snapshotPreview" aria-label="Fotografia do gabarito; toque nos quatro cantos se necessário"></canvas></div>';const preview=el('snapshotPreview');preview.width=c.width;preview.height=c.height;preview.getContext('2d').drawImage(c,0,0);preview.addEventListener('click',onManualPoint);el('manualBox').innerHTML=`<div class="actions">${btn('detect','Tentar leitura automática','btn btn-primary')}${btn('manual','Marcar cantos manualmente','btn btn-ghost')}${btn('rescan','Nova captura','btn')}</div><p id="cornerCount" class="corner-count"></p>`;el('reviewCard').innerHTML='';tryRead();}
function detectQR(c){if(typeof jsQR!=='function')return null;try{const scale=Math.min(1,1400/Math.max(c.width,c.height)),t=document.createElement('canvas');t.width=Math.floor(c.width*scale);t.height=Math.floor(c.height*scale);const ctx=t.getContext('2d',{willReadFrequently:true});ctx.drawImage(c,0,0,t.width,t.height);const data=ctx.getImageData(0,0,t.width,t.height);return jsQR(data.data,t.width,t.height,{inversionAttempts:'attemptBoth'})?.data||null;}catch{return null;}}
function tryRead(forceCorners){if(!scanCanvas)return;let e=db.exams.find(x=>x.id===scanExamId),s=null;const code=detectQR(scanCanvas);
 if(code?.startsWith('CAC2|')){const parts=code.split('|'),match=db.exams.find(x=>x.id===parts[1]);if(match){e=match;scanExamId=e.id;const selector=el('scanExam');if(selector)selector.value=e.id;s=db.students.find(x=>x.id===parts[2]&&x.classroomId===e.classroomId)||null;}}
 if(!e){el('scanStatus').innerHTML='<div class="notice warn" style="margin-top:16px">Selecione a avaliação ou fotografe um cartão com QR Code legível.</div>';return;}
 const corners=forceCorners||findMarkers(scanCanvas);if(!corners){el('scanStatus').innerHTML='<div class="notice warn" style="margin-top:16px">Não consegui localizar os quatro quadrados. Escolha “Marcar cantos manualmente” e toque nos centros em ordem: superior esquerdo, superior direito, inferior direito, inferior esquerdo.</div>';return;}
 const h=homography(POINTS,corners);if(!h)return toast('Alinhamento incorreto; ajuste os cantos.');const read=readBubbles(scanCanvas,e,h);proposed={exam:e,studentId:s?.id||'',answers:read.answers,confidence:read.confidence,corners};manualMode=false;showCornerPreview(corners);el('scanStatus').innerHTML=`<div class="notice ${read.answers.some(Boolean)?'green':'warn'}" style="margin:16px 0">${read.answers.filter(Boolean).length} de ${e.count} respostas reconhecidas. ${s?'Aluno identificado pelo QR Code. ':''}Confira todas as respostas antes de salvar.</div>`;showReview();}
function showCornerPreview(corners){const p=el('snapshotPreview');if(!p||!scanCanvas)return;const ctx=p.getContext('2d');ctx.drawImage(scanCanvas,0,0);const r=Math.max(5,p.width/120);ctx.lineWidth=Math.max(2,p.width/550);ctx.strokeStyle='#0eca87';ctx.fillStyle='#0eca87';ctx.beginPath();corners.forEach(([x,y],i)=>{if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);});ctx.closePath();ctx.stroke();corners.forEach(([x,y],i)=>{ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();ctx.font=`bold ${Math.max(17,p.width/60)}px sans-serif`;ctx.fillText(String(i+1),x+r+4,y-5);});}
function onManualPoint(event){if(!manualMode)return;const c=event.currentTarget,rect=c.getBoundingClientRect(),x=(event.clientX-rect.left)*c.width/rect.width,y=(event.clientY-rect.top)*c.height/rect.height;manualCorners.push([x,y]);const order=['superior esquerdo','superior direito','inferior direito','inferior esquerdo'];if(manualCorners.length===4){manualMode=false;tryRead([...manualCorners]);el('cornerCount').textContent='Quatro pontos selecionados.';}else{showCornerPreview(manualCorners);el('cornerCount').textContent=`Marcado ${manualCorners.length}/4. Agora toque no quadrado ${order[manualCorners.length]}.`;}}
function manual(){if(!scanCanvas)return toast('Capture uma imagem primeiro.');manualMode=true;manualCorners=[];el('snapshotPreview').getContext('2d').drawImage(scanCanvas,0,0);el('cornerCount').textContent='1/4 — Toque no quadrado superior esquerdo.';toast('Selecione os quatro quadrados no sentido horário.');}
function showReview(){if(!proposed)return;const e=proposed.exam,answers=proposed.answers,correct=answers.filter((x,i)=>x===e.key[i]).length,students=db.students.filter(x=>x.classroomId===e.classroomId).sort((a,b)=>a.name.localeCompare(b.name,'pt-BR'));
 const options=students.map(s=>`<option value="${esc(s.id)}" ${s.id===proposed.studentId?'selected':''}>${esc(s.name)}${s.code?' · '+esc(s.code):''}</option>`).join('');
 const rows=answers.map((a,i)=>`<tr><td>${String(i+1).padStart(2,'0')}</td><td><select data-review="${i}" aria-label="Alternativa lida da questão ${i+1}"><option value="">Em branco / dúvida</option>${L.map(l=>`<option value="${l}" ${a===l?'selected':''}>${l}</option>`).join('')}</select></td><td>${e.key[i]}</td><td class="${!a?'ambiguous':a===e.key[i]?'correct':'incorrect'}">${!a?'Verificar':a===e.key[i]?'Correta':'Incorreta'}</td></tr>`).join('');
 el('reviewCard').innerHTML=`<article class="card" style="margin-top:17px"><div class="card-head"><h3>Confira antes de salvar</h3><span class="pill">AV${avOf(e)||'?'} · ${fmt(e.maxScore||10)} pts</span></div><p class="muted">Marcas fracas e questões duplas exigem conferência. Confira também o estudante identificado pelo QR Code.</p><div class="result-summary"><div><strong id="reviewHits">${correct}</strong><span>Acertos</span></div><div><strong id="reviewGrade">${fmt(grade(correct,e.count,e.maxScore))}</strong><span>Nota</span></div><div><strong id="reviewDoubts">${answers.filter(x=>!x).length}</strong><span>Sem leitura</span></div></div><div class="divider"></div><label class="field">Estudante da turma (obrigatório)<select id="resultStudent"><option value="">Selecione / confirme o estudante</option>${options}</select></label><p class="tiny">${proposed.studentId?'Estudante identificado pelo QR Code. Confira o nome acima.':'QR Code não identificado ou sem aluno válido. Selecione manualmente o estudante correto.'}</p><div class="divider"></div><div class="table-scroller"><table class="review-grid"><thead><tr><th>Questão</th><th>Marcada</th><th>Correta</th><th>Situação</th></tr></thead><tbody>${rows}</tbody></table></div><div class="notice warn review-note">Questões em branco contam como não corretas. Se houver erro de leitura, altere a alternativa antes de salvar.</div><div class="actions" style="margin-top:20px">${btn('saveResult',`${icon('check')} Confirmar e salvar na AV${avOf(e)||''}`,'btn btn-primary')}${btn('manual','Ajustar cantos','btn')}</div></article>`;
}
function reviewUpdate(index,value){if(!proposed)return;proposed.answers[index]=value;const e=proposed.exam,hits=proposed.answers.filter((v,i)=>v===e.key[i]).length;el('reviewHits').textContent=hits;el('reviewGrade').textContent=fmt(grade(hits,e.count,e.maxScore));el('reviewDoubts').textContent=proposed.answers.filter(x=>!x).length;const cell=el('reviewCard').querySelectorAll('tbody tr')[index]?.lastElementChild;if(cell){cell.className=!value?'ambiguous':value===e.key[index]?'correct':'incorrect';cell.textContent=!value?'Verificar':value===e.key[index]?'Correta':'Incorreta';}}
async function saveResult(){if(!proposed)return;
 const e=proposed.exam,ans=[...proposed.answers],sid=el('resultStudent')?.value||'',student=db.students.find(s=>s.id===sid&&s.classroomId===e.classroomId);
 if(!student)return toast('Confirme o estudante da turma antes de salvar.');
 if(!avOf(e))return toast('Esta avaliação não tem número AV válido. Cadastre AV1 a AV5.');
 const hits=ans.filter((v,i)=>v===e.key[i]).length,score=grade(hits,e.count,e.maxScore),prior=latestResult(e.id,sid),when=new Date().toISOString();
 if(prior&&!confirm(`Já existe nota de ${student.name} na AV${avOf(e)}: ${fmt(prior.score)}. Deseja substituí-la por ${fmt(score)}?`))return;
 const fields={student_id:sid,student_name:student.name,student_code:student.code||'',answers:ans,hits,score,question_count:e.count};
 if(prior){if(!await cloudUpdate('cac_results',prior.id,fields))return;Object.assign(prior,{studentId:sid,student:student.name,studentCode:student.code||'',answers:ans,hits,score,count:e.count,created:when});}
 else{const r={id:uid(),examId:e.id,studentId:sid,student:student.name,studentCode:student.code||'',answers:ans,hits,score,count:e.count,created:when};if(!await cloudInsert('cac_results',{id:r.id,exam_id:r.examId,...fields}))return;db.results.unshift(r);}
 persistDemo();proposed=null;scanCanvas=null;manualCorners=[];tab='results';selectedClassId=e.classroomId;detailResultId=prior?.id||db.results.find(r=>r.examId===e.id&&r.studentId===sid)?.id||'';render();toast(`${student.name} · AV${avOf(e)} · nota ${fmt(score)} / ${fmt(e.maxScore)} salva!`);
}
function renderResults(){const active=selectedClassId||db.classes[0]?.id||'';selectedClassId=active;
 if(!db.classes.length)return empty('Nenhuma turma','Cadastre uma turma e importe os nomes da ata para começar.','gotoClasses','Cadastrar turma');
 const options=db.classes.map(c=>`<option value="${esc(c.id)}" ${active===c.id?'selected':''}>${esc(c.name)}</option>`).join('');
 const exams=db.exams.filter(e=>e.classroomId===active).sort((a,b)=>(avOf(a)||99)-(avOf(b)||99));
 return `<div class="toolbar"><label class="field">Turma<select id="gradesClass">${options}</select></label><div class="actions">${btn('exportGrades',`${icon('download')} Exportar tabela CSV`,'btn btn-primary')}</div></div><div class="notice">Notas proporcionais ao valor de cada prova. Toque em uma nota para ver as questões erradas do estudante.</div><section class="card grade-roster"><div class="card-head"><h3>Notas por estudante</h3><span class="pill pill-green">AV1 a AV5</span></div>${gradeTableForClass(active)}</section>${detailPanel()}<section class="card"><h3>Valores das avaliações</h3><div class="av-list">${exams.length?exams.map(e=>`<span class="pill">AV${avOf(e)||'?'} · ${esc(e.name)} · ${fmt(e.maxScore)} pontos</span>`).join(''):'<p class="muted">Ainda não existem avaliações nesta turma.</p>'}</div></section>`;
}
function exportCSV(){const cls=selectedClassId||db.classes[0]?.id;if(!cls)return toast('Escolha uma turma.');
 const students=db.students.filter(s=>s.classroomId===cls).sort((a,b)=>a.name.localeCompare(b.name,'pt-BR'));
 if(!students.length)return toast('Esta turma não possui estudantes.');
 const exams=Array.from({length:5},(_,i)=>db.exams.find(e=>e.classroomId===cls&&avOf(e)===i+1));
 const headers=['Estudante','Número',...Array.from({length:5},(_,i)=>`AV${i+1}`)];
 const rows=students.map(s=>[s.name,s.code||'',...exams.map(e=>{const r=e?latestResult(e.id,s.id):null;return r?Number(r.score).toFixed(2).replace('.',','):'';})]);
 const safe=v=>{let t=String(v??'');if(/^[\s]*[=+@\-]/.test(t))t="'"+t;return '"'+t.replaceAll('"','""')+'"';};
 const content='\ufeff'+[headers,...rows].map(row=>row.map(safe).join(';')).join('\r\n');
 const url=URL.createObjectURL(new Blob([content],{type:'text/csv;charset=utf-8;'}));const a=document.createElement('a');a.href=url;a.download=`Corrige_CAC_Notas_${(className(cls)||'Turma').replace(/[^A-Za-z0-9À-ÿ_-]+/g,'_')}.csv`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1800);toast('Tabela de AV1 a AV5 exportada.');
}
async function deleteResult(id){if(!confirm('Excluir definitivamente esta correção?'))return;if(!await cloudDelete('cac_results',id))return;db.results=db.results.filter(x=>x.id!==id);persistDemo();render();}

// Algoritmo OMR do protótipo inicial: detecção dos quatro marcadores e leitura das bolhas.
function grayAt(data,w,h,x,y){const xx=Math.round(x),yy=Math.round(y);if(xx<0||yy<0||xx>=w||yy>=h)return 255;const i=(yy*w+xx)*4;return .299*data[i]+.587*data[i+1]+.114*data[i+2];}
// Busca quadrados preenchidos na imagem, sem enviar a foto para a internet.
function findMarkers(canvas){const max=1150,scale=Math.min(1,max/Math.max(canvas.width,canvas.height));const c=document.createElement('canvas');c.width=Math.max(1,Math.round(canvas.width*scale));c.height=Math.max(1,Math.round(canvas.height*scale));let ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(canvas,0,0,c.width,c.height);const {data}=ctx.getImageData(0,0,c.width,c.height),w=c.width,h=c.height,N=w*h;
const dark=new Uint8Array(N),seen=new Uint8Array(N);for(let i=0,j=0;i<N;i++,j+=4){dark[i]=(.299*data[j]+.587*data[j+1]+.114*data[j+2])<100?1:0;}
const queue=new Int32Array(N),candidates=[];const minSide=Math.max(8,Math.floor(Math.min(w,h)*.013)),maxSide=Math.max(50,Math.floor(Math.min(w,h)*.12));
for(let start=0;start<N;start++){if(!dark[start]||seen[start])continue;let head=0,tail=1;queue[0]=start;seen[start]=1;let minX=start%w,maxX=minX,minY=Math.floor(start/w),maxY=minY,area=0;
while(head<tail){const idx=queue[head++],x=idx%w,y=(idx-x)/w;area++;if(x<minX)minX=x;if(x>maxX)maxX=x;if(y<minY)minY=y;if(y>maxY)maxY=y;
const near=[x>0?idx-1:-1,x<w-1?idx+1:-1,y>0?idx-w:-1,y<h-1?idx+w:-1];for(const n of near){if(n>=0&&dark[n]&&!seen[n]){seen[n]=1;queue[tail++]=n;}}}
const bw=maxX-minX+1,bh=maxY-minY+1,ratio=bw/bh,fill=area/(bw*bh);if(bw>=minSide&&bh>=minSide&&bw<=maxSide&&bh<=maxSide&&ratio>.68&&ratio<1.46&&fill>.64&&area>minSide*minSide*.6)candidates.push({x:(minX+maxX)/2/scale,y:(minY+maxY)/2/scale,w:bw/scale,h:bh/scale,area:area/scale/scale});}
if(candidates.length<4)return null;candidates.sort((a,b)=>b.area-a.area);const cs=candidates.slice(0,45),W=canvas.width,H=canvas.height,dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);let best=null,bestScore=-Infinity;
for(const tl of cs)for(const tr of cs){if(tr===tl)continue;const dx=tr.x-tl.x,dy=tr.y-tl.y;if(dx<Math.min(W,H)*.34||Math.abs(dy)>dx*.46)continue;
for(const bl of cs){if(bl===tl||bl===tr)continue;const dy2=bl.y-tl.y,dx2=bl.x-tl.x;if(dy2<Math.min(W,H)*.34||Math.abs(dx2)>dy2*.46)continue;
const p={x:tr.x+bl.x-tl.x,y:tr.y+bl.y-tl.y},top=dist(tl,tr),left=dist(tl,bl);const aspect=top/left;if(aspect<.53||aspect>1.64)continue;
for(const br of cs){if(br===tl||br===tr||br===bl)continue;const error=dist(br,p)/Math.max(top,left),a=[tl,tr,br,bl].map(x=>Math.sqrt(x.area)),sizeSpread=Math.max(...a)/Math.min(...a);if(error>.28||sizeSpread>2.5)continue;const score=2*(top*left)/(W*H)-2.1*error-0.34*Math.abs(Math.log(aspect/.952))-0.28*Math.log(sizeSpread)+.00001*(tl.area+tr.area+bl.area+br.area);if(score>bestScore){bestScore=score;best=[[tl.x,tl.y],[tr.x,tr.y],[br.x,br.y],[bl.x,bl.y]];}}}}
return best;}
function homography(from,to){const A=[],b=[];for(let i=0;i<4;i++){const [x,y]=from[i],[X,Y]=to[i];A.push([x,y,1,0,0,0,-x*X,-y*X]);b.push(X);A.push([0,0,0,x,y,1,-x*Y,-y*Y]);b.push(Y);}for(let j=0;j<8;j++){let pivot=j;for(let i=j+1;i<8;i++)if(Math.abs(A[i][j])>Math.abs(A[pivot][j]))pivot=i;if(Math.abs(A[pivot][j])<1e-10)return null;[A[pivot],A[j]]=[A[j],A[pivot]];[b[pivot],b[j]]=[b[j],b[pivot]];const z=A[j][j];for(let k=j;k<8;k++)A[j][k]/=z;b[j]/=z;for(let i=0;i<8;i++){if(i===j)continue;const f=A[i][j];for(let k=j;k<8;k++)A[i][k]-=f*A[j][k];b[i]-=f*b[j];}}return [...b,1];}
function mapPoint(H,x,y){const d=H[6]*x+H[7]*y+1;return [(H[0]*x+H[1]*y+H[2])/d,(H[3]*x+H[4]*y+H[5])/d];}
function readBubbles(c,e,H){const {data}=c.getContext('2d',{willReadFrequently:true}).getImageData(0,0,c.width,c.height),w=c.width,h=c.height,n=e.count,rows=Math.ceil(n/(n>15?2:1)),answers=[],confidence=[];
for(let q=0;q<n;q++){const col=Math.floor(q/rows),row=q%rows,y=118+row*45,base=col?555:175,levels=[];
for(let j=0;j<5;j++){const cx=base+j*37;let ink=0,count=0;for(let dy=-7;dy<=7;dy+=1.8)for(let dx=-7;dx<=7;dx+=1.8){if(dx*dx+dy*dy>47)continue;const [px,py]=mapPoint(H,cx+dx,y+dy);count++;if(grayAt(data,w,h,px,py)<155)ink++;}levels.push(ink/count);}
const sorted=levels.map((v,i)=>({v,i})).sort((a,b)=>b.v-a.v);const first=sorted[0],second=sorted[1];let letter=(first.v>=.19&&first.v-second.v>=.085&&second.v<.24)?L[first.i]:'';answers.push(letter);confidence.push(levels);}
return {answers,confidence};}

// Os botões da interface usam delegação de eventos, inclusive após re-renderizações.
document.addEventListener('click',async event=>{const node=event.target.closest('[data-action]');if(!node)return;const action=node.dataset.action,id=node.dataset.id;
 switch(action){
  case 'nav':go(node.dataset.tab);break;
  case 'create':createForm();break;
  case 'cancelCreate':creating=false;render();break;
  case 'setKey':draft.name=el('examName')?.value||draft.name;draft.classroomId=el('examClass')?.value||draft.classroomId;draft.avSlot=Number(el('examSlot')?.value||draft.avSlot);draft.maxScore=numPT(el('examMaxScore')?.value??draft.maxScore);draft.key[Number(node.dataset.index)]=node.dataset.letter;render();break;
  case 'saveExam':await saveExam();break;
  case 'print':printExam(id);break;
  case 'printAll':printExam(id,true);break;
  case 'pickScan':scanExamId=id;go('scan');break;
  case 'openScan':go('scan');break;
  case 'deleteExam':await deleteExam(id);break;
  case 'deleteClass':await deleteClass(id);break;
  case 'deleteStudent':await deleteStudent(id);break;
  case 'pickClass':selectedClassId=id;render();break;
  case 'startCamera':await startCamera();break;
  case 'capture':capture();break;
  case 'detect':tryRead();break;
  case 'manual':manual();break;
  case 'rescan':stopCamera();scanCanvas=null;proposed=null;render();break;
  case 'saveResult':await saveResult();break;
  case 'deleteResult':await deleteResult(id);break;
  case 'export':exportCSV();break;
  case 'exportGrades':exportCSV();break;
  case 'gotoClasses':go('classes');break;
  case 'clearRoster':clearRoster();break;
  case 'recognizeRoster':await recognizeRoster();break;
  case 'resetRosterCrop':rosterColumnLeft=30;rosterColumnRight=88;render();break;
  case 'confirmRoster':await confirmRoster();break;
  case 'showResult':detailResultId=id;render();break;
  case 'closeResult':detailResultId='';render();break;
  case 'toggleSignup':authSignup=!authSignup;showAuth();break;
  case 'demoMode':useDemo();toast('Demonstração: use somente dados fictícios.');break;
  case 'backToLogin':mode='cloud';db=emptyDB();showAuth();break;
  case 'forgotPassword':await forgotPassword();break;
  case 'retryAccess':await retryAccess();break;
  case 'copyTeacherId':await copyTeacherId();break;
  case 'logout':await logout();break;
 }
});
document.addEventListener('submit',async event=>{if(!['authForm','classForm','studentForm'].includes(event.target.id))return;event.preventDefault();if(event.target.id==='authForm')await handleAuth(event);if(event.target.id==='classForm')await addClass(event.target);if(event.target.id==='studentForm')await saveStudent(event.target);});
document.addEventListener('change',async event=>{const x=event.target;
 if(x.id==='examCount'){draft.name=el('examName').value;draft.classroomId=el('examClass').value;draft.avSlot=Number(el('examSlot').value);draft.maxScore=numPT(el('examMaxScore').value);const n=+x.value;draft.key=[...draft.key.slice(0,n),...Array(Math.max(0,n-draft.key.length)).fill('')];draft.count=n;render();}
 else if(x.id==='examClass'){draft.name=el('examName')?.value||draft.name;draft.maxScore=numPT(el('examMaxScore')?.value??draft.maxScore);draft.classroomId=x.value;const free=Array.from({length:5},(_,i)=>i+1).find(slot=>!db.exams.some(e=>e.classroomId===x.value&&avOf(e)===slot));draft.avSlot=free||1;render();}
 else if(x.id==='examSlot')draft.avSlot=Number(x.value);
 else if(x.id==='examMaxScore')draft.maxScore=numPT(x.value);
 else if(x.id==='rosterClass'){selectedClassId=x.value;clearRoster();}
 else if(x.id==='gradesClass'){selectedClassId=x.value;detailResultId='';render();}
 else if(x.id==='rosterPhotoCamera'||x.id==='rosterPhotoGallery')await readRosterPhoto(x.files?.[0]);
 else if(x.id==='scanExam')scanExamId=x.value;
 else if(x.id==='photoInput')await fromPhoto(x.files?.[0]);
 else if(x.id==='studentCsv')await importStudents(x.files?.[0]);
 
 else if(x.dataset.review!==undefined)reviewUpdate(Number(x.dataset.review),x.value);
});
if('serviceWorker' in navigator&&location.protocol==='https:')navigator.serviceWorker.register('./service-worker.js').catch(()=>{});
/* Corrige+ (CAC) v2.5 — extensão compatível com os recursos da v2.4. */
const C25=['AT1','AT2','AT3','AT4','AT5','AVALIACAO'];
const name25=k=>k==='AVALIACAO'?'Avaliação':k;
const trimester25=e=>Number(e?.trimester||1);
const code25=e=>e?.columnCode||(e?.assessmentKind==='AVALIACAO'?'AVALIACAO':`AT${e?.avSlot||1}`);
const findExam25=(classroom,trimester,code,subject=selectedSubjectId)=>db.exams.find(e=>e.classroomId===classroom&&e.subjectId===subject&&trimester25(e)===Number(trimester)&&code25(e)===code);
const findGrade25=(student,trimester,code,subject=selectedSubjectId)=>(db.gradeEntries||[]).find(g=>g.studentId===student&&g.subjectId===subject&&Number(g.trimester)===Number(trimester)&&g.columnCode===code);
let trimester25Selected=1, grade25Editing=null;
const period25=t=>`${t}º trimestre`;
const trimesterTabs25=()=>`<div class="trimester-tabs" role="group" aria-label="Trimestre letivo">${[1,2,3].map(t=>btn('v25Trim',period25(t),`trimester-tab ${trimester25Selected===t?'active':''}`,`data-trimester="${t}" aria-pressed="${trimester25Selected===t}"`)).join('')}</div>`;

const oldLoadCloud25=loadCloud;
loadCloud=async function(){await oldLoadCloud25();const {data,error}=await client.from('cac_grade_entries').select('*').eq('teacher_id',user.id).order('created_at',{ascending:false}).limit(1000);if(error)throw new Error('Notas manuais: '+error.message);db.gradeEntries=(data||[]).map(x=>({id:x.id,studentId:x.student_id,classroomId:x.classroom_id,trimester:Number(x.trimester),columnCode:x.column_code,subjectId:x.subject_id,status:x.status,score:x.score==null?null:Number(x.score),created:x.created_at}));};
const oldDemo25=useDemo;
useDemo=function(){oldDemo25();if(!Array.isArray(db.gradeEntries))db.gradeEntries=[];render();};
const oldRender25=render;
render=function(){oldRender25();if(tab==='exams')el('pageTitle').textContent='Atividades por trimestre';if(tab==='results')el('pageTitle').textContent='Notas por trimestre';};
const oldNav25=nav;
nav=function(){oldNav25();document.querySelectorAll('[data-action="nav"][data-tab="exams"] span').forEach(x=>x.textContent='Atividades');};
const oldHome25=renderHome;
renderHome=function(){return oldHome25().replaceAll('AV1 a AV5','AT1 a AT5').replaceAll('AV1–AV5','AT1–AT5 + Avaliação').replace('Nova AT1–AT5 + Avaliação','Nova atividade').replace('Versão 2.4','Versão 2.5').replace('Tabela AV1 a AV5','Tabela trimestral');};
const oldClasses25=renderClasses;
renderClasses=function(){return oldClasses25().replace('A tabela nasce com os nomes da ata e 5 colunas de avaliação.','A tabela é organizada em três trimestres, cada um com AT1 a AT5 e Avaliação.').replace('AV1 · AV2 · AV3 · AV4 · AV5','AT1–AT5 + Avaliação');};
const oldConfirm25=confirmRoster;
confirmRoster=async function(){await oldConfirm25();};

function state25(student,t,k){const e=findExam25(student.classroomId,t,k),scanned=e?latestResult(e.id,student.id):null,man=findGrade25(student.id,t,k);
 if(man)return {e,scanned,manual:man,status:man.status,score:man.score,source:'manual'};
 if(scanned)return {e,scanned,manual:null,status:'GRADE',score:scanned.score,source:'scan'};
 return {e,scanned,manual:null,status:'EMPTY',score:null,source:'empty'};}
function gradeCell25(student,t,k){const d=state25(student,t,k),editing=grade25Editing?.studentId===student.id&&grade25Editing?.trimester===t&&grade25Editing?.code===k;
 if(editing){const current=d.status==='GRADE'?String(d.score).replace('.',','):'';
 return `<form id="grade25Form" class="grade-inline-editor" data-student="${esc(student.id)}" data-trimester="${t}" data-column="${k}"><input name="score" type="text" inputmode="decimal" autocomplete="off" aria-label="Nota de ${esc(student.name)} em ${name25(k)}" value="${esc(current)}" placeholder="Nota"><div class="grade-inline-actions"><button type="submit" title="Salvar nota">✓</button>${btn('v25NC','NC','edit-nc',`data-student="${esc(student.id)}" data-trimester="${t}" data-column="${k}"`)}${btn('v25Clear','Limpar','edit-clear',`data-student="${esc(student.id)}" data-trimester="${t}" data-column="${k}"`)}${btn('v25Cancel','×','edit-clear','aria-label="Cancelar edição"')}</div></form>`;}
 const txt=d.status==='GRADE'?fmt(d.score):d.status==='NC'?'NC':'—',color=d.status==='NC'?'grade-nc':d.source==='manual'?'grade-manual':d.source==='scan'?'grade-scan':'grade-empty';
 return `<div class="grade-actions">${btn('v25Edit',esc(txt),`grade-cell ${color}`,`data-student="${esc(student.id)}" data-trimester="${t}" data-column="${k}" aria-label="Editar ${name25(k)} de ${esc(student.name)}: ${txt}"`)}${d.scanned?btn('showResult','↗','grade-detail',`data-id="${esc(d.scanned.id)}" title="Ver questões erradas na correção original" aria-label="Ver correção original de ${esc(student.name)}"`):''}</div>`;}
gradeTableForClass=function(cls,editable=false){const students=db.students.filter(s=>s.classroomId===cls).sort((a,b)=>a.name.localeCompare(b.name,'pt-BR'));
 if(!students.length)return '<div class="notice">Nenhum estudante cadastrado. Fotografe a ata para gerar a tabela de notas.</div>';
 return `${trimesterTabs25()}<p class="tiny scroll-hint">${period25(trimester25Selected)} · Toque em uma nota ou traço para inserir, editar ou marcar NC. O botão ↗ mostra os erros da correção pela câmera.</p><div class="table-scroller"><table class="data-table grade-table"><thead><tr><th>Estudante</th>${C25.map(k=>{const ex=findExam25(cls,trimester25Selected,k);return `<th>${name25(k)}<small>${ex?`até ${fmt(ex.maxScore)}`:'manual'}</small></th>`;}).join('')}${editable?'<th></th>':''}</tr></thead><tbody>${students.map(s=>`<tr><td><strong>${esc(s.name)}</strong>${s.code?`<div class="tiny">${esc(s.code)}</div>`:''}</td>${C25.map(k=>`<td>${gradeCell25(s,trimester25Selected,k)}</td>`).join('')}${editable?`<td>${btn('deleteStudent',icon('trash'),'btn btn-danger btn-sm',`data-id="${esc(s.id)}" aria-label="Excluir estudante"`)}</td>`:''}</tr>`).join('')}</tbody></table></div><p class="tiny grade-legend">NC = não realizou (marcado pelo professor). — = ainda sem lançamento. Azul = nota manual/editada; verde = nota da leitura automática. A correção original permanece disponível.</p>`;};
async function setGrade25(studentId,t,k,status,raw){const student=db.students.find(x=>x.id===studentId);if(!student||!C25.includes(k)||![1,2,3].includes(t)||!assigned26(student.classroomId,selectedSubjectId))return toast('Estudante, trimestre ou disciplina inválidos.');
 const e=findExam25(student.classroomId,t,k),limit=Number(e?.maxScore??10);let score=null;
 if(status==='GRADE'){const entered=String(raw??'').trim();if(!entered)return toast('Digite a nota ou marque NC.');score=numPT(entered);if(!Number.isFinite(score)||score<0||score>limit)return toast(`Nota inválida. Use valor entre 0 e ${fmt(limit)}.${e?'':' Para configurar outro valor máximo, cadastre a atividade.'}`);score=Math.round(score*100)/100;}
 const old=findGrade25(studentId,t,k),fields={student_id:studentId,classroom_id:student.classroomId,subject_id:selectedSubjectId,trimester:t,column_code:k,status,score};if(old){if(!await cloudUpdate('cac_grade_entries',old.id,fields))return;Object.assign(old,{status,score});}
 else{const row={id:uid(),studentId,classroomId:student.classroomId,subjectId:selectedSubjectId,trimester:t,columnCode:k,status,score,created:new Date().toISOString()};if(!await cloudInsert('cac_grade_entries',{id:row.id,...fields}))return;(db.gradeEntries||=([])).push(row);}
 grade25Editing=null;persistDemo();render();toast(status==='NC'?`${student.name}: NC em ${name25(k)} registrado.`:`Nota ${fmt(score)} salva em ${name25(k)} (${period25(t)}).`);}
async function clearGrade25(id,t,k){const prior=findGrade25(id,t,k);if(prior){if(!await cloudDelete('cac_grade_entries',prior.id))return;db.gradeEntries=db.gradeEntries.filter(x=>x.id!==prior.id);}grade25Editing=null;persistDemo();render();toast('Lançamento manual removido; a correção original, se existir, permanece.');}

const oldCreate25=createForm;
createForm=function(){const cls=selectedClassId||db.classes[0]?.id||'';if(!cls)return toast('Cadastre uma turma antes de criar uma atividade.'); if(!assigned26(cls,selectedSubjectId))selectedSubjectId=subjectForClass26(cls);if(!selectedSubjectId)return toast('Cadastre uma disciplina e vincule-a à turma.');const free=C25.find(k=>!findExam25(cls,trimester25Selected,k,selectedSubjectId));if(!free)return toast(`Todas as seis colunas do ${period25(trimester25Selected)} já têm atividades.`);draft={name:'',classroomId:cls,count:10,key:Array(10).fill(''),avSlot:1,maxScore:10,c25Column:free,c25Trimester:trimester25Selected,c26SubjectId:selectedSubjectId};creating=true;tab='exams';render();};
const oldCreateRender25=renderCreate;
renderCreate=function(){let html=oldCreateRender25();const cls=draft.classroomId,t=Number(draft.c25Trimester||1),occupied=new Set(db.exams.filter(e=>e.classroomId===cls&&e.subjectId===draft.c26SubjectId&&trimester25(e)===t).map(code25));
 const choices=C25.map(k=>`<option value="${k}" ${draft.c25Column===k?'selected':''} ${occupied.has(k)?'disabled':''}>${name25(k)}${occupied.has(k)?' (já cadastrada)':''}</option>`).join('');
 const selector=`<label class="field">Trimestre letivo<select id="exam25Trimester">${[1,2,3].map(n=>`<option value="${n}" ${n===t?'selected':''}>${period25(n)}</option>`).join('')}</select></label><label class="field">Coluna<select id="examSlot">${choices}</select></label>`;
 html=html.replace(/<label class="field">Avaliação<select id="examSlot">[\s\S]*?<\/select><\/label>/,selector);
 return html.replace('Nova avaliação','Nova atividade / avaliação').replace('Salvar avaliação','Salvar atividade');};
const oldExams25=renderExams;
renderExams=function(){if(creating)return renderCreate();const subset=db.exams.filter(e=>trimester25(e)===trimester25Selected).sort((a,b)=>C25.indexOf(code25(a))-C25.indexOf(code25(b)));
 return `${trimesterTabs25()}<div class="toolbar"><p class="muted">AT1 a AT5 e Avaliação em cada trimestre. Você também pode digitar notas diretamente na tabela.</p>${btn('create',`${icon('add')} Nova atividade`,'btn btn-primary')}</div>${subset.length?`<section class="exam-list">${subset.map(e=>{const count=db.students.filter(s=>s.classroomId===e.classroomId).length;return `<article class="exam-row"><div><span class="pill pill-green">${period25(trimester25(e))} · ${name25(code25(e))} · ${e.count} questões</span><h3>${esc(e.name)}</h3><p>${esc(e.group||'Sem turma')} · Valor ${fmt(e.maxScore)} pontos · ${count} estudante(s)</p></div><div class="actions">${btn('print',`${icon('print')} Em branco`,'btn btn-sm',`data-id="${esc(e.id)}"`)}${count?btn('printAll','Cartões da turma','btn btn-sm',`data-id="${esc(e.id)}"`):''}${btn('pickScan',`${icon('scan')} Corrigir`,'btn btn-primary btn-sm',`data-id="${esc(e.id)}"`)}${btn('deleteExam',icon('trash'),'btn btn-danger btn-sm',`data-id="${esc(e.id)}" aria-label="Excluir atividade"`)}</div></article>`;}).join('')}</section>`:empty('Nenhuma atividade neste trimestre','Crie uma atividade para leitura por cartão, ou digite diretamente na tabela de notas.','create','Criar atividade')}`;};
saveExam=async function(){draft.name=el('examName')?.value.trim()||draft.name;draft.classroomId=el('examClass')?.value||draft.classroomId;draft.maxScore=numPT(el('examMaxScore')?.value??draft.maxScore);const t=Number(el('exam25Trimester')?.value||draft.c25Trimester||1),k=el('examSlot')?.value||draft.c25Column;
 if(!draft.classroomId||!db.classes.some(c=>c.id===draft.classroomId))return toast('Selecione uma turma válida.');draft.c26SubjectId=el('examSubject')?.value||draft.c26SubjectId;if(!assigned26(draft.classroomId,draft.c26SubjectId))return toast('Escolha uma disciplina vinculada à turma.');if(!draft.name)return toast('Informe o nome/assunto.');if(![1,2,3].includes(t)||!C25.includes(k))return toast('Selecione o trimestre e a coluna.');if(findExam25(draft.classroomId,t,k,draft.c26SubjectId))return toast(`Já existe ${name25(k)} no ${period25(t)} dessa disciplina.`);
 if(!Number.isFinite(draft.maxScore)||draft.maxScore<=0||draft.maxScore>100)return toast('Valor máximo deve estar entre 0,01 e 100.');if((db.gradeEntries||[]).some(g=>g.classroomId===draft.classroomId&&g.subjectId===draft.c26SubjectId&&g.trimester===t&&g.columnCode===k&&g.status==='GRADE'&&Number(g.score)>draft.maxScore))return toast('Há notas manuais maiores que o valor desta prova. Ajuste essas notas antes de cadastrar o gabarito.');if(draft.key.some(x=>!x))return toast('Informe as respostas do gabarito.');
 const slot=k==='AVALIACAO'?null:Number(k.slice(2)),e={id:uid(),name:draft.name,classroomId:draft.classroomId,subjectId:draft.c26SubjectId,group:className(draft.classroomId),count:draft.count,key:[...draft.key],avSlot:slot,assessmentKind:slot==null?'AVALIACAO':'AT',columnCode:k,trimester:t,maxScore:draft.maxScore,created:new Date().toISOString()};
 if(!await cloudInsert('cac_exams',{id:e.id,classroom_id:e.classroomId,subject_id:e.subjectId,name:e.name,group_name:e.group,question_count:e.count,answer_key:e.key,av_slot:slot,assessment_kind:e.assessmentKind,trimester:t,max_score:e.maxScore}))return;
 db.exams.unshift(e);persistDemo();creating=false;trimester25Selected=t;selectedSubjectId=e.subjectId;render();toast(`${name25(k)} salva para o ${period25(t)}.`);};
const oldPrint25=printExam;
printExam=function(id,all){oldPrint25(id,all);const e=db.exams.find(e=>e.id===id);if(e){el('printRoot').innerHTML=el('printRoot').innerHTML.replaceAll(`<strong>Avaliação:</strong> ${esc(e.id)}`,`<strong>Atividade:</strong> ${period25(trimester25(e))} · ${name25(code25(e))}`);}};
const oldScan25=renderScan;
renderScan=function(){let html=oldScan25();const opts=db.exams.map(e=>`<option value="${esc(e.id)}" ${e.id===scanExamId?'selected':''}>${period25(trimester25(e))} · ${name25(code25(e))} · ${esc(e.group)} · ${esc(e.name)}</option>`).join('');return html.replace(/(<select id="scanExam">)<option value="">[\s\S]*?<\/select>/,`$1<option value="">Selecione a avaliação</option>${opts}</select>`).replaceAll('AV1 a AV5','AT1 a AT5 e Avaliação');};
const oldReview25=showReview;
showReview=function(){oldReview25();if(!proposed)return;const e=proposed.exam,root=el('reviewCard');if(root)root.innerHTML=root.innerHTML.replace(`AV${avOf(e)||'?'}`,`${period25(trimester25(e))} · ${name25(code25(e))}`).replace(`salvar na AV${avOf(e)||''}`,`salvar em ${name25(code25(e))}`);};
const oldDetail25=detailPanel;
detailPanel=function(){const e=db.exams.find(x=>db.results.find(r=>r.id===detailResultId)?.examId===x.id);return e?oldDetail25().replace(`AV${avOf(e)||'?'}`,`${period25(trimester25(e))} · ${name25(code25(e))}`):oldDetail25();};

saveResult=async function(){if(!proposed)return;const e=proposed.exam,ans=[...proposed.answers],sid=el('resultStudent')?.value||'',s=db.students.find(s=>s.id===sid&&s.classroomId===e.classroomId);if(!s)return toast('Confirme o estudante antes de salvar.');const hits=ans.filter((v,i)=>v===e.key[i]).length,score=grade(hits,e.count,e.maxScore),old=latestResult(e.id,sid),when=new Date().toISOString();
 if(old&&!confirm(`Já existe correção de ${s.name} em ${name25(code25(e))}. Substituir a correção original?`))return;
 const fields={student_id:sid,student_name:s.name,student_code:s.code||'',answers:ans,hits,score,question_count:e.count};
 if(old){if(!await cloudUpdate('cac_results',old.id,fields))return;Object.assign(old,{answers:ans,hits,score,count:e.count,created:when});}
 else{const r={id:uid(),examId:e.id,studentId:sid,student:s.name,studentCode:s.code||'',answers:ans,hits,score,count:e.count,created:when};if(!await cloudInsert('cac_results',{id:r.id,exam_id:e.id,...fields}))return;db.results.unshift(r);}
 selectedSubjectId=e.subjectId;const manual=findGrade25(sid,trimester25(e),code25(e));persistDemo();proposed=null;scanCanvas=null;manualCorners=[];tab='results';selectedClassId=e.classroomId;trimester25Selected=trimester25(e);detailResultId=old?.id||db.results.find(r=>r.examId===e.id&&r.studentId===sid)?.id||'';render();toast(manual?'Correção registrada. A nota editada manualmente foi preservada.':`${s.name} · ${name25(code25(e))} · nota ${fmt(score)} salva.`);};
renderResults=function(){const cls=selectedClassId||db.classes[0]?.id||'';selectedClassId=cls;if(!db.classes.length)return empty('Nenhuma turma','Cadastre uma turma e os nomes da ata.','gotoClasses','Cadastrar turma');const options=db.classes.map(c=>`<option value="${esc(c.id)}" ${cls===c.id?'selected':''}>${esc(c.name)}</option>`).join('');const chosen=db.exams.filter(e=>e.classroomId===cls&&trimester25(e)===trimester25Selected);
 return `<div class="toolbar"><label class="field">Turma<select id="gradesClass">${options}</select></label><div class="actions">${btn('exportGrades',`${icon('download')} Exportar trimestre CSV`,'btn btn-primary')}${btn('v25ExportAll','Exportar 3 trimestres','btn')}</div></div><div class="notice">Selecione o trimestre, toque em uma nota para inserir ou editar manualmente. Use <strong>NC</strong> quando o estudante não realizou a atividade. As alterações manuais não apagam as respostas da leitura.</div><section class="card grade-roster"><div class="card-head"><h3>Tabela de notas</h3><span class="pill pill-green">AT1–AT5 · Avaliação</span></div>${gradeTableForClass(cls)}</section>${detailPanel()}<section class="card"><h3>Atividades cadastradas no ${period25(trimester25Selected)}</h3><div class="av-list">${chosen.length?chosen.map(e=>`<span class="pill">${name25(code25(e))} · ${esc(e.name)} · ${fmt(e.maxScore)} pontos</span>`).join(''):'<p class="muted">Nenhuma atividade cadastrada. Lançamentos manuais continuam disponíveis na tabela.</p>'}</div></section>`;};
exportCSV=function(all=false){const cls=selectedClassId||db.classes[0]?.id;if(!cls)return toast('Selecione uma turma.');const students=db.students.filter(s=>s.classroomId===cls).sort((a,b)=>a.name.localeCompare(b.name,'pt-BR'));if(!students.length)return toast('Sem estudantes nesta turma.');
 const periods=all?[1,2,3]:[trimester25Selected],headers=['Estudante','Número',...periods.flatMap(t=>C25.map(k=>`${t}º trimestre - ${name25(k)}`))],rows=students.map(s=>[s.name,s.code||'',...periods.flatMap(t=>C25.map(k=>{const g=state25(s,t,k);return g.status==='GRADE'?Number(g.score).toFixed(2).replace('.',','):g.status==='NC'?'NC':'';}))]);
 const safe=v=>{let s=String(v??'');if(/^\s*[=+@\-]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';},csv='\ufeff'+[headers,...rows].map(row=>row.map(safe).join(';')).join('\r\n');const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8;'})),a=document.createElement('a');a.href=url;a.download=`Corrige_CAC_${(className(cls)||'Turma').replace(/[^A-Za-z0-9À-ÿ_-]+/g,'_')}_${all?'3_Trimestres':`${trimester25Selected}_Trimestre`}.csv`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2000);toast('Notas exportadas.');};

// Captura os campos antes do manipulador original, para não perder a escolha ao clicar no gabarito.
document.addEventListener('click',ev=>{const node=ev.target.closest('[data-action]');if(node?.dataset.action==='setKey'&&el('examSlot')){draft.c25Column=el('examSlot').value;draft.c25Trimester=Number(el('exam25Trimester').value);draft.c26SubjectId=el('examSubject')?.value||draft.c26SubjectId;}},true);
document.addEventListener('change',ev=>{const x=ev.target;if(x.id==='examSlot')draft.c25Column=x.value;if(x.id==='exam25Trimester'){draft.c25Trimester=Number(x.value);draft.c25Column=C25.find(k=>!findExam25(el('examClass').value,draft.c25Trimester,k,draft.c26SubjectId))||'AT1';render();}if(x.id==='examClass'){draft.c25Trimester=Number(el('exam25Trimester')?.value||draft.c25Trimester||1);draft.c26SubjectId=subjectForClass26(x.value);draft.c25Column=C25.find(k=>!findExam25(x.value,draft.c25Trimester,k,draft.c26SubjectId))||'AT1';}if(x.id==='examCount'&&el('examSlot')){draft.c25Column=el('examSlot').value;draft.c25Trimester=Number(el('exam25Trimester').value);draft.c26SubjectId=el('examSubject')?.value||draft.c26SubjectId;}},true);
document.addEventListener('click',async ev=>{const node=ev.target.closest('[data-action]');if(!node)return;const a=node.dataset.action,t=Number(node.dataset.trimester),id=node.dataset.student,k=node.dataset.column;
 if(a==='v25Trim'){trimester25Selected=t;grade25Editing=null;detailResultId='';render();}
 else if(a==='v25Edit'){grade25Editing={studentId:id,trimester:t,code:k};render();queueMicrotask(()=>el('grade25Form')?.querySelector('input')?.focus());}
 else if(a==='v25Cancel'){grade25Editing=null;render();}
 else if(a==='v25NC')await setGrade25(id,t,k,'NC',null);
 else if(a==='v25Clear')await clearGrade25(id,t,k);
 else if(a==='v25ExportAll')exportCSV(true);
});
document.addEventListener('submit',async ev=>{if(ev.target.id!=='grade25Form')return;ev.preventDefault();const f=ev.target;await setGrade25(f.dataset.student,Number(f.dataset.trimester),f.dataset.column,'GRADE',new FormData(f).get('score'));});

/* Corrige+ (CAC) v2.6 — componente curricular por professor/turma/trimestre. */
let selectedSubjectId='';
const subjectName26=id=>(db.subjects||[]).find(s=>s.id===id)?.name||'Disciplina não selecionada';
const subjectsForClass26=id=>(db.subjects||[]).filter(s=>(db.classSubjects||[]).some(a=>a.classroomId===id&&a.subjectId===s.id)).sort((a,b)=>a.name.localeCompare(b.name,'pt-BR'));
const assigned26=(classroomId,subjectId)=>!!subjectId&&(db.classSubjects||[]).some(a=>a.classroomId===classroomId&&a.subjectId===subjectId);
const subjectForClass26=(classroomId)=>assigned26(classroomId,selectedSubjectId)?selectedSubjectId:(subjectsForClass26(classroomId)[0]?.id||'');
function ensureSubject26(classroomId){if(!assigned26(classroomId,selectedSubjectId))selectedSubjectId=subjectForClass26(classroomId);return selectedSubjectId;}
function subjectOptions26(classroomId,subjectId=selectedSubjectId){return subjectsForClass26(classroomId).map(s=>`<option value="${esc(s.id)}" ${s.id===subjectId?'selected':''}>${esc(s.name)}</option>`).join('');}
function subjectSelector26(classroomId,id,caption='Disciplina'){const subjects=subjectsForClass26(classroomId);if(!subjects.length)return `<div class="notice warn">Nenhuma disciplina vinculada a esta turma. ${btn('v26Subjects','Cadastrar/vincular disciplinas','btn btn-sm')}</div>`;return `<label class="field subject-filter">${caption}<select id="${id}" aria-label="${caption}">${subjectOptions26(classroomId)}</select></label>`;}

const oldCloud26=loadCloud;
loadCloud=async function(){await oldCloud26();const tables=['cac_subjects','cac_classroom_subjects'];const res=await Promise.all(tables.map(t=>client.from(t).select('*').eq('teacher_id',user.id).limit(1000)));const failed=res.find(r=>r.error);if(failed)throw new Error('Disciplinas: '+failed.error.message);db.subjects=(res[0].data||[]).map(s=>({id:s.id,name:s.name,created:s.created_at}));db.classSubjects=(res[1].data||[]).map(a=>({id:a.id,classroomId:a.classroom_id,subjectId:a.subject_id}));selectedClassId=selectedClassId||db.classes[0]?.id||'';ensureSubject26(selectedClassId);};
const oldDemo26=useDemo;
useDemo=function(){oldDemo26();db.subjects||=[];db.classSubjects||=[];db.gradeEntries||=[];
  // Compatibilidade com dados fictícios de demonstrações anteriores, sem apagar nenhuma nota.
  const legacy=[...db.exams,...db.gradeEntries].some(x=>!x.subjectId);
  if(legacy&&db.classes.length){let subject=db.subjects.find(s=>s.name==='Disciplina inicial');if(!subject){subject={id:uid(),name:'Disciplina inicial'};db.subjects.unshift(subject);}for(const c of db.classes){if(!assigned26(c.id,subject.id))db.classSubjects.push({id:uid(),classroomId:c.id,subjectId:subject.id});}for(const x of [...db.exams,...db.gradeEntries])if(!x.subjectId)x.subjectId=subject.id;persistDemo();}
  selectedClassId=selectedClassId||db.classes[0]?.id||'';ensureSubject26(selectedClassId);render();};

const oldRender26=render;
render=function(){if(tab==='subjects'){nav();el('pageTitle').textContent='Disciplinas do professor';el('view').innerHTML=renderSubjects26();return;}if(tab==='results'||tab==='exams'||tab==='classes')ensureSubject26(selectedClassId||db.classes[0]?.id||'');oldRender26();if(tab==='results')el('pageTitle').textContent=`Diário · ${period25(trimester25Selected)}`;if(tab==='exams')el('pageTitle').textContent=`Atividades · ${period25(trimester25Selected)}`;};

function renderSubjects26(){const subjects=(db.subjects||[]).slice().sort((a,b)=>a.name.localeCompare(b.name,'pt-BR'));return `<div class="toolbar"><p class="muted">Indique quais disciplinas você leciona e em quais turmas. Os diários dos três trimestres serão organizados automaticamente para cada combinação.</p></div><section class="card stack"><h3>Minhas disciplinas</h3><form id="subject26Form" class="subject-add"><label class="field">Nome da disciplina<input name="subject" maxlength="70" minlength="2" required placeholder="Ex.: Matemática, Estudo Orientado, Física"></label><button type="submit" class="btn btn-primary">${icon('add')} Adicionar disciplina</button></form>${subjects.length?`<div class="subject-chips">${subjects.map(s=>`<span class="subject-chip">${esc(s.name)} ${btn('v26DeleteSubject','×','subject-chip-delete',`data-id="${esc(s.id)}" aria-label="Excluir ${esc(s.name)}"`)}</span>`).join('')}</div>`:'<div class="notice">Cadastre sua primeira disciplina para começar.</div>'}</section><section class="card stack"><h3>Disciplinas por turma</h3><p class="muted">Marque somente as disciplinas que você leciona em cada turma. A ata da turma é única, mas suas notas são independentes por disciplina e trimestre.</p>${!db.classes.length?`<div class="notice warn">Cadastre uma turma primeiro. ${btn('gotoClasses','Cadastrar turma','btn btn-sm')}</div>`:!subjects.length?'<div class="notice">Cadastre uma disciplina acima para vinculá-la às turmas.</div>':db.classes.map(c=>`<div class="subject-class"><strong>${esc(c.name)}</strong><div class="subject-class-grid">${subjects.map(s=>{const yes=assigned26(c.id,s.id);return `<button data-action="v26Assign" type="button" data-class="${esc(c.id)}" data-subject="${esc(s.id)}" class="subject-choice ${yes?'assigned':''}" aria-pressed="${yes}">${yes?'✓':'+'} ${esc(s.name)}</button>`}).join('')}</div><div class="tiny">${subjectsForClass26(c.id).length} disciplina(s) vinculada(s)</div></div>`).join('')}</section><div class="notice green">Cada disciplina terá, no 1º, 2º e 3º trimestres, as colunas <strong>AT1, AT2, AT3, AT4, AT5 e Avaliação</strong>.</div>`;}
async function addSubject26(form){const name=String(new FormData(form).get('subject')||'').trim().replace(/\s+/g,' ');if(name.length<2||name.length>70)return toast('Digite o nome da disciplina (2 a 70 caracteres).');if((db.subjects||[]).some(s=>s.name.toLocaleLowerCase('pt-BR')===name.toLocaleLowerCase('pt-BR')))return toast('Essa disciplina já está cadastrada.');const s={id:uid(),name,created:new Date().toISOString()};if(!await cloudInsert('cac_subjects',{id:s.id,name:s.name}))return;db.subjects.push(s);persistDemo();render();toast(`${name} cadastrada. Agora vincule-a às turmas.`);}
async function assignSubject26(classroomId,subjectId){const s=db.subjects.find(s=>s.id===subjectId),c=db.classes.find(c=>c.id===classroomId);if(!s||!c)return toast('Disciplina/turma inválida.');const prior=db.classSubjects.find(a=>a.classroomId===classroomId&&a.subjectId===subjectId);
 if(prior){if(db.exams.some(e=>e.classroomId===classroomId&&e.subjectId===subjectId)||db.gradeEntries.some(g=>g.classroomId===classroomId&&g.subjectId===subjectId))return toast('Disciplina com avaliações/notas: não é possível desvincular sem preservar esses registros.');if(!await cloudDelete('cac_classroom_subjects',prior.id))return;db.classSubjects=db.classSubjects.filter(a=>a.id!==prior.id);}
 else {const a={id:uid(),classroomId,subjectId};if(!await cloudInsert('cac_classroom_subjects',{id:a.id,classroom_id:classroomId,subject_id:subjectId}))return;db.classSubjects.push(a);selectedSubjectId=subjectId;}
 ensureSubject26(selectedClassId||classroomId);persistDemo();render();toast(prior?'Disciplina desvinculada desta turma.':`${s.name} vinculada à turma ${c.name}.`);}
async function deleteSubject26(id){const sub=db.subjects.find(s=>s.id===id);if(!sub)return;const rel=db.classSubjects.filter(a=>a.subjectId===id);if(rel.length)return toast('Para excluir, desvincule a disciplina de todas as turmas.');if(!confirm('Excluir a disciplina '+sub.name+' do seu cadastro?'))return;if(!await cloudDelete('cac_subjects',id))return;db.subjects=db.subjects.filter(s=>s.id!==id);persistDemo();render();toast('Disciplina excluída.');}

const oldHome26=renderHome;
renderHome=function(){let h=oldHome26();return h.replace('Fotografe a ata.<br>Corrija e registre as notas.','Cadastre suas disciplinas.<br>Corrija e registre as notas.').replace('Um fluxo simples: foto da lista, avaliações AV1 a AV5, leitura por câmera e tabela pronta.','Foto da ata, disciplinas por turma e diários do 1º ao 3º trimestre, com AT1–AT5 e Avaliação.').replace('Fotografe a ata e confira os nomes antes de gerar a tabela AV1 a AV5.','Cadastre a turma, fotografe a ata e confira os nomes antes de gerar os diários.').replace('Nova AT1–AT5 + Avaliação','AT1–AT5 e Avaliação').replace('Versão 2.5','Versão 2.6').replace('<h2 class="section-title">O que deseja fazer?</h2>',`<div class="notice green" style="margin-bottom:16px"><strong>Disciplinas cadastradas: ${db.subjects.length}.</strong> ${db.subjects.length?'Selecione a disciplina ao abrir o diário.':'Comece informando quais disciplinas você leciona.'} ${btn('v26Subjects','Gerenciar disciplinas','btn btn-sm')}</div><h2 class="section-title">O que deseja fazer?</h2>`);};

const oldClasses26=renderClasses;
renderClasses=function(){const cls=selectedClassId||db.classes[0]?.id||'';ensureSubject26(cls);let h=oldClasses26();const selector=subjectSelector26(cls,'classSubject26','Disciplina do quadro');return h.replace('<section class="card grade-roster">',`<section class="card grade-roster"><div class="subject-filter-wrap">${selector}</div>`).replace('A tabela é organizada em três trimestres, cada um com AT1 a AT5 e Avaliação.','Os nomes da ata são compartilhados entre disciplinas. Cada disciplina terá seu diário trimestral.');};
const oldGrade26=gradeTableForClass;
gradeTableForClass=function(cls,editable=false){if(!assigned26(cls,selectedSubjectId))return `<div class="notice warn">Vincule uma disciplina a esta turma para gerar seus diários. ${btn('v26Subjects','Selecionar disciplinas','btn btn-sm')}</div>`;const html=oldGrade26(cls,editable);return tab==='results'?html.replace(/<div class="trimester-tabs"[^>]*>[\s\S]*?<\/div>/,''):html;};

const oldCreateRender26=renderCreate;
renderCreate=function(){let h=oldCreateRender26();const c=draft.classroomId||selectedClassId;if(!assigned26(c,draft.c26SubjectId))draft.c26SubjectId=subjectForClass26(c);const options=subjectOptions26(c,draft.c26SubjectId);if(!options)return `<div class="notice warn">Associe uma disciplina à turma antes de criar a avaliação. ${btn('v26Subjects','Configurar disciplinas','btn btn-primary')}</div>`;const select=`<label class="field">Disciplina<select id="examSubject">${options}</select></label>`;return h.replace('<label class="field">Trimestre letivo',select+'<label class="field">Trimestre letivo');};

renderExams=function(){if(creating)return renderCreate();const cls=selectedClassId||db.classes[0]?.id||'';selectedClassId=cls;ensureSubject26(cls);if(!db.classes.length)return empty('Nenhuma turma','Cadastre uma turma para começar.','gotoClasses','Cadastrar turma');const cOptions=db.classes.map(c=>`<option value="${esc(c.id)}" ${c.id===cls?'selected':''}>${esc(c.name)}</option>`).join('');const subset=db.exams.filter(e=>e.classroomId===cls&&e.subjectId===selectedSubjectId&&trimester25(e)===trimester25Selected).sort((a,b)=>C25.indexOf(code25(a))-C25.indexOf(code25(b)));const filters=`<div class="journal-filters"><label class="field">Turma<select id="examListClass26">${cOptions}</select></label>${subjectSelector26(cls,'examListSubject26')}</div>`;
return `${filters}${trimesterTabs25()}<div class="toolbar"><p class="muted">${esc(subjectName26(selectedSubjectId))} · ${period25(trimester25Selected)} · AT1 a AT5 e Avaliação</p>${btn('create',`${icon('add')} Nova atividade`,'btn btn-primary')}</div>${subset.length?`<section class="exam-list">${subset.map(e=>{const count=db.students.filter(s=>s.classroomId===e.classroomId).length;return `<article class="exam-row"><div><span class="pill pill-green">${period25(trimester25(e))} · ${name25(code25(e))} · ${e.count} questões</span><h3>${esc(e.name)}</h3><p>${esc(subjectName26(e.subjectId))} · ${esc(e.group)} · Valor ${fmt(e.maxScore)} pontos · ${count} estudantes</p></div><div class="actions">${btn('print',`${icon('print')} Em branco`,'btn btn-sm',`data-id="${esc(e.id)}"`)}${count?btn('printAll','Cartões da turma','btn btn-sm',`data-id="${esc(e.id)}"`):''}${btn('pickScan',`${icon('scan')} Corrigir`,'btn btn-primary btn-sm',`data-id="${esc(e.id)}"`)}${btn('deleteExam',icon('trash'),'btn btn-danger btn-sm',`data-id="${esc(e.id)}" aria-label="Excluir atividade"`)}</div></article>`}).join('')}</section>`:empty('Nenhuma atividade cadastrada nesta disciplina/trimestre','Crie uma atividade ou lance a nota manualmente no diário.','create','Criar atividade')}`;};

const oldPrint26=printExam;
printExam=function(id,all){oldPrint26(id,all);const exam=db.exams.find(e=>e.id===id);if(!exam)return;const name=subjectName26(exam.subjectId);el('printRoot').querySelectorAll('.print-head >div:first-child').forEach(n=>{const x=document.createElement('p');const strong=document.createElement('strong');strong.textContent='Disciplina: ';x.append(strong,document.createTextNode(name+' · '+period25(trimester25(exam))));n.insertBefore(x,n.querySelector('.print-qr')||null);});};
const oldScan26=renderScan;
renderScan=function(){let h=oldScan26();const select=db.exams.map(e=>`<option value="${esc(e.id)}" ${e.id===scanExamId?'selected':''}>${esc(subjectName26(e.subjectId))} · ${esc(className(e.classroomId))} · ${period25(trimester25(e))} · ${name25(code25(e))}</option>`).join('');return h.replace(/(<select id="scanExam">)[\s\S]*?<\/select>/,`$1<option value="">Escolha uma avaliação ou leia o QR Code</option>${select}</select>`);};
const oldDetail26=detailPanel;
detailPanel=function(){const r=db.results.find(x=>x.id===detailResultId);const e=r?db.exams.find(x=>x.id===r.examId):null;const html=oldDetail26();return e?html.replace('<p class="muted">',`<p class="muted"><strong>Disciplina: ${esc(subjectName26(e.subjectId))}</strong> · `):html;};

renderResults=function(){const cls=selectedClassId||db.classes[0]?.id||'';selectedClassId=cls;if(!db.classes.length)return empty('Nenhuma turma','Cadastre uma turma e importe os nomes da ata.','gotoClasses','Cadastrar turma');ensureSubject26(cls);const cOptions=db.classes.map(c=>`<option value="${esc(c.id)}" ${c.id===cls?'selected':''}>${esc(c.name)}</option>`).join('');const exams=db.exams.filter(e=>e.classroomId===cls&&e.subjectId===selectedSubjectId&&trimester25(e)===trimester25Selected);return `<div class="journal-heading"><span class="pill pill-green">DIÁRIO DO ${trimester25Selected}º TRIMESTRE</span><h2>Diário de notas · ${esc(subjectName26(selectedSubjectId))}</h2><p>${esc(className(cls))} · AT1 a AT5 e Avaliação</p></div><div class="journal-filters"><label class="field">Turma<select id="gradesClass">${cOptions}</select></label>${subjectSelector26(cls,'gradesSubject26')}</div>${trimesterTabs25()}<div class="toolbar"><p class="muted">Toque numa nota para lançá-la, editá-la ou marcar <strong>NC</strong>. Notas lidas pela câmera permanecem consultáveis.</p><div class="actions">${btn('exportGrades',`${icon('download')} Exportar trimestre`,'btn btn-primary')}${btn('v25ExportAll','Exportar os três trimestres','btn')}</div></div><section class="card grade-roster"><div class="card-head"><h3>${esc(subjectName26(selectedSubjectId))} · ${period25(trimester25Selected)}</h3><span class="pill pill-green">AT1–AT5 · Avaliação</span></div>${gradeTableForClass(cls)}</section>${detailPanel()}<section class="card"><h3>Atividades cadastradas neste diário</h3><div class="av-list">${exams.length?exams.map(e=>`<span class="pill">${name25(code25(e))} · ${esc(e.name)} · até ${fmt(e.maxScore)} pontos</span>`).join(''):'<p class="muted">Sem atividades cadastradas. Os lançamentos manuais estão disponíveis.</p>'}</div></section>`;};
exportCSV=function(all=false){const cls=selectedClassId||db.classes[0]?.id||'';if(!assigned26(cls,selectedSubjectId))return toast('Escolha a disciplina do diário.');const students=db.students.filter(s=>s.classroomId===cls).sort((a,b)=>a.name.localeCompare(b.name,'pt-BR'));if(!students.length)return toast('Sem estudantes nesta turma.');const periods=all?[1,2,3]:[trimester25Selected],headers=['Estudante','Número','Disciplina',...periods.flatMap(t=>C25.map(k=>`${t}º trimestre - ${name25(k)}`))],rows=students.map(s=>[s.name,s.code||'',subjectName26(selectedSubjectId),...periods.flatMap(t=>C25.map(k=>{const x=state25(s,t,k);return x.status==='GRADE'?Number(x.score).toFixed(2).replace('.',','):x.status==='NC'?'NC':'';}))]);const safe=v=>{let s=String(v??'');if(/^\s*[=+@\-]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';};const csv='\ufeff'+[headers,...rows].map(r=>r.map(safe).join(';')).join('\r\n');const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download=`Corrige_CAC_${(className(cls)+'_'+subjectName26(selectedSubjectId)).replace(/[^A-Za-z0-9À-ÿ_-]+/g,'_')}_${all?'3_Trimestres':trimester25Selected+'o_Trimestre'}.csv`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),3000);toast('Diário da disciplina exportado.');};

// Contexto do gabarito: não perder disciplina quando professor escolhe opções e alternativas.
document.addEventListener('click',ev=>{const x=ev.target.closest('[data-action]');if(x?.dataset.action==='setKey'&&el('examSubject'))draft.c26SubjectId=el('examSubject').value;},true);
document.addEventListener('change',ev=>{const x=ev.target;
 if(['gradesSubject26','classSubject26','examListSubject26'].includes(x.id)){selectedSubjectId=x.value;grade25Editing=null;detailResultId='';render();}
 else if(x.id==='examListClass26'){selectedClassId=x.value;ensureSubject26(selectedClassId);render();}
 else if(x.id==='examSubject'){draft.c26SubjectId=x.value;draft.name=el('examName')?.value||draft.name;draft.c25Column=C25.find(k=>!findExam25(draft.classroomId,draft.c25Trimester,k,x.value))||'AT1';render();}
 else if(x.id==='examClass'){draft.c26SubjectId=subjectForClass26(x.value);draft.c25Column=C25.find(k=>!findExam25(x.value,draft.c25Trimester,k,draft.c26SubjectId))||'AT1';render();}
});
document.addEventListener('click',async ev=>{const node=ev.target.closest('[data-action]');if(!node)return;const act=node.dataset.action;if(act==='v26Subjects'){go('subjects');return;}if(act==='v26Assign'){await assignSubject26(node.dataset.class,node.dataset.subject);return;}if(act==='v26DeleteSubject'){await deleteSubject26(node.dataset.id);return;}if(act==='pickScan'){const e=db.exams.find(e=>e.id===node.dataset.id);if(e){selectedClassId=e.classroomId;selectedSubjectId=e.subjectId;trimester25Selected=trimester25(e);}}},true);
document.addEventListener('submit',async ev=>{if(ev.target.id!=='subject26Form')return;ev.preventDefault();await addSubject26(ev.target);});

document.addEventListener('input',event=>{if(event.target?.id==='rosterCropLeft'||event.target?.id==='rosterCropRight')adjustRosterCrop();});

initialize();
