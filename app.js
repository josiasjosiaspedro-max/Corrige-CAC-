'use strict';
/* Corrige+ (CAC) v2.9 — leitura por linhas da tabela + importação PDF original. */
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
let stagedNames=[],rosterPhotoUrl='',rosterBusy=false,rosterProgress='';
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
 const photo=rosterPhotoUrl?`<section class="roster-column-tool"><h4>Selecione somente a coluna Nome</h4><p class="muted-note">Mova os controles até a região transparente conter todos os nomes, sem matrícula nem assinaturas. Deslize a imagem para conferir as linhas inferiores.</p><div class="roster-crop-scroll"><div class="roster-crop-stage"><img id="rosterImage" src="${esc(rosterPhotoUrl)}" alt="Foto da ata para selecionar a coluna de nomes"><div class="roster-mask roster-mask-left" style="width:${rosterColumnLeft}%"></div><div class="roster-mask roster-mask-right" style="width:${100-rosterColumnRight}%"></div><div class="roster-selection" style="left:${rosterColumnLeft}%;right:${100-rosterColumnRight}%"></div></div></div><label class="field">Início da coluna Nome <input id="rosterCropLeft" type="range" min="0" max="80" step="1" value="${rosterColumnLeft}" aria-label="Limite esquerdo da coluna Nome"></label><label class="field">Fim da coluna Nome <input id="rosterCropRight" type="range" min="20" max="100" step="1" value="${rosterColumnRight}" aria-label="Limite direito da coluna Nome"></label><div class="actions">${btn('recognizeRoster',`${icon('scan')} Ler lista completa (em partes)`,'btn btn-primary',rosterBusy?'disabled':'')}${btn('resetRosterCrop','Ajustar seleção inicial','btn')}</div><p class="muted-note">Se faltarem nomes, use um dos botões abaixo. Cada nova leitura <strong>acrescenta os nomes encontrados</strong>, sem apagar os anteriores.</p><div class="roster-part-actions">${btn('recognizeRosterPart','Parte de cima','btn btn-sm',`data-part="top" ${rosterBusy?'disabled':''}`)}${btn('recognizeRosterPart','Parte do meio','btn btn-sm',`data-part="middle" ${rosterBusy?'disabled':''}`)}${btn('recognizeRosterPart','Parte de baixo','btn btn-sm',`data-part="bottom" ${rosterBusy?'disabled':''}`)}</div><div id="rosterProgress" class="roster-progress" role="status" aria-live="polite">${esc(rosterProgress)}</div><p class="muted-note">Apenas a parte transparente é analisada; números de matrícula e assinaturas ficam fora. Todas as leituras precisam de conferência.</p></section>`:'';
 const staged=stagedNames.length?`<section class="ocr-review"><h4>Conferência dos nomes (${stagedNames.length})</h4><p class="muted">Confira se <strong>todos</strong> os estudantes estão aqui, um nome por linha. Você pode corrigir, apagar ou digitar os nomes que faltarem. Não salve uma lista incompleta.</p><textarea id="rosterNames" rows="9" spellcheck="false" aria-label="Nomes extraídos da ata, um por linha">${esc(stagedNames.join('\n'))}</textarea><div class="actions">${btn('confirmRoster',`${icon('check')} Confirmar e gerar tabela`,'btn btn-primary')}${btn('clearRoster','Descartar','btn')}</div></section>`:'';
 return `<div class="toolbar"><p class="muted">Cadastre a turma e use a câmera para reconhecer os nomes da ata.</p></div>
 <div class="roster-grid"><article class="card stack"><h3>Cadastrar turma</h3><form id="classForm" class="stack"><label class="field">Nome da turma<input name="name" required maxlength="60" placeholder="Ex.: 3º Ano A"></label><div class="form-grid"><label class="field">Série<input name="grade" maxlength="40" placeholder="Ex.: 3º EM"></label><label class="field">Turno<select name="shift"><option>Integral</option><option>Manhã</option><option>Tarde</option><option>Noite</option></select></label></div><label class="field">Ano letivo<input name="year" type="number" min="2020" max="2100" value="${new Date().getFullYear()}"></label><button class="btn btn-primary" type="submit">${icon('add')} Salvar turma</button></form><div class="divider"></div><h3>Turmas cadastradas</h3>${db.classes.length?db.classes.map(c=>`<div class="exam-row"><div><strong>${esc(c.name)}</strong><p>${esc(c.grade||'')} · ${c.year||''} · ${db.students.filter(s=>s.classroomId===c.id).length} alunos</p></div><div class="actions">${btn('pickClass','Abrir','btn btn-sm',`data-id="${esc(c.id)}"`)}${btn('deleteClass',icon('trash'),'btn btn-danger btn-sm',`data-id="${esc(c.id)}"`)}</div></div>`).join(''):'<p class="muted">Nenhuma turma cadastrada.</p>'}</article>
 <article class="card stack"><h3>Importar nomes pela foto da ata</h3>${db.classes.length?`<label class="field">Escolha a turma<select id="rosterClass">${options}</select></label><div class="actions"><label class="btn btn-primary upload-label">${icon('camera')} Tirar foto da ata<input id="rosterPhotoCamera" type="file" accept="image/*" capture="environment" aria-label="Fotografar ata"></label><label class="btn upload-label">Escolher foto<input id="rosterPhotoGallery" type="file" accept="image/*" aria-label="Selecionar foto da galeria"></label></div><p class="muted-note">Selecione só a coluna Nome. Se a foto for comprida, a leitura será dividida em trechos. Também é possível fotografar <strong>o restante da lista</strong> e acrescentar os nomes à conferência. A foto é processada no aparelho e não é salva no Supabase; a primeira leitura exige internet para carregar a ferramenta.</p>${photo}${rosterBusy?'<div class="notice">Reconhecendo os nomes… não feche esta tela.</div>':''}${staged}<details class="fallback"><summary>Adicionar nome manualmente (alternativa)</summary><form id="studentForm" class="stack" style="margin-top:12px"><label class="field">Nome<input name="name" maxlength="100" required></label><label class="field">Número (opcional)<input name="code" maxlength="50"></label><button class="btn" type="submit">Adicionar estudante</button></form></details><label class="field">Ou importar lista CSV<input id="studentCsv" type="file" accept=".csv,text/csv,text/plain"></label>`:'<p class="muted">Crie uma turma antes de fotografar a ata.</p>'}</article></div>
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
function rosterDraftNames(){
 const text=el('rosterNames')?.value;
 if(text!==undefined)stagedNames=text.split(/\r?\n/).map(x=>x.trim().replace(/\s+/g,' ')).filter(Boolean);
 return stagedNames;
}
function rosterDedup(base,found){
 const norm=s=>String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleUpperCase('pt-BR').replace(/[^A-Z ]/g,'').replace(/\s+/g,' ').trim();
 const seen=new Set(base.map(norm)),all=base.slice();
 for(const name of found){const key=norm(name);if(key&&!seen.has(key)){all.push(name);seen.add(key);}}
 return all.slice(0,200);
}
function rosterUpdateProgress(text){rosterProgress=text;const node=el('rosterProgress');if(node)node.textContent=text;}
function clearRoster(){
 stagedNames=[];rosterProgress='';if(rosterPhotoUrl){URL.revokeObjectURL(rosterPhotoUrl);rosterPhotoUrl='';}
 rosterColumnLeft=30;rosterColumnRight=88;render();
}
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
 rosterDraftNames(); // Não perder nomes já corrigidos, caso outra foto seja escolhida.
 if(rosterPhotoUrl)URL.revokeObjectURL(rosterPhotoUrl);
 rosterPhotoUrl=URL.createObjectURL(file);rosterColumnLeft=30;rosterColumnRight=88;rosterProgress='';
 render();toast(stagedNames.length?'Nova foto pronta. A leitura acrescentará nomes aos anteriores.':'Ajuste a coluna Nome e toque em “Ler lista completa (em partes)”.');
}
async function recognizeRoster(part='all'){
 if(rosterBusy||!rosterPhotoUrl)return;
 const options={all:[0,1],top:[0,.43],middle:[.29,.73],bottom:[.61,1]};
 const [rangeStart,rangeEnd]=options[part]||options.all;
 rosterDraftNames();
 rosterBusy=true;rosterUpdateProgress('Preparando leitura em partes…');render();let worker;
 try{
  if(!window.Tesseract){await new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';script.onload=resolve;script.onerror=()=>reject(Error('Não foi possível carregar o reconhecimento de texto. Confira a internet.'));document.head.appendChild(script);});}
  const img=new Image();await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=()=>reject(Error('Foto inválida.'));img.src=rosterPhotoUrl;});
  const sx=Math.round(img.naturalWidth*rosterColumnLeft/100),sw=Math.round(img.naturalWidth*(rosterColumnRight-rosterColumnLeft)/100);
  if(sw<=0)throw Error('Ajuste a largura da seleção.');
  // Uma imagem alta inteira perde detalhes no redimensionamento; dividir em faixas evita isso.
  const rangeHeight=(rangeEnd-rangeStart)*img.naturalHeight;
  const parts=Math.min(8,Math.max(2,Math.ceil(rangeHeight/Math.max(280,sw*.95))));
  const scale=Math.max(.65,Math.min(3.2,2400/sw,2000/(rangeHeight/parts*1.24)));
  worker=await Tesseract.createWorker('por');
  await worker.setParameters({tessedit_pageseg_mode:'6',preserve_interword_spaces:'1'});
  const current=stagedNames.slice(),collected=[];
  for(let i=0;i<parts;i++){
   const baseStart=rangeStart+(rangeEnd-rangeStart)*i/parts;
   const baseEnd=rangeStart+(rangeEnd-rangeStart)*(i+1)/parts;
   // Sobreposição de 16% da faixa para não cortar nomes na passagem de um trecho a outro.
   const padding=(baseEnd-baseStart)*.16;
   const top=Math.max(0,baseStart-(i?padding:0));
   const bottom=Math.min(1,baseEnd+(i+1<parts?padding:0));
   const sy=Math.round(top*img.naturalHeight),sh=Math.min(img.naturalHeight-sy,Math.max(1,Math.ceil((bottom-top)*img.naturalHeight)));
   const canvas=document.createElement('canvas');
   canvas.width=Math.max(1,Math.round(sw*scale));canvas.height=Math.max(1,Math.round(sh*scale));
   const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.fillStyle='white';ctx.fillRect(0,0,canvas.width,canvas.height);
   ctx.filter='grayscale(1) contrast(1.45)';ctx.drawImage(img,sx,sy,sw,sh,0,0,canvas.width,canvas.height);ctx.filter='none';
   rosterUpdateProgress(`Lendo trecho ${i+1} de ${parts}… ${rosterDedup([],collected).length} nomes encontrados.`);
   let recognized='';
   try{
    const output=await worker.recognize(canvas);recognized=output.data?.text||'';
    let found=extractRosterLines(recognized);
    if(!found.length){await worker.setParameters({tessedit_pageseg_mode:'11'});const other=await worker.recognize(canvas);found=extractRosterLines(other.data?.text||'');await worker.setParameters({tessedit_pageseg_mode:'6'});}
    collected.push(...found);
   }catch(e){console.warn('OCR do trecho',i+1,e);}
   // Libera a memória de imagem após cada trecho no iPhone.
   canvas.width=1;canvas.height=1;
  }
  stagedNames=rosterDedup(current,collected);
  const newCount=stagedNames.length-current.length;
  rosterUpdateProgress(`${stagedNames.length} nomes na conferência (${newCount} novos nesta leitura). Confira a lista toda antes de salvar.`);
  toast(newCount?`${newCount} nomes acrescentados. Confira a lista inteira.`:'Nenhum nome novo. Tente ler a parte que falta ou outra foto.');
  if(!stagedNames.length)stagedNames=[''];
 }catch(error){rosterUpdateProgress('Leitura não concluída. Tente outra foto ou um trecho.');if(!stagedNames.length)stagedNames=[''];toast('Leitura não concluída: '+(error.message||'confira a imagem e a conexão.'));}
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
function tryRead(forceCorners){if(!scanCanvas)return;proposed=null;el('reviewCard').innerHTML='';let e=db.exams.find(x=>x.id===scanExamId),s=null;const code=detectQR(scanCanvas);
 if(code?.startsWith('CAC2|')){const parts=code.split('|'),match=db.exams.find(x=>x.id===parts[1]);if(match){e=match;scanExamId=e.id;const selector=el('scanExam');if(selector)selector.value=e.id;s=db.students.find(x=>x.id===parts[2]&&x.classroomId===e.classroomId)||null;}}
 if(!e){el('scanStatus').innerHTML='<div class="notice warn" style="margin-top:16px">Selecione a avaliação ou fotografe um cartão com QR Code legível.</div>';return;}
 const corners=forceCorners||findMarkers(scanCanvas);if(!corners){el('scanStatus').innerHTML='<div class="notice warn" style="margin-top:16px">Não consegui localizar os quatro quadrados. Escolha “Marcar cantos manualmente” e toque nos centros em ordem: superior esquerdo, superior direito, inferior direito, inferior esquerdo.</div>';return;}
 const h=homography(POINTS,corners);if(!h)return toast('Alinhamento incorreto; ajuste os cantos.');const read=readBubbles34(scanCanvas,e,h);proposed={exam:e,studentId:s?.id||'',answers:read.answers,confidence:read.confidence,corners,omr:read};manualMode=false;showCornerPreview(corners);el('scanStatus').innerHTML=`<div class="notice ${read.answers.some(Boolean)?'green':'warn'}" style="margin:16px 0">${read.answers.filter(Boolean).length} de ${e.count} respostas reconhecidas. ${s?'Aluno identificado pelo QR Code. ':''}Confira todas as respostas antes de salvar.</div>`;showReview();}
function showCornerPreview(corners){const p=el('snapshotPreview');if(!p||!scanCanvas)return;const ctx=p.getContext('2d');ctx.drawImage(scanCanvas,0,0);const r=Math.max(5,p.width/120);ctx.lineWidth=Math.max(2,p.width/550);ctx.strokeStyle='#0eca87';ctx.fillStyle='#0eca87';ctx.beginPath();corners.forEach(([x,y],i)=>{if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);});ctx.closePath();ctx.stroke();corners.forEach(([x,y],i)=>{ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();ctx.font=`bold ${Math.max(17,p.width/60)}px sans-serif`;ctx.fillText(String(i+1),x+r+4,y-5);});}
function onManualPoint(event){if(!manualMode)return;const c=event.currentTarget,rect=c.getBoundingClientRect(),x=(event.clientX-rect.left)*c.width/rect.width,y=(event.clientY-rect.top)*c.height/rect.height;manualCorners.push([x,y]);const order=['superior esquerdo','superior direito','inferior direito','inferior esquerdo'];if(manualCorners.length===4){manualMode=false;tryRead([...manualCorners]);el('cornerCount').textContent='Quatro pontos selecionados.';}else{showCornerPreview(manualCorners);el('cornerCount').textContent=`Marcado ${manualCorners.length}/4. Agora toque no quadrado ${order[manualCorners.length]}.`;}}
function manual(){if(!scanCanvas)return toast('Capture uma imagem primeiro.');manualMode=true;manualCorners=[];el('snapshotPreview').getContext('2d').drawImage(scanCanvas,0,0);el('cornerCount').textContent='1/4 — Toque no quadrado superior esquerdo.';toast('Selecione os quatro quadrados no sentido horário.');}
function showReview(){if(!proposed)return;const e=proposed.exam,answers=proposed.answers,correct=answers.filter((x,i)=>x===e.key[i]).length,students=db.students.filter(x=>x.classroomId===e.classroomId).sort((a,b)=>a.name.localeCompare(b.name,'pt-BR'));
 const options=students.map(s=>`<option value="${esc(s.id)}" ${s.id===proposed.studentId?'selected':''}>${esc(s.name)}${s.code?' · '+esc(s.code):''}</option>`).join('');
 const rows=answers.map((a,i)=>`<tr><td>${String(i+1).padStart(2,'0')}</td><td><select data-review="${i}" aria-label="Alternativa lida da questão ${i+1}"><option value="">Em branco / dúvida</option>${L.map(l=>`<option value="${l}" ${a===l?'selected':''}>${l}</option>`).join('')}</select></td><td>${e.key[i]}</td><td class="${!a?'ambiguous':a===e.key[i]?'correct':'incorrect'}">${!a?'Verificar':a===e.key[i]?'Correta':'Incorreta'}</td></tr>`).join('');
 el('reviewCard').innerHTML=`<article class="card" style="margin-top:17px"><div class="card-head"><h3>Confira antes de salvar</h3><span class="pill">AV${avOf(e)||'?'} · ${fmt(e.maxScore||10)} pts</span></div><p class="muted">Marcas fracas e questões duplas exigem conferência. Confira também o estudante selecionado no Diário.</p><div class="result-summary"><div><strong id="reviewHits">${correct}</strong><span>Acertos</span></div><div><strong id="reviewGrade">${fmt(grade(correct,e.count,e.maxScore))}</strong><span>Nota</span></div><div><strong id="reviewDoubts">${answers.filter(x=>!x).length}</strong><span>Sem leitura</span></div></div><div class="divider"></div><label class="field">Estudante da turma (obrigatório)<select id="resultStudent"><option value="">Selecione / confirme o estudante</option>${options}</select></label><p class="tiny">${proposed.studentId?'Estudante selecionado. Confira o nome acima.':'Confira o estudante antes de registrar.'}</p><div class="divider"></div><div class="table-scroller"><table class="review-grid"><thead><tr><th>Questão</th><th>Marcada</th><th>Correta</th><th>Situação</th></tr></thead><tbody>${rows}</tbody></table></div><div class="notice warn review-note">Questões em branco contam como não corretas. Se houver erro de leitura, altere a alternativa antes de salvar.</div><div class="actions" style="margin-top:20px">${btn('saveResult',`${icon('check')} Confirmar e salvar na AV${avOf(e)||''}`,'btn btn-primary')}${btn('manual','Ajustar cantos','btn')}</div></article>`;
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
  case 'pickClass':if(tab==='cadastros'){openClass31(id);break;}selectedClassId=id;render();break;
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
  case 'recognizeRoster':await recognizeRoster('all');break;
  case 'recognizeRosterPart':await recognizeRoster(node.dataset.part);break;
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

document.addEventListener('input',event=>{if(event.target?.id==='rosterCropLeft'||event.target?.id==='rosterCropRight')adjustRosterCrop();else if(event.target?.id==='rosterNames')rosterDraftNames();});

initialize();


/* Corrige+ (CAC) v2.9 — complemento para atas longas com linhas impressas.
 * Processamento local: fotos/PDF não são transmitidos ao Supabase.
 * Em PDF com camada de texto, extrai diretamente os nomes, sem OCR.
 * Em fotos ou PDF digitalizado, detecta linhas horizontais e lê em grupos.
 */
const oldRenderClasses29=renderClasses;
renderClasses=function(){
 let h=oldRenderClasses29();
 h=h.replace('Ler lista completa (em partes)','Ler os nomes por linhas');
 h=h.replace('<label class="field">Ou importar lista CSV',
  '<label class="field">Importar PDF original da ata (recomendado)'+
  '<input id="rosterPdf29" type="file" accept=".pdf,application/pdf" aria-label="Selecionar arquivo PDF da ata">'+
  '</label><p class="muted-note">O PDF com texto selecionável permite copiar somente os nomes sem fotografar a tela. Para PDF digitalizado, o aplicativo prepara uma imagem de maior resolução para o leitor. Confira os nomes antes de salvar.</p><label class="field">Ou importar lista CSV');
 h=h.replace('Se a foto for comprida, a leitura será dividida em trechos.',
  'O leitor tenta identificar cada linha da tabela; se não conseguir, continua dividindo a foto em trechos.');
 return h;
};

async function loadPdf29(){
 if(window.pdfjsLib)return window.pdfjsLib;
 await new Promise((resolve,reject)=>{
  const existing=document.querySelector('script[data-pdf29]');
  if(existing){if(existing.dataset.ready==='1')resolve();else{existing.addEventListener('load',resolve,{once:true});existing.addEventListener('error',()=>reject(Error('Falha ao carregar leitor de PDF.')),{once:true});}return;}
  const script=document.createElement('script');
  script.setAttribute('data-pdf29','1');
  script.src='https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js';
  script.onload=()=>{script.dataset.ready='1';resolve();};
  script.onerror=()=>reject(Error('Não foi possível carregar o leitor de PDF. Confira a conexão.'));
  document.head.appendChild(script);
 });
 if(!window.pdfjsLib)throw Error('O leitor de PDF não está disponível.');
 window.pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';
 return window.pdfjsLib;
}
function pdfPageNames29(items,pageWidth){
 // Agrupa itens da camada de texto pelas coordenadas da linha impressa.
 // A coluna Nome costuma ocupar o meio da página, entre matrícula e assinatura.
 const texts=(items||[]).filter(x=>String(x.str||'').trim()).map(x=>({str:String(x.str).trim(),x:Number(x.transform?.[4]||0),y:Number(x.transform?.[5]||0)}));
 const groups=[];
 for(const word of texts.sort((a,b)=>b.y-a.y||a.x-b.x)){
  let g=groups.find(g=>Math.abs(g.y-word.y)<4);
  if(!g){g={y:word.y,words:[]};groups.push(g);}
  g.words.push(word);
 }
 const result=[];
 for(const g of groups){
  const items=g.words.sort((a,b)=>a.x-b.x);
  // Descartar a coluna de matrículas (esquerda) e a de assinaturas (direita).
  const core=items.filter(w=>w.x>=pageWidth*.12&&w.x<pageWidth*.92);
  const candidates=[];
  for(const i of core)candidates.push(i.str);
  candidates.push(core.map(i=>i.str).join(' '));
  // Preferir o nome completo, se estiver fragmentado em vários itens.
  const parsed=[...new Set(candidates.flatMap(c=>extractRosterLines(c)))];
  if(parsed.length){parsed.sort((a,b)=>b.length-a.length);result.push(parsed[0]);}
 }
 return rosterDedup([],result);
}
async function importRosterPdf29(file){
 if(!file)return;
 if(!selectedClassId){toast('Selecione a turma primeiro.');return;}
 if(file.size>20*1024*1024){toast('Escolha um PDF com até 20 MB.');return;}
 if(rosterBusy)return;
 rosterDraftNames();
 rosterBusy=true;rosterUpdateProgress('Abrindo o PDF original…');render();
 let doc;
 try{
  const lib=await loadPdf29();
  doc=await lib.getDocument({data:new Uint8Array(await file.arrayBuffer())}).promise;
  if(doc.numPages>10)throw Error('O PDF tem mais de 10 páginas. Envie um PDF menor, contendo apenas a ata.');
  const found=[];let firstScanned=null;
  for(let i=1;i<=doc.numPages;i++){
   rosterUpdateProgress(`Lendo nomes no PDF: página ${i} de ${doc.numPages}…`);
   const page=await doc.getPage(i);const tx=await page.getTextContent();
   const width=page.getViewport({scale:1}).width;
   const pageNames=pdfPageNames29(tx.items,width);
   found.push(...pageNames);
   if(pageNames.length<3&&!firstScanned)firstScanned=page;
  }
  if(found.length>=5){
   const before=stagedNames.length;
   stagedNames=rosterDedup(stagedNames,found);
   rosterUpdateProgress(`${stagedNames.length} nomes na conferência: ${stagedNames.length-before} importados do texto do PDF. Revise a lista antes de confirmar.`);
   toast(`${stagedNames.length-before} novos nomes extraídos do PDF. Confira antes de salvar.`);
   render();return;
  }
  // PDF digitalizado: renderizar em alta resolução, sem perder nitidez em captura de tela.
  const page=firstScanned||await doc.getPage(1);
  const natural=page.getViewport({scale:1});
  const scale=Math.min(3.5,2400/natural.width,3000/natural.height);
  const viewport=page.getViewport({scale});
  const canvas=document.createElement('canvas');
  canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);
  await page.render({canvasContext:canvas.getContext('2d'),viewport}).promise;
  const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
  if(!blob)throw Error('Não consegui preparar a imagem do PDF.');
  rosterBusy=false;
  await readRosterPhoto(new File([blob],'ata-pdf-pagina.png',{type:'image/png'}));
  rosterUpdateProgress('PDF digitalizado: página preparada em resolução maior. Ajuste a coluna Nome e toque em “Ler os nomes por linhas”.');
  toast('O PDF não contém texto selecionável. Preparei a página como imagem para leitura.');
 }catch(error){rosterUpdateProgress('Não foi possível importar o PDF.');toast('PDF: '+(error.message||'tente outra fonte.'));}
 finally{rosterBusy=false;try{await doc?.destroy();}catch{}render();}
}

function detectTableRows29(image,sx,sw,begin,end){
 const rawTop=Math.max(0,Math.floor(begin*image.naturalHeight));
 const rawBottom=Math.min(image.naturalHeight,Math.ceil(end*image.naturalHeight));
 const width=Math.min(720,Math.max(1,Math.round(sw)));
 const height=Math.max(1,Math.round((rawBottom-rawTop)*width/sw));
 if(height>8000)return [];
 const c=document.createElement('canvas');c.width=width;c.height=height;
 const ctx=c.getContext('2d',{willReadFrequently:true});
 ctx.drawImage(image,sx,rawTop,sw,rawBottom-rawTop,0,0,width,height);
 const pix=ctx.getImageData(0,0,width,height).data;
 const ys=[];const step=3;
 const start=Math.round(width*.06),stop=Math.round(width*.94);
 for(let y=2;y<height-2;y++){
  let dark=0,seen=0;
  for(let x=start;x<stop;x+=step){
   const k=(y*width+x)*4;
   const a=pix[k],b=pix[k+1],d=pix[k+2];
   if((a+b+d)<630)dark++;
   seen++;
  }
  if(dark/Math.max(1,seen)>.50)ys.push(y);
 }
 c.width=1;c.height=1;
 if(ys.length<8)return [];
 const centers=[];let group=[ys[0]];
 for(let i=1;i<ys.length;i++){
  if(ys[i]-ys[i-1]<=3)group.push(ys[i]);
  else{centers.push(group.reduce((a,b)=>a+b,0)/group.length);group=[ys[i]];}
 }
 centers.push(group.reduce((a,b)=>a+b,0)/group.length);
 const rows=[];
 for(let i=0;i<centers.length-1;i++){
  const y0=centers[i],y1=centers[i+1];
  const h=y1-y0;
  // Ignora linhas demasiado próximas ou distantes; evita segmentar por texto.
  if(h<Math.max(10,width*.014)||h>Math.max(150,width*.28))continue;
  const from=rawTop+y0*(rawBottom-rawTop)/height;
  const to=rawTop+y1*(rawBottom-rawTop)/height;
  rows.push({from,to});
 }
 return rows.length>=8&&rows.length<=160?rows:[];
}
function drawRosterBatch29(img,sx,sw,rows){
 const scale=Math.max(1.6,Math.min(3.2,1750/Math.max(1,sw)));
 const w=Math.round(sw*scale)+32;
 const widths=rows.map(r=>Math.max(6,Math.round((r.to-r.from-4)*scale)+24));
 const total=widths.reduce((a,b)=>a+b,0);
 const can=document.createElement('canvas');can.width=w;can.height=total;
 const ctx=can.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,w,total);
 let y=0;
 for(let i=0;i<rows.length;i++){
  const row=rows[i],top=Math.round(row.from+2),height=Math.max(4,Math.round(row.to-row.from-4));
  ctx.filter='grayscale(1) contrast(1.7)';
  ctx.drawImage(img,sx,top,sw,height,16,y+12,Math.round(sw*scale),Math.round(height*scale));
  ctx.filter='none';y+=widths[i];
 }
 return can;
}
const oldRecognizeRoster29=recognizeRoster;
recognizeRoster=async function(part='all'){
 if(rosterBusy||!rosterPhotoUrl)return;
 const ranges={all:[0,1],top:[0,.43],middle:[.29,.73],bottom:[.61,1]};
 const [start,end]=ranges[part]||ranges.all;
 const img=new Image();
 try{await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=()=>reject(Error('Imagem inválida.'));img.src=rosterPhotoUrl;});}
 catch{return await oldRecognizeRoster29(part);}
 const sx=Math.round(img.naturalWidth*rosterColumnLeft/100);
 const sw=Math.round(img.naturalWidth*(rosterColumnRight-rosterColumnLeft)/100);
 const rows=detectTableRows29(img,sx,sw,start,end);
 if(!rows.length){return await oldRecognizeRoster29(part);}
 rosterDraftNames();
 rosterBusy=true;rosterUpdateProgress(`${rows.length} linhas da tabela detectadas. Lendo nomes…`);
 render();let worker;
 try{
  if(!window.Tesseract){await new Promise((resolve,reject)=>{
   const script=document.createElement('script');script.src='https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';
   script.onload=resolve;script.onerror=()=>reject(Error('Reconhecimento indisponível. Verifique a internet.'));
   document.head.appendChild(script);
  });}
  worker=await Tesseract.createWorker('por');
  const collected=[];const before=stagedNames.length;
  const chunkSize=6;
  for(let i=0;i<rows.length;i+=chunkSize){
   const partRows=rows.slice(i,i+chunkSize);
   rosterUpdateProgress(`Lendo linhas ${i+1}–${Math.min(i+chunkSize,rows.length)} de ${rows.length}…`);
   await worker.setParameters({tessedit_pageseg_mode:'6',preserve_interword_spaces:'0'});
   const batch=drawRosterBatch29(img,sx,sw,partRows);
   let found=[];
   try{const output=await worker.recognize(batch);found=extractRosterLines(output.data?.text||'');}
   catch(e){console.warn('OCR da tabela:',e);}
   batch.width=1;batch.height=1;
   // Se o OCR agrupado ignorou linhas, reforçar lendo cada célula isoladamente.
   if(found.length<Math.ceil(partRows.length*.85)){
    await worker.setParameters({tessedit_pageseg_mode:'7'});
    for(const row of partRows){
     const single=drawRosterBatch29(img,sx,sw,[row]);
     try{const output=await worker.recognize(single);found.push(...extractRosterLines(output.data?.text||''));}
     catch(e){console.warn('OCR linha:',e);}
     single.width=1;single.height=1;
    }
   }
   collected.push(...found);
  }
  stagedNames=rosterDedup(stagedNames,collected);
  const added=stagedNames.length-before;
  rosterUpdateProgress(`Foram detectadas ${rows.length} linhas da tabela e ${stagedNames.length} nomes estão na conferência. ${added} novos nomes nesta leitura. Confirme manualmente os nomes faltantes.`);
  toast(added?`${added} nomes adicionados. Confira a lista com a ata.`:'Nenhum nome novo. Use o PDF original ou outra foto.');
  if(!stagedNames.length)stagedNames=[''];
 }catch(error){
  rosterUpdateProgress('Leitura por linhas não concluída. Tente PDF, foto mais nítida ou CSV.');
  toast('Falha na leitura por linhas: '+(error.message||'tente outra imagem.'));
 }finally{
  if(worker)try{await worker.terminate();}catch{}
  rosterBusy=false;render();
 }
};

document.addEventListener('change',async function(e){
 if(e.target?.id==='rosterPdf29')await importRosterPdf29(e.target.files?.[0]);
});

const oldRenderHome29=renderHome;renderHome=function(){return oldRenderHome29().replace('Versão 2.6','Versão 2.9');};

/* Corrige+ (CAC) v3.0 — Cadastros separados, correção por estudante e PDFs compactos. */
let cadastroArea30='turmas';
let openedClass31='';
let selectedScanStudentId30='';
let selectedExamDiary30='';
const SCHOOL30='EREM CÔNEGO ALEXANDRE CAVALCANTI';
const LOGO30='data:image/png;base64,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';

// Uma área para cadastrar; outra para lançar, ler e consultar notas.
MENU.splice(0, MENU.length,
 ['home','Início','home'],
 ['cadastros','Cadastros','users'],
 ['exams','Atividades','file'],
 ['results','Diário','chart'],
 ['scan','Corrigir','scan']
);
const oldGo30=go;
go=function(where){openedClass31='';if(where==='classes'||where==='subjects'){cadastroArea30=where==='subjects'?'disciplinas':'turmas';where='cadastros';}if(tab==='scan'&&where!=='scan')selectedScanStudentId30='';oldGo30(where);};
const oldRender30=render;
render=function(){
 if(tab==='cadastros'){
  nav();el('pageTitle').textContent='Cadastros';el('view').innerHTML=renderCadastros30();return;
 }
 oldRender30();
 if(tab==='results')el('pageTitle').textContent='Diário de Notas';
 if(tab==='scan')el('pageTitle').textContent='Correção por estudante';
 if(tab==='exams')el('pageTitle').textContent='Atividades por trimestre';
};
function renderCadastros30(){
 if(cadastroArea30==='turmas'&&openedClass31&&db.classes.some(c=>c.id===openedClass31))return renderClass31(openedClass31);
 const section=cadastroArea30==='disciplinas' ? renderSubjects26():renderClasses();
 // Cadastro não é um segundo diário; evitar que duas tabelas de notas apareçam em áreas diferentes.
 const cutoff=section.indexOf('<section class="card grade-roster">');
 const clean=cutoff>=0?section.slice(0,cutoff):section;
 return `<div class="journal-heading"><span class="pill pill-green">ORGANIZAÇÃO DO PROFESSOR</span><h2>Cadastros</h2><p>Turmas, disciplinas e estudantes ficam neste espaço. Consulte e lance notas apenas no Diário.</p></div>
 <div class="cadastro-tabs" role="group" aria-label="Tipo de cadastro">
  ${btn('cadastroArea30','Turmas e estudantes',`cadastro-tab ${cadastroArea30==='turmas'?'active':''}`,`data-section="turmas" aria-pressed="${cadastroArea30==='turmas'}"`)}
  ${btn('cadastroArea30','Disciplinas',`cadastro-tab ${cadastroArea30==='disciplinas'?'active':''}`,`data-section="disciplinas" aria-pressed="${cadastroArea30==='disciplinas'}"`)}
 </div>${clean}`;
}
const oldRenderExams30=renderExams;
renderExams=function(){
 let h=oldRenderExams30();
 if(!creating){
  h=h.replaceAll('Cartões da turma','Cartões da turma (4/folha)')
   .replaceAll('Em branco','Imprimir 4 (A4)')
   .replaceAll('data-action="pickScan"','data-action="v30OpenDiary"')
   .replaceAll('> Corrigir</button>','> Selecionar estudante</button>');
  const container=document.createElement('div');container.innerHTML=h;
  container.querySelectorAll('[data-action="print"]').forEach(button=>{
    const pdf=document.createElement('button');pdf.type='button';pdf.dataset.action='v30CardsPdf';pdf.dataset.id=button.dataset.id;
    pdf.className='btn btn-sm';pdf.innerHTML=icon('download')+' Baixar PDF (4/folha)';button.after(pdf);
  });
  return container.innerHTML;
 }
 return h;
};
const oldRenderHome30=renderHome;
renderHome=function(){
 const content=oldRenderHome30();
 return content
 .replace('Fotografe a ata.<br>Corrija e registre as notas.','Cadastre, corrija e organize<br>as notas por trimestre.')
 .replace(/AV1 a AV5/g,'AT1 a AT5')
 .replace(/Versão 2\.[0-9]+/g,'Versão 3.0.1')
 .replace(/data-action="gotoClasses"/g,'data-action="v30GotoCadastros"')
 .replace(/<h2 class="section-title">O que deseja fazer\?<\/h2>/, '<h2 class="section-title">O que deseja fazer?</h2>')
 + `<div class="notice green" style="margin-top:20px"><strong>Fluxo de correção:</strong> abra o Diário, escolha a atividade, toque no <strong>nome do estudante</strong> e leia o cartão-resposta dele. O mesmo modelo de cartão serve para toda a turma.</div>`;
};

// A tabela continua editável. Agora o nome do aluno vira o acesso à leitura daquele cartão.
const oldRenderResults30=renderResults;
renderResults=function(){
 let h=oldRenderResults30();
 const cls=selectedClassId||db.classes[0]?.id||'';
 const exams=db.exams.filter(e=>e.classroomId===cls&&e.subjectId===selectedSubjectId&&trimester25(e)===trimester25Selected)
   .sort((a,b)=>C25.indexOf(code25(a))-C25.indexOf(code25(b)));
 if(!db.classes.length)return h;
 if(!exams.some(e=>e.id===selectedExamDiary30))selectedExamDiary30=exams[0]?.id||'';
 const select=exams.length?`<label class="field scan-exam-field">Atividade para leitura de cartões
 <select id="scanByStudentExam30">${exams.map(e=>`<option value="${esc(e.id)}" ${e.id===selectedExamDiary30?'selected':''}>${name25(code25(e))} · ${esc(e.name)} · ${fmt(e.maxScore)} pontos</option>`).join('')}</select></label>`:`<div class="notice warn">Nenhum gabarito cadastrado neste trimestre. Você pode lançar notas manualmente ou cadastrar uma atividade.</div>`;
 const studentHint=`<section class="card diary-scan-card"><div class="card-head"><h3>Correção por estudante</h3><span class="pill pill-green">1 gabarito oficial para todos</span></div><p>Escolha a atividade abaixo e depois toque no <strong>nome do estudante na tabela</strong> para abrir a câmera. Confira a nota e as questões erradas antes de salvar.</p>${select}</section>`;
 h=h.replace('<section class="card grade-roster">',`${studentHint}<section class="card grade-roster">`);
 const ss=db.students.filter(s=>s.classroomId===cls);
 for(const s of ss){
  const plain=`<strong>${esc(s.name)}</strong>`;
  const named=`<button type="button" class="student-scan-name" data-action="v30StudentScan" data-id="${esc(s.id)}" title="Ler cartão-resposta de ${esc(s.name)}">${esc(s.name)} <span aria-hidden="true">▣</span></button>`;
  h=h.replace(plain,named);
 }
 const pdfBtn=btn('v30ExportPDF',`${icon('download')} Diário em PDF`,'btn btn-primary');
 h=h.replace('<div class="toolbar"><p class="muted">Toque numa nota',`<div class="toolbar"><p class="muted">Toque numa nota`);
 h=h.replace('<div class="actions">'+btn('exportGrades',`${icon('download')} Exportar trimestre`,'btn btn-primary'),'<div class="actions">'+pdfBtn+btn('exportGrades',`${icon('download')} Exportar trimestre`,'btn'));
 return h;
};

const oldScan30=renderScan;
renderScan=function(){
 const active=db.students.find(s=>s.id===selectedScanStudentId30);
 let h=oldScan30();
 const e=db.exams.find(e=>e.id===scanExamId);
 const status=active&&e&&active.classroomId===e.classroomId?`<div class="notice green"><strong>Estudante selecionado:</strong> ${esc(active.name)}<br><strong>Turma:</strong> ${esc(className(e.classroomId))} · <strong>Disciplina:</strong> ${esc(subjectName26(e.subjectId))} · ${period25(trimester25(e))} · ${name25(code25(e))}</div>`:`<div class="notice warn">Antes de usar a câmera, abra o Diário e toque no nome do estudante. O aplicativo associará a nota a esse nome, não ao QR Code.</div>`;
 h=h.replace('<section class="stack">',`<section class="stack">${status}`)
 .replace('<select id="scanExam">',active?'<select id="scanExam" disabled aria-label="Atividade selecionada no Diário">':'<select id="scanExam">')
 .replace('O QR Code identifica a avaliação e o estudante. Confira a associação antes de registrar.','O professor seleciona o estudante antes da leitura. Se houver QR Code, ele identifica somente a avaliação, nunca o aluno.')
 .replace('Imprima os cartões individuais com QR Code.','Imprima quatro cartões idênticos por folha A4.')
 .replace('Fotografe o cartão e confira as marcações reconhecidas.','No Diário, toque no nome do estudante e fotografe seu cartão.')
 .replace('Confirme para salvar a nota na tabela da turma.','Confirme o estudante, as respostas e a nota antes de salvar.')
 .replace('Enquadre os quatro marcadores pretos e o QR Code.','Enquadre os quatro marcadores pretos do cartão.')
 .replace('QR Code, o nome e cada alternativa','estudante selecionado e cada alternativa');
 return h;
};
const oldTryRead30=tryRead;
tryRead=function(corners){
 const chosen=db.exams.find(e=>e.id===scanExamId);
 if(!selectedScanStudentId30 || !chosen || !db.students.some(s=>s.id===selectedScanStudentId30&&s.classroomId===chosen.classroomId)){
  const box=el('scanStatus');if(box)box.innerHTML='<div class="notice warn">Selecione primeiro o estudante no Diário de Notas e abra a câmera pelo nome dele.</div>';
  return;
 }
 const qr=scanCanvas?detectQR(scanCanvas):null;
 if(qr?.startsWith('CAC2|')&&qr.split('|')[1]!==chosen.id){
  const box=el('scanStatus');if(box)box.innerHTML='<div class="notice warn">O cartão parece pertencer a outra atividade. Confira o gabarito escolhido antes de continuar.</div>';
  return;
 }
 proposed=null;
 oldTryRead30(corners);
 if(proposed){
  if(proposed.exam.id!==chosen.id){proposed=null;return toast('Atividade do cartão diferente da atividade selecionada.');}
  proposed.studentId=selectedScanStudentId30;
  showReview();
  const status=el('scanStatus');if(status)status.innerHTML=`<div class="notice ${proposed.omr?.valid?'green':'warn'}">${proposed.omr?.valid?'Formato: '+esc(proposed.omr.layout)+'. ':'Não foi possível confirmar o formato do cartão. Ajuste os cantos ou tire outra foto. '}Respostas reconhecidas: ${proposed.answers.filter(Boolean).length}/${proposed.exam.count}. <strong>Estudante: ${esc(db.students.find(s=>s.id===selectedScanStudentId30)?.name||'')}</strong>. Confira as alternativas antes de registrar.</div>`;
 }
};
const oldSaveResult30=saveResult;
saveResult=async function(){
 if(!proposed || !selectedScanStudentId30)return toast('Selecione o estudante no Diário antes de registrar.');
 if(el('resultStudent')?.value!==selectedScanStudentId30)return toast('O nome selecionado não corresponde ao estudante do Diário. Confira antes de salvar.');
 const exam=proposed.exam;
 await oldSaveResult30();
 if(!proposed){selectedScanStudentId30='';selectedExamDiary30=exam.id;}
};

// Cartões idênticos: o QR identifica apenas a atividade, nunca o estudante.
// 4 cartões físicos em A4, mantendo os quatro marcadores para o leitor OMR.
printExam=function(id,all=false){
 const exam=db.exams.find(e=>e.id===id);if(!exam)return;
 const enrolled=db.students.filter(s=>s.classroomId===exam.classroomId).length;
 const count=all?Math.max(1,Math.min(100,enrolled)):4;
 const pages=Math.ceil(count/4);
 const svg=bubbleSVG(exam).replace('class="paper-svg"','class="paper-svg quarter-paper-svg"');
 const pagesHTML=[];
 for(let p=0;p<pages;p++){
  const cards=[];
  for(let slot=0;slot<4;slot++){
   if(p*4+slot>=count){cards.push('<div class="quarter-card blank-card"></div>');continue;}
   const qid=`exam-qr30-${p}-${slot}`;
   cards.push(`<article class="quarter-card"><div class="quarter-heading"><img class="quarter-logo" src="${LOGO30}" alt="Logomarca da escola"><div class="quarter-heading-txt"><strong>Corrige+ (CAC)</strong><small>${esc(exam.group)} · ${esc(subjectName26(exam.subjectId))}</small><small>${period25(trimester25(exam))} · ${name25(code25(exam))}</small></div><div id="${qid}" class="quarter-qr"></div></div><div class="quarter-name">Nome: ________________________________________</div>${svg}<div class="quarter-footer">Marque apenas uma alternativa por questão. Use caneta azul ou preta.</div></article>`);
  }
  pagesHTML.push(`<section class="print-page-v30">${cards.join('')}</section>`);
 }
 el('printRoot').innerHTML=pagesHTML.join('');
 for(let p=0;p<pages;p++)for(let slot=0;slot<4;slot++){
  if(p*4+slot>=count)continue;
  const q=el(`exam-qr30-${p}-${slot}`);
  if(typeof QRCode==='function')try{new QRCode(q,{text:`CAC2|${exam.id}|`,width:60,height:60,correctLevel:QRCode.CorrectLevel.M});}catch{q.textContent='AT';}
  else q.textContent='AT';
 }
 setTimeout(()=>window.print(),450);
};

// PDF verdadeiro do diário, em A4 paisagem e logomarca reduzida (1,5 cm).
async function exportDiaryPDF30(){
 const cls=selectedClassId||db.classes[0]?.id||'';
 if(!cls || !assigned26(cls,selectedSubjectId))return toast('Escolha uma turma e disciplina no Diário.');
 const students=db.students.filter(s=>s.classroomId===cls).sort((a,b)=>a.name.localeCompare(b.name,'pt-BR'));
 if(!students.length)return toast('Cadastre os estudantes antes de exportar o diário.');
 if(!await ensurePDFLibrary30())return printDiaryFallback30();
 const {jsPDF}=window.jspdf;
 const doc=new jsPDF({orientation:'landscape',unit:'mm',format:'a4',compress:true});
 const t=trimester25Selected,subject=subjectName26(selectedSubjectId),group=className(cls);
 const widths=[10,126,22,22,22,22,22,30];let xs=[10];for(const w of widths)xs.push(xs.at(-1)+w);
 const headerY=43,rowH=7.1;
 let page=0,y=headerY;
 const writeHeader=()=>{
  page++;doc.setFillColor(250,252,254);doc.rect(0,0,297,37,'F');
  try{doc.addImage(LOGO30,'PNG',11,7.5,15,15);}catch{}
  doc.setFont('helvetica','bold');doc.setTextColor(16,37,66);doc.setFontSize(13);doc.text(SCHOOL30,30,13.5);
  doc.setFontSize(10);doc.text(`DIÁRIO DE NOTAS — ${t}º TRIMESTRE`,30,20);
  doc.setFont('helvetica','normal');doc.setFontSize(9);doc.text(`Turma: ${group}     |     Disciplina: ${subject}     |     Ano: ${db.classes.find(c=>c.id===cls)?.year||new Date().getFullYear()}`,30,27);
  doc.setDrawColor(10,130,94);doc.setLineWidth(.65);doc.line(10,33.5,287,33.5);
  y=headerY;
  doc.setFillColor(17,42,75);doc.rect(10,y-5.3,276,9,'F');doc.setTextColor(255,255,255);doc.setFontSize(8.4);doc.setFont('helvetica','bold');
  const labels=['Nº','ESTUDANTE','AT1','AT2','AT3','AT4','AT5','AVALIAÇÃO'];
  labels.forEach((name,i)=>doc.text(name,xs[i]+(i===1?2:widths[i]/2),y,{align:i===1?'left':'center'}));
  y+=6.6;
 };
 writeHeader();
 const safeName=s=>{doc.setFontSize(8.7);let t=String(s);while(doc.getTextWidth(t)>120 && t.length>5)t=t.slice(0,-2)+'…';return t;};
 students.forEach((s,i)=>{
  if(y+rowH>197){doc.setFont('helvetica','normal');doc.setFontSize(7);doc.setTextColor(102,117,133);doc.text(`Página ${page}`,284,205,{align:'right'});doc.addPage('a4','landscape');writeHeader();}
  if(i%2===0){doc.setFillColor(244,247,251);doc.rect(10,y-4.7,276,rowH,'F');}
  doc.setDrawColor(224,231,239);doc.setLineWidth(.22);doc.line(10,y+2.3,286,y+2.3);
  doc.setFont('helvetica','normal');doc.setFontSize(8.7);doc.setTextColor(28,45,66);
  doc.text(String(i+1).padStart(2,'0'),xs[0]+widths[0]/2,y,{align:'center'});
  doc.text(safeName(s.name),xs[1]+2,y);
  C25.forEach((k,j)=>{const result=state25(s,t,k);const value=result.status==='GRADE'?fmt(result.score):result.status==='NC'?'NC':'—';doc.setFont('helvetica',result.status==='NC'?'bold':'normal');doc.text(value,xs[j+2]+widths[j+2]/2,y,{align:'center'});});
  y+=rowH;
 });
 doc.setFont('helvetica','normal');doc.setFontSize(7.6);doc.setTextColor(98,110,128);
 doc.text('NC = não realizou a atividade  |  — = nota ainda não lançada',11,205);
 doc.text(`Página ${page}`,284,205,{align:'right'});
 const safe=s=>String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^A-Za-z0-9_-]+/g,'_');
 const filename=`CorrigeCAC_${safe(group)}_${safe(subject)}_${t}Trimestre.pdf`;
 doc.save(filename);
 toast(`Diário em PDF gerado: ${students.length} estudantes.`);
}

document.addEventListener('click',async ev=>{
 const control=ev.target.closest('[data-action]');if(!control)return;
 const act=control.dataset.action;
 if(act==='cadastroArea30'){openedClass31='';cadastroArea30=control.dataset.section==='disciplinas'?'disciplinas':'turmas';render();}
 else if(act==='v30GotoCadastros'){cadastroArea30='turmas';go('cadastros');}
 else if(act==='v30ExportPDF'){await exportDiaryPDF30();}
 else if(act==='v30OpenDiary'){const e=db.exams.find(x=>x.id===control.dataset.id);if(e){selectedClassId=e.classroomId;selectedSubjectId=e.subjectId;trimester25Selected=trimester25(e);selectedExamDiary30=e.id;go('results');}}
 else if(act==='v30StudentScan'){
  const cls=selectedClassId||db.classes[0]?.id;
  const e=db.exams.find(x=>x.id===selectedExamDiary30);
  const s=db.students.find(x=>x.id===control.dataset.id);
  if(!s||!e||s.classroomId!==cls||e.classroomId!==cls||e.subjectId!==selectedSubjectId||trimester25(e)!==trimester25Selected){toast('Selecione primeiro uma atividade com gabarito neste Diário.');return;}
  selectedScanStudentId30=s.id;scanExamId=e.id;go('scan');
 }
 else if(act==='gotoClasses'){cadastroArea30='turmas';go('cadastros');}
 else if(act==='v26Subjects'){cadastroArea30='disciplinas';go('cadastros');}
 else if(act==='pickScan'){selectedScanStudentId30='';toast('Agora abra o Diário e toque no nome do estudante para iniciar a correção.');}
},true);
document.addEventListener('change',ev=>{
 if(ev.target?.id==='scanByStudentExam30'){selectedExamDiary30=ev.target.value;}
},true);

/* Impressão alternativa: salva o diário como PDF pelo menu de impressão do iPhone. */
function printDiaryFallback30(){
 const cls=selectedClassId||db.classes[0]?.id||'',t=trimester25Selected;
 const students=db.students.filter(s=>s.classroomId===cls).sort((a,b)=>a.name.localeCompare(b.name,'pt-BR'));
 if(!students.length)return toast('Nenhum estudante na turma.');
 const headers=['Nº','Estudante',...C25.map(name25)];
 const chunks=[];for(let i=0;i<students.length;i+=20)chunks.push(students.slice(i,i+20));
 el('printRoot').innerHTML=chunks.map((list,p)=>`<section class="print-diary-page"><header class="print-diary-head"><img src="${LOGO30}" alt="Logomarca"><div><h2>${SCHOOL30}</h2><strong>DIÁRIO DE NOTAS — ${t}º TRIMESTRE</strong><p>Turma: ${esc(className(cls))} · Disciplina: ${esc(subjectName26(selectedSubjectId))}</p></div></header><table class="print-diary-table"><thead><tr>${headers.map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${list.map((s,i)=>`<tr><td>${i+1+p*20}</td><td>${esc(s.name)}</td>${C25.map(k=>{const x=state25(s,t,k);return `<td>${x.status==='GRADE'?fmt(x.score):x.status==='NC'?'NC':'—'}</td>`;}).join('')}</tr>`).join('')}</tbody></table><footer>NC = não realizou · — = sem lançamento <span>Página ${p+1}/${chunks.length}</span></footer></section>`).join('');
 toast('Na impressão do Safari, use Compartilhar → Salvar em Arquivos para guardar o PDF.');
 setTimeout(()=>window.print(),300);
}
async function ensurePDFLibrary30(){
 if(window.jspdf?.jsPDF)return true;
 try{
  await new Promise((resolve,reject)=>{
   let s=document.querySelector('script[data-cac-jspdf]');
   if(s?.dataset.ready==='1'){resolve();return;}
   if(!s){s=document.createElement('script');s.dataset.cacJspdf='1';s.src='https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.2/jspdf.umd.min.js';s.onload=()=>{s.dataset.ready='1';resolve();};s.onerror=()=>reject(Error('Biblioteca indisponível'));document.head.appendChild(s);}
   else{s.addEventListener('load',resolve,{once:true});s.addEventListener('error',reject,{once:true});}
   setTimeout(()=>reject(Error('Tempo de carregamento excedido')),6000);
  });
 }catch{return false;}
 return !!window.jspdf?.jsPDF;
}

// Alternativa ao diálogo de impressão: baixar cartões idênticos diretamente em PDF.
async function cardGraphic30(exam){
 const content=bubbleSVG(exam);
 const blob=new Blob([content],{type:'image/svg+xml;charset=utf-8'}),url=URL.createObjectURL(blob);
 try{
  const img=new Image();await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=()=>reject(Error('Não foi possível desenhar o cartão.'));img.src=url;});
  const canvas=document.createElement('canvas');canvas.width=1200;canvas.height=1251;
  const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,1200,1251);ctx.drawImage(img,0,0,1200,1251);
  return canvas.toDataURL('image/png');
 }finally{URL.revokeObjectURL(url);}
}
async function exportCardsPDF30(id,all=false){
 const exam=db.exams.find(x=>x.id===id);if(!exam)return toast('Avaliação não encontrada.');
 if(!await ensurePDFLibrary30()){printExam(id,all);return toast('Gerador de download indisponível. Use a opção Imprimir → Salvar como PDF.');}
 let graphic;try{graphic=await cardGraphic30(exam);}catch(e){return toast(e.message);}
 const doc=new window.jspdf.jsPDF({orientation:'portrait',unit:'mm',format:'a4',compress:true});
 const count=all?Math.max(1,Math.min(100,db.students.filter(s=>s.classroomId===exam.classroomId).length)):4;
 const pages=Math.ceil(count/4);
 for(let p=0;p<pages;p++){
  if(p)doc.addPage('a4','portrait');
  for(let slot=0;slot<4;slot++){
   if(p*4+slot>=count)continue;
   const x=(slot%2)*105,y=Math.floor(slot/2)*148.5;
   doc.setDrawColor(215,218,223);doc.setLineWidth(.2);doc.rect(x+.25,y+.25,104.5,148);
   try{doc.addImage(LOGO30,'PNG',x+4,y+4.7,8,8);}catch{}
   doc.setTextColor(22,45,76);doc.setFont('helvetica','bold');doc.setFontSize(9.5);doc.text('Corrige+ (CAC)',x+15,y+8.3);
   doc.setTextColor(30,30,30);doc.setFont('helvetica','normal');doc.setFontSize(6.5);
   const group=className(exam.classroomId),subject=subjectName26(exam.subjectId);
   doc.text(doc.splitTextToSize(`${group} · ${subject}`,75)[0]||'',x+15,y+12.2);
   doc.text(`${period25(trimester25(exam))} · ${name25(code25(exam))}`,x+15,y+16);
   doc.setDrawColor(188);doc.line(x+4,y+20,x+101,y+20);
   doc.setFontSize(7.5);doc.setFont('helvetica','bold');doc.text('Nome: _____________________________________',x+7,y+26);
   doc.addImage(graphic,'PNG',x+8,y+31,89,93);
   doc.setFont('helvetica','normal');doc.setFontSize(6.2);doc.text('Marque uma única alternativa por questão.',x+52.5,y+132,{align:'center'});
  }
 }
 const slug=s=>String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9_-]+/g,'_');
 doc.save(`CorrigeCAC_Cartoes_${slug(className(exam.classroomId))}_${slug(code25(exam))}.pdf`);
 toast(`${count} cartões idênticos preparados em PDF (${pages} folha(s) A4).`);
}

document.addEventListener('click',async event=>{
 const node=event.target.closest('[data-action="v30CardsPdf"]');if(!node)return;
 await exportCardsPDF30(node.dataset.id,node.dataset.all==='1');
},true);

/* v3.0.1 — abertura explícita da turma, independente de disciplina ou diário. */
function openClass31(id){
 const c=db.classes.find(x=>x.id===id);if(!c)return toast('Turma não encontrada.');
 if(rosterBusy)return toast('Aguarde a leitura da ata antes de abrir a turma.');
 if((stagedNames.length||rosterPhotoUrl)&&selectedClassId!==id){toast('Confirme ou descarte a importação atual antes de trocar de turma.');return;}
 selectedClassId=id;openedClass31=id;cadastroArea30='turmas';render();
 window.scrollTo({top:0,behavior:'instant'});
}
function renderClass31(id){
 const c=db.classes.find(x=>x.id===id);if(!c)return '';
 const students=db.students.filter(s=>s.classroomId===id).slice().sort((a,b)=>a.name.localeCompare(b.name,'pt-BR'));
 return `<div class="journal-heading"><span class="pill pill-green">TURMA CADASTRADA</span><h2>${esc(c.name)}</h2><p>${[c.grade,c.shift,c.year].filter(Boolean).map(esc).join(' · ')} · ${students.length} estudantes</p></div>
 <div class="actions">${btn('v31BackClasses','← Voltar às turmas')}${btn('v31Diary','Abrir Diário de Notas','btn btn-primary')}${btn('v31Import','Importar nomes','btn')}</div>
 <section class="card stack" style="margin-top:16px"><div class="card-head"><div><h3>Estudantes cadastrados</h3><p class="muted">${students.length} estudante(s) nesta turma. As notas ficam no Diário.</p></div></div>
 ${students.length?`<div class="table-scroller"><table class="data-table"><thead><tr><th>Nº</th><th>Nome do estudante</th><th>Ações</th></tr></thead><tbody>${students.map((s,i)=>`<tr><td>${i+1}</td><td style="white-space:normal;overflow-wrap:anywhere"><strong>${esc(s.name)}</strong>${s.code?`<div class="muted">${esc(s.code)}</div>`:''}</td><td>${btn('deleteStudent',icon('trash'),'btn btn-danger btn-sm',`data-id="${esc(s.id)}" aria-label="Excluir ${esc(s.name)}"`)}</td></tr>`).join('')}</tbody></table></div>`:'<div class="notice">Nenhum estudante cadastrado. Importe a ata ou adicione um nome manualmente.</div>'}
 <details class="fallback"><summary>Adicionar estudante manualmente</summary><form id="studentForm" class="stack" style="margin-top:12px"><label class="field">Nome<input name="name" maxlength="100" required></label><label class="field">Número (opcional)<input name="code" maxlength="50"></label><button type="submit" class="btn btn-primary">Adicionar estudante</button></form></details></section>`;
}
document.addEventListener('click',ev=>{
 const action=ev.target.closest('[data-action]')?.dataset.action;
 if(!['v31BackClasses','v31Diary','v31Import'].includes(action))return;
 if(action==='v31Diary'){selectedClassId=openedClass31;ensureSubject26(selectedClassId);detailResultId='';selectedExamDiary30='';go('results');return;}
 openedClass31='';render();
 if(action==='v31Import')el('rosterClass')?.scrollIntoView({block:'center',behavior:'smooth'});
 else window.scrollTo({top:0,behavior:'instant'});
});

/* v3.0.2 — exportação integral antes da exclusão de turma. */
const home32=renderHome;
renderHome=function(){return home32().replace(/<section class="hero">[\s\S]*?<\/section>/,'').replace('Versão 3.0.1','Versão 3.0.4');};
const class32=renderClass31;
renderClass31=function(id){return class32(id).replace('</div>\n <section class="card stack"',`${btn('deleteClass',icon('trash')+' Apagar turma','btn btn-danger',`data-id="${esc(id)}"`)}</div>\n <section class="card stack"`);};
let deletePending32=false;
function chooseDelete32(c){return new Promise(resolve=>{
 const d=document.createElement('dialog');d.setAttribute('aria-label','Apagar turma');d.style.cssText='width:min(92vw,450px);max-height:85dvh;overflow:auto;border:1px solid #dce2e9;border-radius:20px;padding:22px;color:#17233c;background:#fff;box-shadow:0 20px 80px #0005';
 d.innerHTML=`<div class="stack"><h2 style="margin:0">Apagar turma?</h2><p><strong>${esc(c.name)}</strong></p><p>Todos os estudantes, atividades, notas e correções desta turma serão excluídos definitivamente. As outras turmas e o cadastro geral de disciplinas serão mantidos.</p><h3>Deseja exportar os dados antes?</h3><button type="button" class="btn btn-primary" data-choice="pdf">${icon('download')} Sim — exportar PDF</button><button type="button" class="btn btn-primary" data-choice="xlsx">${icon('download')} Sim — exportar Excel (.xlsx)</button><button type="button" class="btn btn-danger" data-choice="none">Não — apagar sem exportar</button><button type="button" class="btn" data-choice="cancel">Cancelar</button></div>`;
 const style=document.createElement('style');style.textContent='dialog::backdrop{background:rgba(13,25,44,.55)}';d.append(style);document.body.append(d);
 let done=false;const finish=v=>{if(done)return;done=true;d.close();d.remove();resolve(v);};d.addEventListener('click',e=>{const v=e.target.closest('[data-choice]')?.dataset.choice;if(v)finish(v);});d.addEventListener('cancel',e=>{e.preventDefault();finish('cancel');});d.showModal();
 });}
function classSnapshot32(id){const students=db.students.filter(s=>s.classroomId===id),exams=db.exams.filter(e=>e.classroomId===id),eids=new Set(exams.map(e=>e.id));return {c:db.classes.find(c=>c.id===id),students,exams,results:db.results.filter(r=>eids.has(r.examId)),grades:db.gradeEntries.filter(g=>g.classroomId===id),links:db.classSubjects.filter(a=>a.classroomId===id),subjects:db.subjects};}
async function cloudSnapshot32(id){
 const teacher=user.id;
 async function all(table,field,value){let out=[];for(let i=0;;i+=500){let q=client.from(table).select('*').eq('teacher_id',teacher).order('id').range(i,i+499);q=Array.isArray(value)?q.in(field,value):q.eq(field,value);const {data,error}=await q;if(error)throw Error(error.message);out.push(...data);if(data.length<500)return out;}}
 const [cs,ss,ee,gg,ll,subs]=await Promise.all([all('cac_classrooms','id',id),all('cac_students','classroom_id',id),all('cac_exams','classroom_id',id),all('cac_grade_entries','classroom_id',id),all('cac_classroom_subjects','classroom_id',id),all('cac_subjects','teacher_id',teacher)]);
 if(!cs.length)throw Error('Turma não encontrada na conta.');let rr=[];for(let i=0;i<ee.length;i+=50)rr.push(...await all('cac_results','exam_id',ee.slice(i,i+50).map(e=>e.id)));
 return {c:cs[0],students:ss.map(x=>({id:x.id,name:x.name,code:x.code,created:x.created_at})),exams:ee.map(x=>({id:x.id,name:x.name,subjectId:x.subject_id,trimester:x.trimester,avSlot:x.av_slot,assessmentKind:x.assessment_kind,count:x.question_count,key:x.answer_key,maxScore:x.max_score,created:x.created_at})),results:rr.map(x=>({id:x.id,examId:x.exam_id,studentId:x.student_id,student:x.student_name,studentCode:x.student_code,answers:x.answers,hits:x.hits,score:x.score,count:x.question_count,created:x.created_at})),grades:gg.map(x=>({id:x.id,studentId:x.student_id,subjectId:x.subject_id,trimester:x.trimester,columnCode:x.column_code,status:x.status,score:x.score,created:x.created_at})),links:ll.map(x=>({subjectId:x.subject_id})),subjects:subs};
}
function backupTables32(s){
 const students=[...s.students].sort((a,b)=>a.name.localeCompare(b.name,'pt-BR')),subName=id=>s.subjects.find(x=>x.id===id)?.name||'Sem disciplina',studentName=id=>students.find(x=>x.id===id)?.name||'',exam=id=>s.exams.find(x=>x.id===id),subjectIds=[...new Set([...s.links,...s.exams,...s.grades].map(x=>x.subjectId))],answer=a=>Array.isArray(a)?a.map(x=>x??'-').join(' '):String(a??'');
 const tables=[{name:'Turma',headers:['Campo','Valor'],rows:[['Turma',s.c.name],['Série',s.c.grade||''],['Turno',s.c.shift||''],['Ano',s.c.year||''],['Estudantes',students.length],['Disciplinas',subjectIds.map(subName).join(', ')],['Exportado em',new Date().toLocaleString('pt-BR')]]},{name:'Estudantes',headers:['Nº','Nome','Código / matrícula'],rows:students.map((x,i)=>[i+1,x.name,x.code||''])}];
 for(const sid of subjectIds)for(const t of [1,2,3])tables.push({name:`${subName(sid)} - ${t}º tri`,headers:['Nº','Estudante','AT1','AT2','AT3','AT4','AT5','Avaliação'],rows:students.map((x,i)=>[i+1,x.name,...C25.map(k=>{const g=s.grades.find(g=>g.studentId===x.id&&g.subjectId===sid&&Number(g.trimester)===t&&g.columnCode===k);if(g)return g.status==='NC'?'NC':g.status==='GRADE'?Number(g.score):'';const e=s.exams.find(e=>e.subjectId===sid&&trimester25(e)===t&&code25(e)===k);const r=e?s.results.filter(r=>r.examId===e.id&&r.studentId===x.id).sort((a,b)=>new Date(b.created)-new Date(a.created))[0]:null;return r?Number(r.score):'';})])});
 tables.push({name:'Atividades',headers:['Disciplina','Trimestre','Atividade','Título','Valor','Questões','Gabarito'],rows:s.exams.map(e=>[subName(e.subjectId),trimester25(e),name25(code25(e)),e.name,Number(e.maxScore||10),Number(e.count),answer(e.key)])},{name:'Correções',headers:['Estudante','Disciplina','Trimestre','Atividade','Acertos','Nota','Respostas','Data'],rows:s.results.map(r=>{const e=exam(r.examId);return [studentName(r.studentId)||r.student||'',subName(e?.subjectId),trimester25(e),e?.name||'',Number(r.hits),Number(r.score),answer(r.answers),r.created||''];})},{name:'Notas manuais',headers:['Estudante','Disciplina','Trimestre','Atividade','Situação','Nota'],rows:s.grades.map(g=>[studentName(g.studentId),subName(g.subjectId),Number(g.trimester),name25(g.columnCode),g.status==='NC'?'NC':g.status==='GRADE'?'Nota':'Sem nota',g.score==null?'':Number(g.score)])});return tables;
}
function download32(blob,filename){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=filename;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);}
function xlsx32(tables){
 const xml=s=>String(s??'').replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g,'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
 const hdr='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',main='http://schemas.openxmlformats.org/spreadsheetml/2006/main',rel='http://schemas.openxmlformats.org/officeDocument/2006/relationships',pkg='http://schemas.openxmlformats.org/package/2006/relationships';
 const files={},used=new Set();const names=tables.map((t,i)=>{let n=t.name.replace(/[\\/:*?\[\]]/g,' ').replace(/^'+|'+$/g,'').slice(0,31)||'Planilha';if(used.has(n.toLowerCase()))n=n.slice(0,25)+' '+(i+1);used.add(n.toLowerCase());return n;});
 files['[Content_Types].xml']=hdr+`<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${tables.map((_,i)=>`<Override PartName="/xl/worksheets/sheet${i+1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`;
 files['_rels/.rels']=hdr+`<Relationships xmlns="${pkg}"><Relationship Id="rId1" Type="${rel}/officeDocument" Target="xl/workbook.xml"/></Relationships>`;
 files['xl/workbook.xml']=hdr+`<workbook xmlns="${main}" xmlns:r="${rel}"><sheets>${names.map((n,i)=>`<sheet name="${xml(n)}" sheetId="${i+1}" r:id="rId${i+1}"/>`).join('')}</sheets></workbook>`;
 files['xl/_rels/workbook.xml.rels']=hdr+`<Relationships xmlns="${pkg}">${tables.map((_,i)=>`<Relationship Id="rId${i+1}" Type="${rel}/worksheet" Target="worksheets/sheet${i+1}.xml"/>`).join('')}</Relationships>`;
 tables.forEach((t,i)=>{const rows=[t.headers,...t.rows];files[`xl/worksheets/sheet${i+1}.xml`]=hdr+`<worksheet xmlns="${main}"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>${t.headers.map((h,j)=>`<col min="${j+1}" max="${j+1}" width="${/nome|estudante|título|valor|respostas|gabarito/i.test(h)?36:18}" customWidth="1"/>`).join('')}</cols><sheetData>${rows.map((r,y)=>`<row r="${y+1}">${r.map((v,x)=>{const ref=String.fromCharCode(65+x)+(y+1);return typeof v==='number'&&Number.isFinite(v)?`<c r="${ref}"><v>${v}</v></c>`:`<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${xml(v)}</t></is></c>`;}).join('')}</row>`).join('')}</sheetData><autoFilter ref="A1:${String.fromCharCode(64+t.headers.length)}${rows.length}"/></worksheet>`;});
 const enc=new TextEncoder(),local=[],central=[];let pos=0,centralSize=0;const buf=n=>new Uint8Array(n),u16=(b,p,v)=>new DataView(b.buffer).setUint16(p,v,true),u32=(b,p,v)=>new DataView(b.buffer).setUint32(p,v>>>0,true),crc=b=>{let c=0xffffffff;for(const v of b){c^=v;for(let j=0;j<8;j++)c=(c>>>1)^((c&1)?0xedb88320:0);}return (c^0xffffffff)>>>0;};
 for(const [name,content] of Object.entries(files)){const n=enc.encode(name),b=enc.encode(content),c=crc(b),h=buf(30),z=buf(46);u32(h,0,0x04034b50);u16(h,4,20);u32(h,14,c);u32(h,18,b.length);u32(h,22,b.length);u16(h,26,n.length);u32(z,0,0x02014b50);u16(z,4,20);u16(z,6,20);u32(z,16,c);u32(z,20,b.length);u32(z,24,b.length);u16(z,28,n.length);u32(z,42,pos);local.push(h,n,b);central.push(z,n);pos+=h.length+n.length+b.length;centralSize+=z.length+n.length;}
 const end=buf(22),count=Object.keys(files).length;u32(end,0,0x06054b50);u16(end,8,count);u16(end,10,count);u32(end,12,centralSize);u32(end,16,pos);return new Blob([...local,...central,end],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
}
async function pdf32(tables,c){
 if(!await ensurePDFLibrary30())throw Error('Gerador de PDF indisponível. Verifique a conexão ou escolha Excel.');
 const doc=new window.jspdf.jsPDF({orientation:'landscape',unit:'mm',format:'a4',compress:true});let first=true;
 for(const t of tables){let y=0;const w=t.headers.map(h=>/estudante|nome|título|respostas|gabarito|valor/i.test(h)?2.3:1),sum=w.reduce((a,b)=>a+b,0),widths=w.map(x=>277*x/sum);const start=()=>{if(!first)doc.addPage();first=false;try{doc.addImage(LOGO30,'PNG',10,6,13,13);}catch{}doc.setTextColor(16,37,66);doc.setFont('helvetica','bold');doc.setFontSize(12);doc.text(SCHOOL30,27,11);doc.setFontSize(10);doc.text(`Turma: ${c.name} | ${c.year||''} — ${t.name}`,27,17,{maxWidth:255});doc.setFontSize(8);doc.setFillColor(17,42,75);doc.rect(10,24,277,8,'F');doc.setTextColor(255);let x=10;t.headers.forEach((v,i)=>{doc.text(String(v),x+2,29,{maxWidth:widths[i]-4});x+=widths[i];});doc.setTextColor(25,35,50);doc.setFont('helvetica','normal');y=35;};start();
 for(const [idx,row] of t.rows.entries()){doc.setFontSize(8);const lines=row.map((v,i)=>doc.splitTextToSize(String(v??'')||'—',widths[i]-4));const h=Math.max(7,...lines.map(l=>l.length*3.5+3));if(y+h>195)start();if(idx%2===0){doc.setFillColor(244,247,251);doc.rect(10,y-2,277,h,'F');}let x=10;lines.forEach((v,i)=>{doc.text(v,x+2,y+2);x+=widths[i];});y+=h;}
 if(!t.rows.length)doc.text('Nenhum registro.',12,y+3);
 }
 const total=doc.getNumberOfPages();for(let i=1;i<=total;i++){doc.setPage(i);doc.setFontSize(8);doc.setTextColor(90);doc.text('NC = não realizou | — = sem registro',10,204);doc.text(`${i}/${total}`,287,204,{align:'right'});}return doc.output('blob');
}
function purgeLocal32(id){const s=classSnapshot32(id),eids=new Set(s.exams.map(e=>e.id)),sids=new Set(s.students.map(x=>x.id));db.results=db.results.filter(r=>!eids.has(r.examId)&&!sids.has(r.studentId));db.gradeEntries=db.gradeEntries.filter(g=>g.classroomId!==id&&!sids.has(g.studentId));db.students=db.students.filter(s=>s.classroomId!==id);db.exams=db.exams.filter(e=>e.classroomId!==id);db.classSubjects=db.classSubjects.filter(a=>a.classroomId!==id);db.classes=db.classes.filter(c=>c.id!==id);}
deleteClass=async function(id){
 if(deletePending32)return;const c=db.classes.find(x=>x.id===id);if(!c)return;if(rosterBusy)return toast('Aguarde a importação dos estudantes.');deletePending32=true;
 try{const choice=await chooseDelete32(c);if(choice==='cancel')return;
  if(choice!=='none'){const s=mode==='cloud'?await cloudSnapshot32(id):classSnapshot32(id),tables=backupTables32(s),blob=choice==='pdf'?await pdf32(tables,s.c):xlsx32(tables);const filename='CorrigeCAC_Turma_'+String(c.name).replace(/[^\p{L}\p{N}_-]+/gu,'_')+'_'+(c.year||'')+'.'+choice;download32(blob,filename);if(!await confirmExport33(c))return;}
  // A escolha explícita 'apagar sem exportar' já confirma a exclusão.
  statusDelete33('Excluindo a turma e seus registros…');
  if(mode==='cloud'){
   // Exclusão transacional, com RLS e validação do professor autenticado.
   const {data,error}=await client.rpc('cac_delete_classroom_complete',{p_classroom_id:id});if(error)throw Error(error.message);if(data!==true)throw Error('Exclusão não confirmada pelo servidor.');
  }
  closeDeleteStatus33();purgeLocal32(id);if(openedClass31===id)openedClass31='';if(selectedClassId===id){selectedClassId=db.classes[0]?.id||'';stagedNames=[];rosterPhotoUrl='';rosterProgress='';}if(!db.exams.some(e=>e.id===scanExamId))scanExamId='';selectedScanStudentId30='';selectedExamDiary30='';grade25Editing=null;detailResultId='';ensureSubject26(selectedClassId);persistDemo();render();toast('Turma e registros vinculados excluídos.');
 }catch(e){closeDeleteStatus33();await showDeleteError33(e);}finally{closeDeleteStatus33();deletePending32=false;}
};

/* v3.0.3 — confirmações internas, sem dependência de window.confirm no Safari. */
let deleteStatus33=null;
function deleteDialog33(title,message,buttons){
 const d=document.createElement('dialog');d.setAttribute('aria-label',title);d.style.cssText='width:min(88vw,420px);max-height:85dvh;overflow:auto;border:1px solid #dce2e9;border-radius:18px;padding:22px;color:#17233c;background:#fff;box-shadow:0 20px 80px #0005';
 d.innerHTML=`<style>dialog::backdrop{background:rgba(13,25,44,.55)}</style><div style="display:grid;gap:14px"><h2 style="margin:0">${esc(title)}</h2><p style="margin:0;overflow-wrap:anywhere">${esc(message)}</p>${buttons.map(b=>`<button type="button" class="btn ${b.danger?'btn-danger':''}" data-answer="${esc(b.value)}">${esc(b.label)}</button>`).join('')}</div>`;
 document.body.append(d);return d;
}
function askDelete33(title,message,buttons){return new Promise(resolve=>{const d=deleteDialog33(title,message,buttons);let done=false;const finish=v=>{if(done)return;done=true;d.close();d.remove();resolve(v);};d.addEventListener('click',e=>{const b=e.target.closest('[data-answer]');if(b)finish(b.dataset.answer);});d.addEventListener('cancel',e=>{e.preventDefault();finish('cancel');});d.showModal();});}
function confirmExport33(c){return askDelete33('Arquivo preparado','Salve e confira o arquivo antes de excluir definitivamente a turma '+c.name+'.',[{value:'delete',label:'Arquivo salvo — apagar turma',danger:true},{value:'cancel',label:'Cancelar e manter turma'}]).then(v=>v==='delete');}
function statusDelete33(message){closeDeleteStatus33();deleteStatus33=deleteDialog33('Excluindo turma',message,[]);deleteStatus33.addEventListener('cancel',e=>e.preventDefault());deleteStatus33.showModal();}
function closeDeleteStatus33(){if(deleteStatus33){deleteStatus33.close();deleteStatus33.remove();deleteStatus33=null;}}
function showDeleteError33(e){return askDelete33('Não foi possível excluir a turma',String(e?.message||e)+' — Verifique a conexão e tente novamente.',[{value:'ok',label:'Fechar'}]);}

/* v3.0.4 — leitura de cartões em uma ou duas colunas, com contraste local. */
function omrLayouts34(n){
 const layouts=[];
 const make=(name,rows,x1,x2,dx,y0,dy,r)=>({name,r,centers:Array.from({length:n},(_,q)=>Array.from({length:5},(_,j)=>[(q<rows?x1:x2)+j*dx,y0+(q%rows)*dy]))});
 layouts.push(make('Original',Math.ceil(n/(n>15?2:1)),175,555,37,118,45,12));
 if(n===10)layouts.push(make('Duas colunas de cinco',5,158,500,55.3,108,101.5,17));
 return layouts;
}
function readBubbles34(c,e,H){
 const {data}=c.getContext('2d',{willReadFrequently:true}).getImageData(0,0,c.width,c.height),w=c.width,h=c.height;
 const gray=(x,y)=>{const p=mapPoint(H,x,y);return grayAt(data,w,h,p[0],p[1]);};
 const mean=a=>a.reduce((s,v)=>s+v,0)/a.length;
 const median=a=>{const s=a.slice().sort((x,y)=>x-y);return s[Math.floor(s.length/2)];};
 const ring=(x,y,r,mult)=>Array.from({length:24},(_,k)=>{const a=k*Math.PI/12;return gray(x+r*mult*Math.cos(a),y+r*mult*Math.sin(a));});
 const measure=(x,y,r)=>{
  const bg=median(ring(x,y,r,1.44)),norm=Math.max(85,bg);
  const outline=mean([.88,1,1.12].map(m=>mean(ring(x,y,r,m))));
  const inner=[];for(let iy=-4;iy<=4;iy++)for(let ix=-4;ix<=4;ix++)if(ix*ix+iy*iy<=16)inner.push(gray(x+ix*r*.16,y+iy*r*.16));
  const ink=Math.max(0,(bg-mean(inner))/norm);
  return {outline:Math.max(0,(bg-outline)/norm),ink,bg};
 };
 const candidates=omrLayouts34(Number(e.count)).map(layout=>{
  let best=null;
  for(const ox of [-3,0,3])for(const oy of [-3,0,3]){
   const centers=layout.centers.map(row=>row.map(([x,y])=>[x+ox,y+oy]));
   const measurements=centers.map(row=>row.map(([x,y])=>measure(x,y,layout.r)));
   const outlines=measurements.flat().map(v=>v.outline);
   const score=median(outlines)*.7+mean(outlines)*.3;
   if(!best||score>best.score)best={...layout,centers,measurements,score};
  }return best;
 }).sort((a,b)=>b.score-a.score);
 const best=candidates[0];
 const valid=best.score>=.09 && (candidates.length===1||best.score-candidates[1].score>=.035);
 const confidence=best.measurements.map(row=>row.map(v=>v.ink));
 const answers=confidence.map(levels=>{
  if(!valid)return '';
  const [first,second]=levels.map((v,i)=>({v,i})).sort((a,b)=>b.v-a.v);
  return first.v>=.22&&first.v-second.v>=.14&&second.v<Math.max(.20,first.v*.54)?L[first.i]:'';
 });
 return {answers,confidence,centers:best.centers,r:best.r,layout:best.name,valid,score:best.score,layoutScores:candidates.map(v=>[v.name,v.score])};
}

// Mostra no cartão a posição de cada marcação reconhecida, sem alterar a fotografia original.
const previewBefore34=showCornerPreview;
showCornerPreview=function(corners){
 previewBefore34(corners);
 const p=el('snapshotPreview'),read=proposed?.omr;
 if(!p||!read?.valid)return;
 const H=homography(POINTS,corners);if(!H)return;
 const ctx=p.getContext('2d');ctx.save();ctx.lineWidth=Math.max(1.5,p.width/420);
 read.centers.forEach((row,q)=>{
  const j=L.indexOf(read.answers[q]);if(j<0)return;
  const [x,y]=row[j];ctx.strokeStyle='#16d47b';ctx.beginPath();
  for(let k=0;k<=32;k++){const a=k*Math.PI/16;const pt=mapPoint(H,x+read.r*1.18*Math.cos(a),y+read.r*1.18*Math.sin(a));if(k===0)ctx.moveTo(...pt);else ctx.lineTo(...pt);}
  ctx.closePath();ctx.stroke();
 });ctx.restore();
};
