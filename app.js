const API="https://que-me-llevo-api.berbel83.workers.dev";
const $=s=>document.querySelector(s);
let analysis=null, answers={}, items=[];
function show(id){["start","loading","clarify","invalid","result"].forEach(x=>$("#"+x).classList.toggle("hidden",x!==id))}
document.querySelectorAll("[data-example]").forEach(b=>b.onclick=()=>$("#trip").value=b.dataset.example);

async function callAI(payload){
 const r=await fetch(API,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});
 const text=await r.text(); if(!r.ok)throw new Error(text||"Error de conexión");
 try{return JSON.parse(text)}catch{throw new Error("Respuesta inesperada")}
}
$("#analyze").onclick=async()=>{
 const trip=$("#trip").value.trim();if(!trip)return err("Cuéntame primero tu viaje o plan.");
 $("#startError").classList.add("hidden");show("loading");
 try{
  analysis=await callAI({trip});
  if(!analysis.valid){$("#invalidText").textContent=analysis.interpretation||"No hemos podido interpretar este viaje.";$("#invalidWarnings").innerHTML=(analysis.warnings||[]).map(w=>`<div class="warning">⚠️ ${w}</div>`).join("");show("invalid");return}
  renderQuestions();
 }catch(e){show("start");err("No hemos podido analizar el viaje. Inténtalo de nuevo en unos segundos.");console.error(e)}
};
function err(t){$("#startError").textContent=t;$("#startError").classList.remove("hidden")}
function renderQuestions(){
 $("#interpretation").textContent=analysis.interpretation||"Tu viaje";
 $("#warnings").innerHTML=(analysis.warnings||[]).map(w=>`<div class="warning">⚠️ ${w}</div>`).join("");
 const qs=analysis.questions||[];
 $("#questions").innerHTML=qs.length?qs.map((q,i)=>`<section class="card question" data-q="${q.id}"><h3>${q.question}</h3>${renderInput(q,i)}</section>`).join(""):`<section class="card"><p>Ya tenemos suficiente información para preparar tu lista.</p></section>`;
 bindChoices();show("clarify")
}
function renderInput(q,i){
 if(q.type==="text"||q.type==="number")return `<input class="field answer" data-id="${q.id}" type="${q.type==="number"?"number":"text"}">`;
 return `<div class="choices">${(q.options||[]).map(o=>`<button class="choice" data-id="${q.id}" data-type="${q.type}" data-value="${escapeHtml(String(o))}">${escapeHtml(String(o))}</button>`).join("")}</div>`
}
function bindChoices(){document.querySelectorAll(".choice").forEach(b=>b.onclick=()=>{let id=b.dataset.id;if(b.dataset.type==="multi"){answers[id]=answers[id]||[];let v=b.dataset.value,ix=answers[id].indexOf(v);ix>=0?answers[id].splice(ix,1):answers[id].push(v);b.classList.toggle("active")}else{answers[id]=b.dataset.value;document.querySelectorAll(`.choice[data-id="${CSS.escape(id)}"]`).forEach(x=>x.classList.remove("active"));b.classList.add("active")}})}
$("#generate").onclick=async()=>{
 document.querySelectorAll(".answer").forEach(x=>answers[x.dataset.id]=x.value);
 show("loading");$("#loadingTitle").textContent="Preparando tu lista...";$("#loadingText").textContent="Estamos pensando en lo que realmente necesitarás y en lo que puedes dejar en casa.";
 try{
  const prompt=`VIAJE ORIGINAL: ${$("#trip").value}\nINTERPRETACIÓN: ${analysis.interpretation}\nRESPUESTAS: ${JSON.stringify(answers)}\n\nGenera ahora la checklist final. Devuelve SOLO JSON válido con esta estructura exacta:\n{"valid":true,"interpretation":"título breve","trip_type":[],"warnings":[],"questions":[],"packing_list":{"intro":"consejo principal muy específico","special_advice":["consejo específico"],"categories":[{"name":"categoría","items":[{"name":"objeto con cantidad concreta cuando proceda","why":"por qué es útil específicamente aquí","amazon":false}]}],"leave_home":["cosas que probablemente no merece la pena llevar y por qué"]}}\nLa lista debe ser MUY ESPECÍFICA para este viaje. Evita genéricos obvios salvo que sean relevantes. Calcula cantidades razonables según duración, posibilidad de lavar, clima y actividad. No inventes normas actuales ni datos que requieran verificación en tiempo real.`;
  const out=await callAI({trip:prompt}); if(!out.packing_list)throw new Error("Sin lista");renderResult(out);
 }catch(e){show("clarify");alert("No hemos podido crear la lista. Inténtalo otra vez.");console.error(e)}
};
function renderResult(out){
 const p=out.packing_list;$("#resultTitle").textContent=out.interpretation||"Tu lista";$("#resultIntro").textContent=p.intro||"";
 $("#specialAdvice").innerHTML=(p.special_advice||[]).length?`<section class="card"><h3>⭐ Lo que debes saber</h3>${p.special_advice.map(x=>`<div class="advice">${escapeHtml(x)}</div>`).join("")}</section>`:"";
 items=[];(p.categories||[]).forEach(c=>(c.items||[]).forEach(x=>items.push({id:crypto.randomUUID(),cat:c.name,name:x.name,why:x.why,amazon:!!x.amazon,done:false})));
 if((p.leave_home||[]).length)items.push(...p.leave_home.map(x=>({id:crypto.randomUUID(),cat:"🚫 Puedes dejar en casa",name:x,why:"",amazon:false,done:false,leave:true})));
 draw();show("result")
}
function amazon(n){return"https://www.amazon.es/s?k="+encodeURIComponent(n)+"&tag=travelapps-21"}
function draw(){
 const cats=[...new Set(items.map(x=>x.cat))];$("#lists").innerHTML=cats.map(c=>`<section class="card"><h3>${escapeHtml(c)}</h3>${items.filter(i=>i.cat===c).map(i=>`<div class="item ${i.done?"done":""}"><input type="checkbox" data-check="${i.id}" ${i.done?"checked":""}><div><div class="name">${escapeHtml(i.name)}</div>${i.why?`<div class="why">${escapeHtml(i.why)}</div>`:""}${i.amazon?`<a class="amazon" target="_blank" rel="nofollow sponsored" href="${amazon(i.name)}">🛒 Ver opciones en Amazon</a>`:""}</div><button class="remove" data-remove="${i.id}">×</button></div>`).join("")}</section>`).join("");
 document.querySelectorAll("[data-check]").forEach(x=>x.onchange=()=>{items.find(i=>i.id===x.dataset.check).done=x.checked;draw()});document.querySelectorAll("[data-remove]").forEach(x=>x.onclick=()=>{items=items.filter(i=>i.id!==x.dataset.remove);draw()});
 const normal=items.filter(i=>!i.leave),done=normal.filter(i=>i.done).length,p=normal.length?Math.round(done/normal.length*100):0;$("#meter").style.width=p+"%";$("#meterText").textContent=`${p}% preparado · ${done} de ${normal.length}`;
 localStorage.setItem("qml_v2",JSON.stringify({trip:$("#trip").value,analysis,answers,items}))
}
$("#add").onclick=()=>{let v=$("#custom").value.trim();if(v){items.push({id:crypto.randomUUID(),cat:"Mis cosas",name:v,why:"Añadido por ti",amazon:false,done:false});$("#custom").value="";draw()}};
$("#change").onclick=$("#retry").onclick=()=>{show("start");$("#loadingTitle").textContent="Entendiendo tu viaje...";$("#loadingText").textContent="Estamos detectando qué hace especial a tu plan."};
$("#newTrip").onclick=()=>{localStorage.removeItem("qml_v2");location.reload()};
function escapeHtml(s){return s.replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]))}