import {periods,formatMac,orderMessage,whatsappUrl} from './checkout-core.mjs';
const $=id=>document.getElementById(id),form=$('orderForm'),selected={channels:new Set(),vod:new Set()};
let categories=null,message='',rendered=[];
$('year').textContent=new Date().getFullYear();
const requestedPeriod=new URLSearchParams(location.search).get('period');
const initialPeriod=Object.hasOwn(periods,requestedPeriod)?requestedPeriod:'1';
for(const value of ['test','1','3','6','12','24']){
 const label=periods[value];
 const box=document.createElement('label');box.className='plan';const input=document.createElement('input');input.type='radio';input.name='period';input.value=value;input.checked=value===initialPeriod;input.required=true;input.setAttribute('aria-label',label);const strong=document.createElement('strong');strong.textContent=value==='test'?'TEST':value;const small=document.createElement('small');small.textContent=value==='test'?'24 часа':value==='1'?'месец':'месеци';box.append(input,strong,small);$('plans').append(box);
}
function invalidate(){message='';$('fallback').hidden=true;$('status').textContent='';$('selectionError').hidden=true;}
function summary(){
 $('channelsCount').textContent=selected.channels.size;$('vodCount').textContent=selected.vod.size;$('summaryChannels').textContent=selected.channels.size;$('summaryVod').textContent=selected.vod.size;
 $('periodSummary').textContent=periods[new FormData(form).get('period')];
 const isTest=new FormData(form).get('period')==='test';
 $('priceSummary').textContent=isTest?'Бесплатен тест':'По потврда';
 $('priceNote').textContent=isTest?'Побарај 24-часовен тест. Достапноста и активацијата ќе ги потврдиме на WhatsApp.':'Ќе ја потврдиме на WhatsApp, пред активација.';
 const preview=$('chosenPreview');preview.replaceChildren();
 if(!selected.channels.size&&!selected.vod.size)preview.textContent='Твоите избрани категории ќе се појават тука.';
 else for(const [key,title] of [['channels','Канали'],['vod','VOD']])if(selected[key].size){const p=document.createElement('div'),label=document.createElement('span');label.textContent=title+': ';p.append(label,document.createTextNode([...selected[key]].join(' · ')));preview.append(p);}
 invalidate();
}
function renderCategories(){
 for(const key of ['channels','vod'])for(const [index,name] of categories[key].entries()){
  const label=document.createElement('label');label.className='category';const input=document.createElement('input');input.type='checkbox';input.id=`${key}-${index}`;input.checked=selected[key].has(name);input.addEventListener('change',()=>{input.checked?selected[key].add(name):selected[key].delete(name);summary();});const text=document.createElement('span');text.textContent=name;label.append(input,text);$(key+'List').append(label);rendered.push({key,name,label,input});
 }
}
$('sendOrder').disabled=true;
fetch('categories.json').then(r=>{if(!r.ok)throw Error('Категориите не се вчитаа. Освежи ја страницата.');return r.json();}).then(data=>{if(!Array.isArray(data.channels)||!Array.isArray(data.vod))throw Error('Неважечки категории.');categories=data;renderCategories();$('sendOrder').disabled=false;}).catch(e=>{$('loadError').textContent=e.message;$('loadError').hidden=false;});
$('search').addEventListener('input',()=>{const term=$('search').value.toLocaleLowerCase().trim(),visible={channels:0,vod:0};for(const row of rendered){row.label.hidden=!row.name.toLocaleLowerCase().includes(term);if(!row.label.hidden)visible[row.key]++;}for(const key of ['channels','vod'])$(key+'Empty').hidden=visible[key]>0;});
document.querySelectorAll('[data-clear]').forEach(button=>button.addEventListener('click',()=>{const key=button.dataset.clear;selected[key].clear();for(const row of rendered)if(row.key===key)row.input.checked=false;summary();}));
form.addEventListener('input',event=>{if(event.target.id==='mac')event.target.value=formatMac(event.target.value);if(event.target.id!=='search')invalidate();});
form.addEventListener('change',summary);
form.addEventListener('submit',event=>{
 event.preventDefault();if(!categories)return;
 if(!selected.channels.size&&!selected.vod.size){$('selectionError').hidden=false;$('selectionError').scrollIntoView({behavior:'smooth',block:'center'});return;}
 const values=Object.fromEntries(new FormData(form));
 try{message=orderMessage({...values,channels:categories.channels.filter(name=>selected.channels.has(name)),vod:categories.vod.filter(name=>selected.vod.has(name))});}catch(error){$('status').textContent=error.message;return;}
 const url=whatsappUrl(message);$('whatsappFallback').href=url;$('messagePreview').value=message;$('fallback').hidden=false;
 $('status').textContent='Пораката е подготвена. За да ја добиеме нарачката, притисни „Испрати“ во WhatsApp.';
 window.open(url,'_blank','noopener,noreferrer');
});
$('copyOrder').addEventListener('click',async()=>{if(!message)return;try{await navigator.clipboard.writeText(message);$('status').textContent='Изборот е копиран. Залепи го во WhatsApp и испрати го на +420 776 282 242.';}catch{$('messagePreview').focus();$('messagePreview').select();$('status').textContent='Означи ја и копирај ја пораката подолу.';}});
summary();
