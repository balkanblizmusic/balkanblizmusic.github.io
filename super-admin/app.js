const $=id=>document.getElementById(id);
const config=window.BLIZ_CONFIG||{};
const state={session:null,role:null,busy:false,page:0,search:'',deleted:false,historyPage:0};
const sessionKey='bliz-new-session';
try{state.session=JSON.parse(sessionStorage.getItem(sessionKey)||'null');}catch{}
class ApiError extends Error{constructor(message,status){super(message);this.status=status;}}
function notice(text,error=false){$('notice').textContent=text;$('notice').classList.toggle('error',error);$('notice').hidden=!text;}
function saveSession(session){state.session=session;if(session)sessionStorage.setItem(sessionKey,JSON.stringify(session));else sessionStorage.removeItem(sessionKey);}
function node(tag,text,cls){const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;}
function button(text,action,cls='quiet'){const n=node('button',text,cls);n.type='button';n.addEventListener('click',()=>guard(action));return n;}
function date(value){return value?new Date(value).toLocaleString():'—';}
function setupReady(){return (!!config.publishableKey)&&(/^https:\/\/[a-z0-9]+\.supabase\.co$/.test(config.supabaseUrl||'')||(['localhost','127.0.0.1'].includes(location.hostname)&&/^http:\/\/127\.0\.0\.1:\d+$/.test(config.supabaseUrl||'')));}
async function api(path,{method='POST',body,auth=true}={}){
 if(!setupReady())throw Error('Новата база сè уште не е поврзана. Потребни се URL и publishable key од новиот проект.');
 const headers={apikey:config.publishableKey,'Content-Type':'application/json'};
 if(auth)headers.Authorization='Bearer '+await token();
 const response=await fetch(config.supabaseUrl+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body)});
 const data=await response.json().catch(()=>({}));
 if(!response.ok)throw new ApiError(data.message||data.msg||data.error_description||data.error||'Барањето не успеа.',response.status);
 return data;
}
let refreshing;
async function token(){
 if(!state.session)throw Error('Најави се повторно.');
 if(state.session.expires_at>Date.now()/1000+60)return state.session.access_token;
 if(!refreshing)refreshing=api('/auth/v1/token?grant_type=refresh_token',{auth:false,body:{refresh_token:state.session.refresh_token}})
 .then(data=>{saveSession({...data,expires_at:Date.now()/1000+data.expires_in});return data.access_token;})
 .catch(error=>{if(error.status===400||error.status===401){saveSession(null);showLogin();}throw error;}).finally(()=>refreshing=null);
 return refreshing;
}
const rpc=(name,params={})=>api('/rest/v1/rpc/'+name,{body:params});
async function guard(action){
 if(state.busy)return;state.busy=true;document.querySelectorAll('button').forEach(b=>b.disabled=true);
 try{await action();}catch(error){notice(error.message,true);}
 finally{state.busy=false;document.querySelectorAll('button').forEach(b=>b.disabled=b.dataset.disabled==='true');}
}
function pendingKey(){return 'bliz-pending:'+state.session.user.id;}
function pending(){try{return JSON.parse(sessionStorage.getItem(pendingKey())||'null');}catch{return null;}}
async function paidRequest(name,params){
 let request=pending();
 if(request&&(request.name!==name||JSON.stringify(request.params)!==JSON.stringify(params)))throw Error('Има непотврдено барање. Прво притисни „Повтори го непотврденото барање“.');
 if(!request){request={name,params,id:crypto.randomUUID()};sessionStorage.setItem(pendingKey(),JSON.stringify(request));}
 try{const answer=await rpc(name,{...params,p_request_id:request.id});sessionStorage.removeItem(pendingKey());return answer;}
 catch(error){if(error.status===400||error.status===403)sessionStorage.removeItem(pendingKey());else notice('Исходот не е потврден. Повтори го истото барање за да нема двојна наплата.',true);throw error;}
}
function showLogin(){state.role=null;$('creditBalance').hidden=true;$('creditBalance').textContent='';$('login').hidden=false;$('recovery').hidden=true;$('workspace').hidden=true;$('nav').hidden=true;$('logout').hidden=true;$('account').textContent='';$('content').replaceChildren();}
async function enter(){
 const session=await rpc('bliz_session');state.role=session.role;
 $('login').hidden=true;$('recovery').hidden=true;$('workspace').hidden=false;$('nav').hidden=false;$('logout').hidden=false;
 $('account').textContent=state.session.user.email;
 document.querySelectorAll('[data-admin]').forEach(n=>n.hidden=state.role!=='admin');
 await render();
}
$('loginForm').addEventListener('submit',event=>{event.preventDefault();guard(async()=>{
 const data=await api('/auth/v1/token?grant_type=password',{auth:false,body:{email:$('email').value.trim(),password:$('password').value}});
 saveSession({...data,expires_at:Date.now()/1000+data.expires_in});$('password').value='';
 try{await enter();notice('');}catch(error){saveSession(null);showLogin();throw error;}
});});
$('logout').addEventListener('click',()=>guard(async()=>{try{await api('/auth/v1/logout');}finally{saveSession(null);showLogin();notice('Одјавен си.');}}));
$('forgot').addEventListener('click',()=>guard(async()=>{
 const email=$('email').value.trim();if(!email)throw Error('Прво внеси го твојот емаил.');
 await api('/auth/v1/recover?redirect_to='+encodeURIComponent(location.origin+location.pathname),{auth:false,body:{email}});
 notice('Ако емаилот е регистриран, ќе добиеш линк. Провери Inbox и Spam.');
}));
$('passwordForm').addEventListener('submit',event=>{event.preventDefault();guard(async()=>{
 if($('newPassword').value!==$('confirmPassword').value)throw Error('Лозинките не се исти.');
 await api('/auth/v1/user',{method:'PUT',body:{password:$('newPassword').value}});
 $('newPassword').value='';$('confirmPassword').value='';await enter();notice('Лозинката е зачувана.');
});});
window.addEventListener('hashchange',()=>{state.page=0;state.historyPage=0;if(state.role)guard(render);});
function table(headers){const wrap=node('div',undefined,'table-wrap'),t=node('table'),head=node('thead'),r=node('tr'),body=node('tbody');headers.forEach(text=>r.append(node('th',text)));head.append(r);t.append(head,body);wrap.append(t);return {wrap,body};}
function cell(row,value){row.append(node('td',value??'—'));}
function empty(body,count){const row=node('tr'),c=node('td','Нема записи.','empty');c.colSpan=count;row.append(c);body.append(row);}
function card(title){const c=node('section',undefined,'card');if(title)c.append(node('h2',title));return c;}
function codeQR(code){
 const box=node('div',undefined,'qr-code');
 const qr=window.qrcode(0,'M');qr.addData(code);qr.make();
 const count=qr.getModuleCount(),scale=6,margin=4;
 const canvas=node('canvas');canvas.width=canvas.height=(count+margin*2)*scale;
 canvas.setAttribute('role','img');canvas.setAttribute('aria-label','QR за активациски код '+code);
 const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.fillStyle='#000';
 for(let y=0;y<count;y++)for(let x=0;x<count;x++)if(qr.isDark(y,x))ctx.fillRect((x+margin)*scale,(y+margin)*scale,scale,scale);
 box.append(canvas,node('small','QR содржи само активациски код.'));
 box.append(button('Преземи QR',async()=>{const a=node('a');a.href=canvas.toDataURL('image/png');a.download='BLiZ-TV-'+code+'.png';a.click();}));
 return box;
}
function generated(code){const c=node('div',undefined,'generated');c.append(node('small','АКТИВАЦИСКИ КОД'),node('strong',code,'code'),button('Копирај',async()=>{await navigator.clipboard.writeText(code);notice('Кодот е копиран.');}),codeQR(code));return c;}
async function render(){
 if(state.role==='reseller'){const balance=await rpc('bliz_session');$('creditBalance').textContent=balance.credits+' кредити';$('creditBalance').hidden=false;}else{$('creditBalance').hidden=true;}

 const requested=location.hash.slice(1)||'codes';const route=state.role==='admin'?requested:['codes','history'].includes(requested)?requested:'codes';
 const titles={codes:'Активациски кодови',resellers:'Реселери',credits:'Кредити',devices:'Уреди · MAC / ID',history:'Историја на кредити'};
 $('pageTitle').textContent=titles[route]||titles.codes;
 document.querySelectorAll('nav a').forEach(a=>a.setAttribute('aria-current',a.hash==='#'+route?'page':'false'));
 $('content').replaceChildren();
 if(pending())$('content').append(button('Повтори го непотврденото барање',async()=>{
  const request=pending();if(!request)return;
  const answer=await paidRequest(request.name,request.params);await render();notice('Барањето е потврдено.');
  if(answer.activation_code)$('content').prepend(generated(answer.activation_code));
 }));
 if(route==='resellers')await resellersView();else if(route==='credits')await creditsView();else if(route==='devices')await devicesView();else if(route==='history')await historyView();else await codesView();
}
async function codesView(){
 const c=card('Создај активациски код'),actions=node('div',undefined,'row');
 for(const [type,label]of[['test','TEST · 24 часа'],['yearly','YEARLY · 365 дена'],['lifetime','LIFETIME']])actions.append(button(label,async()=>{
  if(!confirm('Создај '+label+'?'+(state.role==='reseller'?' Цена: '+({test:0,yearly:1,lifetime:2}[type])+' кредити.':'')))return;
  const answer=await paidRequest('bliz_generate_code',{p_type:type});await render();$('content').prepend(generated(answer.activation_code));notice('Кодот е создаден. Рокот започнува при првата активација.');
 }));c.append(actions,node('p','TEST кодовите траат 24 часа од активацијата. Реселерите имаат лимит од 20 TEST кодови дневно (UTC).','muted'));$('content').append(c);
 if(state.role==='admin')$('content').append(button('Избриши истечени кодови',async()=>{
  if(!confirm('Тргни ги сите кодови со поминат рок од листата? Активните, неактивираните кодови и историјата на кредити се зачувуваат.'))return;
  const answer=await rpc('bliz_admin_delete_expired');state.page=0;await render();notice('Избришани истечени кодови: '+answer.deleted+'.');
 },'danger'));
 const search=node('form',undefined,'toolbar'),input=node('input');input.placeholder='Пребарај код или клиент';input.setAttribute('aria-label','Пребарај код или клиент');input.value=state.search;const submit=node('button','Пребарај');search.append(input,submit);
 search.addEventListener('submit',event=>{event.preventDefault();guard(async()=>{state.search=input.value.trim();state.page=0;await render();});});$('content').append(search);
 const data=await rpc('bliz_codes',{p_search:state.search,p_page:state.page}),grid=node('div',undefined,'grid');
 for(const code of data.codes){
  const item=card(),status=code.is_paused?'Паузиран':!code.is_used?'Неактивиран':code.expires_at&&Date.parse(code.expires_at)<=Date.now()?'Истечен':'Активиран';
  item.append(node('span',status,'pill'+(status==='Паузиран'||status==='Истечен'?' off':'')),node('strong',code.activation_code,'code'),node('p',code.code_type.toUpperCase()+' · '+(code.reseller_name||'Super Admin'),'muted'),node('small','Создаден: '+date(code.created_at)),node('p','Активиран: '+date(code.activated_at)+' · Рок: '+(code.expires_at?date(code.expires_at):code.is_used?'Неограничено':'Почнува при активација'),'muted'));
  item.append(button('Копирај код',async()=>{await navigator.clipboard.writeText(code.activation_code);notice('Кодот е копиран.');}));
  const qrHost=node('div');item.append(button('Прикажи QR',async()=>{if(qrHost.childNodes.length)qrHost.replaceChildren();else qrHost.append(codeQR(code.activation_code));}),qrHost);
  if(state.role==='admin'){
   const form=node('form');form.innerHTML='<label>Клиент<input name="client" maxlength="120"></label><label>Приватна белешка<textarea name="note" maxlength="1000"></textarea></label><label><span>Паузирај активација</span><input name="paused" type="checkbox"></label><button>Зачувај</button>';
   form.elements.client.value=code.customer_name;form.elements.note.value=code.admin_note;form.elements.paused.checked=code.is_paused;
   form.addEventListener('submit',event=>{event.preventDefault();guard(async()=>{await rpc('bliz_admin_code_update',{p_id:code.id,p_name:form.elements.client.value,p_note:form.elements.note.value,p_paused:form.elements.paused.checked});await render();notice('Клиентот е зачуван.');});});item.append(form);
  }else if(code.customer_name)item.append(node('p',code.customer_name));grid.append(item);
 }
 if(!data.codes.length)grid.append(node('p','Нема кодови.','empty'));$('content').append(grid);
 const pager=node('div',undefined,'row'),back=button('← Назад',async()=>{state.page--;await render();}),next=button('Следна →',async()=>{state.page++;await render();});
 back.dataset.disabled=String(state.page===0);back.disabled=state.page===0;next.dataset.disabled=String((state.page+1)*50>=data.total);next.disabled=(state.page+1)*50>=data.total;
 pager.append(back,node('small',data.total+' кодови · Страница '+(state.page+1)),next);$('content').append(pager);
}
async function resellersView(){
 const tools=node('div',undefined,'toolbar'),select=node('select');select.setAttribute('aria-label','Преглед на реселери');select.innerHTML='<option value="active">Реселери</option><option value="deleted">Избришани</option>';select.value=state.deleted?'deleted':'active';
 select.addEventListener('change',()=>guard(async()=>{state.deleted=select.value==='deleted';await render();}));tools.append(select,button('Освежи',render));$('content').append(tools);
 const data=await rpc('bliz_admin_resellers',{p_deleted:state.deleted});const c=card(data.resellers.length+' реселери'),t=table(['Реселер','Емаил','Кредити','Статус','Создаден','Дејства']);
 for(const r of data.resellers){const row=node('tr');[r.reseller_name,r.email,r.credits,r.deleted_at?'Избришан':r.is_active?'Активен':'Неактивен',date(r.created_at)].forEach(v=>cell(row,v));const actions=node('td',undefined,'actions');
  for(const [action,label]of r.deleted_at?[['restore','Врати како неактивен']]:[[r.is_active?'disable':'enable',r.is_active?'Оневозможи':'Овозможи'],['delete','Избриши']])actions.append(button(label,async()=>{
   if(!confirm(label+' — '+r.reseller_name+' ('+r.email+')?'+(action==='delete'?'\nСе зачувуваат клиентските кодови, кредитите и историјата. Реселерот може да се врати од „Избришани“.':'')))return;
   await rpc('bliz_admin_reseller_status',{p_id:r.id,p_action:action});await render();notice('Промената е зачувана.');
  },action==='delete'?'danger':'quiet'));row.append(actions);t.body.append(row);}
 if(!data.resellers.length)empty(t.body,6);c.append(t.wrap);$('content').append(c);
 const invite=card('Нов реселер'),form=node('form');form.innerHTML='<label>Име<input name="resellerName" required maxlength="120"></label><label>Емаил<input name="resellerEmail" type="email" required></label><button>Создај реселер и испрати покана</button>';
 form.addEventListener('submit',event=>{event.preventDefault();guard(async()=>{
  const email=form.elements.resellerEmail.value.trim(),name=form.elements.resellerName.value.trim();
  if(!confirm('Создај реселер '+name+' и испрати покана на '+email+'?'))return;
  const answer=await api('/functions/v1/bliz-admin',{body:{action:'invite_reseller',email,name}});await render();notice(answer.invited?'Реселерот е создаден и поканата е испратена.':'Постојниот корисник е поврзан како реселер. Може да се најави со постојната лозинка.');
 });});invite.append(form);$('content').append(invite);
}
async function creditsView(){
 const data=await rpc('bliz_admin_resellers'),c=card('Додај или одземи кредити'),form=node('form');
 form.innerHTML='<label>Реселер<select name="reseller" required></select></label><label>Износ<input name="amount" type="number" min="-100000" max="100000" step="1" required placeholder="10 или -10"></label><label>Причина<input name="reason" minlength="3" maxlength="200" required></label><button>Зачувај промена</button>';
 for(const r of data.resellers){const option=node('option',r.reseller_name+' ('+r.email+') — '+r.credits+' кредити');option.value=r.id;form.elements.reseller.append(option);}
 form.addEventListener('submit',event=>{event.preventDefault();guard(async()=>{
  const params={p_id:form.elements.reseller.value,p_amount:Number(form.elements.amount.value),p_reason:form.elements.reason.value.trim()};
  if(!params.p_amount||!Number.isSafeInteger(params.p_amount))throw Error('Внеси цел број различен од нула.');
  if(!confirm('Промени '+params.p_amount+' кредити за '+form.elements.reseller.selectedOptions[0].textContent+'?'))return;
  const result=await paidRequest('bliz_admin_credits',params);await render();notice('Новото салдо е '+result.credits+' кредити.');
 });});c.append(form);$('content').append(c);
}
async function historyView(){
 const data=await rpc('bliz_history',{p_page:state.historyPage}),c=card('Историја на кредити'),t=table(['Датум','Реселер','Износ','Ново салдо','Причина','Код']);
 data.history.forEach(h=>{const row=node('tr');[date(h.created_at),h.reseller_name,h.amount>0?'+'+h.amount:h.amount,h.balance_after,h.reason,h.activation_code].forEach(v=>cell(row,v));t.body.append(row);});if(!data.history.length)empty(t.body,6);c.append(t.wrap);$('content').append(c);
 const row=node('div',undefined,'row');if(state.historyPage>0)row.append(button('← Назад',async()=>{state.historyPage--;await render();}));if(data.history.length===50)row.append(button('Следна →',async()=>{state.historyPage++;await render();}));$('content').append(row);
}
async function devicesView(){
 const data=await rpc('bliz_panel_list'),c=card('MAC / ID уреди'),t=table(['Клиент','MAC / ID','Листа','Статус','Рок','Последно поврзување','Дејства']);
 const edit=node('div');
 $('content').append(node('p','Прво отвори ја BLiZ TV апликацијата со интернет за да се регистрира MAC / ID, па додај го уредот тука.','muted'),button('Освежи уреди',render),button('Додај уред',async()=>deviceForm(edit)),edit);
 for(const d of data.devices){const row=node('tr');[d.name,d.mac,d.source_type,d.enabled?'Активен':'Паузиран',date(d.expires_at),date(d.last_seen)].forEach(v=>cell(row,v));const actions=node('td');actions.append(button('Уреди',async()=>deviceForm(edit,d)));row.append(actions);t.body.append(row);}
 if(!data.devices.length)empty(t.body,7);c.append(t.wrap);$('content').append(c);
}
function deviceForm(host,d){
 host.replaceChildren();const c=card(d?'Уреди уред':'Нов уред'),form=node('form');
 form.innerHTML='<label>Име<input name="clientName" required maxlength="120"></label><label>MAC / ID<input name="mac" required placeholder="02:AA:BB:CC:DD:EE"></label><label>Рок (локално време, празно = без рок)<input name="expiry" type="datetime-local"></label><label>Тип на листа<select name="sourceType"><option value="">Задржи постојна / без нова листа</option><option value="m3u">M3U</option><option value="xtream">Xtream</option></select></label><label>URL на новата листа<input name="url" type="url"></label><label>Xtream корисник<input name="username" autocomplete="off"></label><label>Xtream лозинка<input name="sourcePassword" type="password" autocomplete="off"></label><label>Овозможен<input name="enabled" type="checkbox" checked></label><label>Отстрани ја постојната листа<input name="clear" type="checkbox"></label><button>Зачувај уред</button>';
 const macInput=form.elements.mac;
 macInput.maxLength=17;macInput.autocomplete='off';macInput.spellcheck=false;
 macInput.addEventListener('input',()=>{
  const caret=macInput.selectionStart??macInput.value.length;
  const digitsBefore=macInput.value.slice(0,caret).replace(/[^a-fA-F0-9]/g,'').length;
  const hex=macInput.value.replace(/[^a-fA-F0-9]/g,'').slice(0,12).toUpperCase();
  macInput.value=(hex.match(/.{1,2}/g)||[]).join(':');
  const position=Math.min(macInput.value.length,digitsBefore+Math.floor(Math.max(0,digitsBefore-1)/2));
  macInput.setSelectionRange(position,position);
 });
 if(d){form.elements.clientName.value=d.name;form.elements.mac.value=d.mac;form.elements.mac.readOnly=true;form.elements.enabled.checked=!!d.enabled;if(d.expires_at){const time=new Date(d.expires_at);form.elements.expiry.value=new Date(time-time.getTimezoneOffset()*60000).toISOString().slice(0,16);}}
 form.addEventListener('submit',event=>{event.preventDefault();guard(async()=>{
  const f=form.elements;if(f.clear.checked&&f.sourceType.value)throw Error('Избери нова листа или отстранување на постојната.');
  const device={action:d?'update':'create',mac:f.mac.value.trim().toUpperCase(),name:f.clientName.value.trim(),enabled:f.enabled.checked,expires_at:f.expiry.value?new Date(f.expiry.value).toISOString():null};
  if(d)device.revision=d.revision;if(f.clear.checked)device.clear_source=true;
  if(f.sourceType.value){const url=new URL(f.url.value.trim());if(!['http:','https:'].includes(url.protocol)||url.username||url.password)throw Error('Потребен е HTTP/HTTPS URL без вградени credentials.');device.source={type:f.sourceType.value,url:url.href};if(f.sourceType.value==='xtream'){device.source.username=f.username.value.trim();device.source.password=f.sourcePassword.value;}}
  await rpc('bliz_panel_save',{p_device:device});await render();notice('Уредот е зачуван.');
 });});c.append(form,button('Откажи',async()=>host.replaceChildren()));host.append(c);passwordToggles(c);c.scrollIntoView({block:'start'});
}
async function boot(){
 const hash=new URLSearchParams(location.hash.slice(1)),query=new URLSearchParams(location.search);
 if(hash.has('access_token')){
  const access=hash.get('access_token'),refresh=hash.get('refresh_token'),type=hash.get('type');
  history.replaceState(null,'',location.pathname);
  const response=await fetch(config.supabaseUrl+'/auth/v1/user',{headers:{apikey:config.publishableKey,Authorization:'Bearer '+access}});
  if(!response.ok)throw Error('Линкот е невалиден или истечен.');
  saveSession({access_token:access,refresh_token:refresh,expires_at:Date.now()/1000+Number(hash.get('expires_in')||3600),user:await response.json()});
  if(type==='invite'||type==='recovery'){$('login').hidden=true;$('recovery').hidden=false;return;}
 }
 if(hash.has('error_description')){const message=hash.get('error_description');history.replaceState(null,'',location.pathname);throw Error(message);}
 if(query.has('error_description')){const message=query.get('error_description');history.replaceState(null,'',location.pathname);throw Error(message);}
 if(!setupReady()){notice('Новата база сè уште не е поврзана. Оваа верзија е подготвена за инсталација.',true);return;}
 if(state.session)await enter();
}
boot().catch(error=>{showLogin();notice(error.message,true);});

function passwordToggles(host=document){host.querySelectorAll('input[type="password"]').forEach(input=>{
 const toggle=button('Прикажи лозинка',async()=>{const visible=input.type==='password';input.type=visible?'text':'password';toggle.textContent=visible?'Скриј лозинка':'Прикажи лозинка';toggle.setAttribute('aria-pressed',String(visible));});
 toggle.setAttribute('aria-pressed','false');input.insertAdjacentElement('afterend',toggle);
});}passwordToggles();
