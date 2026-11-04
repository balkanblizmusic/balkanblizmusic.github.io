export const WHATSAPP_NUMBER='420776282242';
export const periods={'test':'TEST · 24 часа','1':'1 месец','3':'3 месеци','6':'6 месеци','12':'1 година · 12 месеци','24':'2 години · 24 месеци'};
export function formatMac(value){return (String(value).replace(/[^a-f0-9]/gi,'').slice(0,12).toUpperCase().match(/.{1,2}/g)||[]).join(':');}
export function orderMessage(order){
 if(!periods[order.period])throw Error('Избери валиден период.');
 if(!order.channels.length&&!order.vod.length)throw Error('Одбери барем една категорија.');
 const clean=v=>String(v||'').replace(/\r/g,'').trim();
 return [order.period==='test'?'BLiZ TV — Барање за бесплатен TEST':'BLiZ TV — Барање за претплата','',`Период: ${periods[order.period]}`,order.period==='test'?'Цена: бесплатен 24-часовен тест':'Цена: по потврда',`Тип: ${clean(order.type)}`,`Уред: ${clean(order.device)}`,`Име: ${clean(order.name)}`,...(order.email?[`Е-пошта: ${clean(order.email)}`]:[]),...(order.mac?[`MAC / ID: ${formatMac(order.mac)}`]:[]),'',`КАНАЛИ (${order.channels.length} категории):`,order.channels.length?order.channels.join(', '):'Без избор','',`MOVIES & SERIES (${order.vod.length} категории):`,order.vod.length?order.vod.join(', '):'Без избор',...(order.note?['',`Забелешка: ${clean(order.note)}`]:[]),'',order.period==='test'?'Ве молам потврдете достапност и начин на активација на тестот.':'Ве молам потврдете цена, достапност и начин на активација.'].join('\n');
}
export function whatsappUrl(message){return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;}
