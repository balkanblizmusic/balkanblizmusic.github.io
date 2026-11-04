(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory;else root.BlizPairCodec=factory(root.nacl);})(typeof window!=='undefined'?window:this,function(nacl){
 'use strict';
 function hex(bytes){return Array.prototype.map.call(bytes,function(x){return ('0'+x.toString(16)).slice(-2);}).join('');}
 function unhex(text){if(!/^[a-f0-9]+$/.test(text)||text.length%2)throw Error('Invalid pairing data');var out=new Uint8Array(text.length/2);for(var i=0;i<out.length;i++)out[i]=parseInt(text.slice(i*2,i*2+2),16);return out;}
 function utf8(text){var value=unescape(encodeURIComponent(text)),out=new Uint8Array(value.length);for(var i=0;i<value.length;i++)out[i]=value.charCodeAt(i);return out;}
 function text(bytes){return decodeURIComponent(escape(String.fromCharCode.apply(null,bytes)));}
 function b64(bytes){return btoa(String.fromCharCode.apply(null,bytes));}
 function unb64(value){if(typeof value!=='string'||value.length>16384)throw Error('Invalid pairing data');var s=atob(value),out=new Uint8Array(s.length);for(var i=0;i<s.length;i++)out[i]=s.charCodeAt(i);return out;}
 function validate(value){if(!value||['xtream','m3u','direct'].indexOf(value.type)<0||typeof value.url!=='string'||value.url.length>4096||!/^https?:\/\//i.test(value.url))throw Error('Invalid source URL');var u=new URL(value.url);if(u.username||u.password)throw Error('Do not put login credentials in the URL authority');if(value.type==='xtream'&&(!value.username||!value.password))throw Error('Username and password are required');if(String(value.username||'').length>256||String(value.password||'').length>1024)throw Error('Source details are too long');return {type:value.type,url:value.url,username:value.type==='xtream'?String(value.username):'',password:value.type==='xtream'?String(value.password):''};}
 function create(){return {id:hex(nacl.randomBytes(16)),read:hex(nacl.randomBytes(32)),write:hex(nacl.randomBytes(32)),key:hex(nacl.randomBytes(32))};}
 function encrypt(value,key){var nonce=nacl.randomBytes(nacl.secretbox.nonceLength);return {nonce:b64(nonce),cipher:b64(nacl.secretbox(utf8(JSON.stringify(validate(value))),nonce,unhex(key)))};}
 function decrypt(value,key){var opened=nacl.secretbox.open(unb64(value.cipher),unb64(value.nonce),unhex(key));if(!opened)throw Error('Pairing verification failed');return validate(JSON.parse(text(opened)));}
 function fragment(pair,lang){return new URLSearchParams({id:pair.id,write:pair.write,key:pair.key,lang:lang||'mk'}).toString();}
 function parse(fragment){var p=new URLSearchParams(fragment.replace(/^#/,'')),value={id:p.get('id'),write:p.get('write'),key:p.get('key'),lang:p.get('lang')||'mk'};if(!/^[a-f0-9]{32}$/.test(value.id)||!/^[a-f0-9]{64}$/.test(value.write)||!/^[a-f0-9]{64}$/.test(value.key))throw Error('Invalid or missing pairing link');return value;}
 return {create:create,encrypt:encrypt,decrypt:decrypt,fragment:fragment,parse:parse,validate:validate};
});
