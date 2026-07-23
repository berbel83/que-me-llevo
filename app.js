const API="https://que-me-llevo-api.berbel83.workers.dev", $=s=>document.querySelector(s);
let analysis=null,answers={},items=[];

// ======================================================
// IMPORTAR VIAJE DESDE EL PLANAZO
// ======================================================

let importedPlan = null;

function readPlanazoImport(){
  try{
    const params = new URLSearchParams(window.location.search);
    const raw = params.get("plan");

    if(!raw){
      return null;
    }

    const data = JSON.parse(raw);

    if(
      !data ||
      data.source !== "elplanazo"
    ){
      return null;
    }

    return data;

  }catch(e){
    console.error(
      "No se pudieron leer los datos de El Planazo:",
      e
    );

    return null;
  }
}


function buildTripFromPlan(plan){
  const parts=[];

  if(plan.title){
    parts.push(
      `Viaje planificado: ${plan.title}.`
    );
  }

  if(plan.destination){
    parts.push(
      `Destino: ${plan.destination}.`
    );
  }

  if(plan.durationDays){
    parts.push(
      `Duración: ${plan.durationDays} días.`
    );
  }

  if(plan.dates?.start && plan.dates?.end){
    parts.push(
      `Fechas: del ${plan.dates.start} al ${plan.dates.end}.`
    );
  }else if(plan.dates?.approxMonth){
    parts.push(
      `Mes aproximado: ${plan.dates.approxMonth}.`
    );
  }

  if(plan.companions){
    parts.push(
      `Viajeros: ${plan.companions}.`
    );
  }

  if(
    Array.isArray(plan.kidsAges) &&
    plan.kidsAges.length
  ){
    parts.push(
      `Edades de los niños: ${plan.kidsAges.join(", ")} años.`
    );
  }

  if(plan.kidsAge){
    parts.push(
      `Edad o rango de los niños: ${plan.kidsAge}.`
    );
  }

  if(
    Array.isArray(plan.transport) &&
    plan.transport.length
  ){
    parts.push(
      `Transportes: ${plan.transport.join(", ")}.`
    );
  }else if(plan.transport){
    parts.push(
      `Transporte: ${plan.transport}.`
    );
  }

  if(
    Array.isArray(plan.interests) &&
    plan.interests.length
  ){
    parts.push(
      `Tipo de viaje e intereses: ${plan.interests.join(", ")}.`
    );
  }

  if(plan.pace){
    parts.push(
      `Ritmo del viaje: ${plan.pace}.`
    );
  }

  if(plan.budget){
    parts.push(
      `Presupuesto: ${plan.budget}.`
    );
  }

  if(plan.summary){
    parts.push(
      `Resumen del viaje: ${plan.summary}`
    );
  }

  if(plan.notes){
    parts.push(
      `Información adicional: ${plan.notes}`
    );
  }

  // VIAJE DE VARIOS DÍAS
  if(
    Array.isArray(plan.days) &&
    plan.days.length
  ){
    parts.push(
      "Itinerario previsto:"
    );

    plan.days.forEach(day=>{
      const activities =
        Array.isArray(day.activities)
          ? day.activities.join(", ")
          : "";

      parts.push(
        `Día ${day.day || ""}: `+
        `${day.title || ""}. `+
        `${day.location ? `Zona: ${day.location}. ` : ""}`+
        `${activities ? `Actividades: ${activities}.` : ""}`
      );
    });
  }

  // PLAN DE UN SOLO DÍA
  if(
    Array.isArray(plan.activities) &&
    plan.activities.length
  ){
    parts.push(
      "Actividades previstas:"
    );

    plan.activities.forEach(activity=>{
      if(typeof activity==="string"){
        parts.push(activity+".");
        return;
      }

      parts.push(
        `${activity.name || ""}`+
        `${activity.category ? ` (${activity.category})` : ""}`+
        `${activity.description ? `: ${activity.description}` : ""}.`
      );
    });
  }

  return parts.join("\n");
}


// ======================================================
// INICIAR AUTOMÁTICAMENTE UN VIAJE IMPORTADO
// ======================================================

async function initImportedPlan(){
  importedPlan = readPlanazoImport();

  if(!importedPlan){
    return;
  }

  const tripText =
    buildTripFromPlan(importedPlan);

  if(!tripText){
    return;
  }

  $("#trip").value = tripText;

  // Marcamos visualmente que viene de El Planazo
  const errorBox = $("#error");

  if(errorBox){
    errorBox.textContent =
      "🗺️ Viaje importado desde El Planazo. Hemos recibido tu itinerario completo.";

    errorBox.classList.remove("hide");
  }

  // Analizamos automáticamente para que el usuario
  // no tenga que volver a escribir ni pulsar el primer botón.
  setTimeout(()=>{
    $("#analyze").click();
  },150);
}

function show(id){
  ["start","loading","invalid","questions","result"].forEach(
    x=>$("#"+x).classList.toggle("hide",x!==id)
  );
}

async function call(payload){
  const r=await fetch(API,{
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify(payload)
  });

  const t=await r.text();

  if(!r.ok){
    throw new Error(`API ${r.status}: ${t}`);
  }

  try{
    return JSON.parse(t);
  }catch{
    throw new Error("La API devolvió una respuesta que no era JSON válido.");
  }
}

$("#analyze").onclick=async()=>{
  const trip=$("#trip").value.trim();

  if(!trip){
    return error("Cuéntame primero tu viaje.");
  }

  $("#error").classList.add("hide");
  show("loading");
  setLoad(
    "Entendiendo tu viaje…",
    "Detectando qué información puede cambiar realmente tu equipaje."
  );

  try{
    analysis=await call({
      mode:"analyze",
      trip
    });

    console.log("ANÁLISIS RECIBIDO:",analysis);

    if(!analysis || typeof analysis!=="object"){
      throw new Error("La API no devolvió un análisis válido.");
    }

    if(analysis.valid===false){
      $("#invalidTitle").textContent=
        analysis.interpretation || "Este plan necesita revisión.";

      const warnings=[
        ...(analysis.general_warnings||[]),
        ...(analysis.verification_needed||[])
      ];

      $("#invalidWarn").innerHTML=warnings
        .map(x=>`<div class="warning">⚠️ ${esc(x)}</div>`)
        .join("");

      show("invalid");
      return;
    }

    renderQ();

  }catch(e){
    console.error("ERROR ANALIZANDO VIAJE:",e);
    show("start");
    error(
      "No hemos podido analizar el viaje. Error: "+
      (e?.message || "desconocido")
    );
  }
};

function renderQ(){
  $("#understood").textContent=
    analysis.interpretation || "Tu viaje";

  $("#preWarnings").innerHTML=
    (analysis.general_warnings||[])
      .map(x=>`<div class="warning">⚠️ ${esc(x)}</div>`)
      .join("");

  const qs=analysis.questions||[];

  $("#qList").innerHTML=qs.length
    ? qs.map(q=>`
      <section class="card">
        <h3>${esc(q.question)}</h3>
        ${input(q)}
      </section>
    `).join("")
    : `<section class="card">
        <p>Ya tengo suficiente información. No voy a hacerte preguntas innecesarias.</p>
      </section>`;

  bind();
  show("questions");
}

function input(q){
  if(["text","number"].includes(q.type)){
    return `<input class="field answer" data-id="${esc(q.id)}"
      type="${q.type==="number"?"number":"text"}">`;
  }

  return `<div class="choices">
    ${(q.options||[]).map(o=>`
      <button class="choice"
        data-id="${esc(q.id)}"
        data-type="${q.type}"
        data-v="${esc(String(o))}">
        ${esc(String(o))}
      </button>
    `).join("")}
  </div>`;
}

function bind(){
  document.querySelectorAll(".choice").forEach(b=>{
    b.onclick=()=>{
      const id=b.dataset.id;
      const v=b.dataset.v;

      if(b.dataset.type==="multi"){
        answers[id]=answers[id]||[];
        const i=answers[id].indexOf(v);

        if(i>=0){
          answers[id].splice(i,1);
        }else{
          answers[id].push(v);
        }

        b.classList.toggle("active");
      }else{
        answers[id]=v;

        document
          .querySelectorAll(`.choice[data-id="${CSS.escape(id)}"]`)
          .forEach(x=>x.classList.remove("active"));

        b.classList.add("active");
      }
    };
  });
}

$("#generate").onclick=async()=>{
  document.querySelectorAll(".answer").forEach(
    x=>answers[x.dataset.id]=x.value
  );

  show("loading");
  setLoad(
    "Pensando en todo lo que necesitarás…",
    "Revisando necesidades, creando tu lista y buscando posibles olvidos."
  );

  try{
    const out=await call({
      mode:"generate",
      trip:$("#trip").value.trim(),
      analysis,
      answers
    });

    renderResult(out);

  }catch(e){
    console.error("ERROR GENERANDO LISTA:",e);
    show("questions");
    alert(
      "No hemos podido crear la lista. Error: "+
      (e?.message || "desconocido")
    );
  }
};

function renderResult(o){
  $("#title").textContent=o.title||"Tu lista";
  $("#intro").textContent=o.intro||"";

  $("#strategy").innerHTML=
    (o.packing_strategy||[]).length
      ? `<section class="card">
          <h3>🧠 Estrategia de equipaje</h3>
          ${o.packing_strategy
            .map(x=>`<div class="strategy">${esc(x)}</div>`)
            .join("")}
        </section>`
      : "";

  $("#verify").innerHTML=
    (o.verification_needed||[]).length
      ? `<section class="card">
          <h3>🔎 Comprueba antes de salir</h3>
          ${o.verification_needed
            .map(x=>`<div class="verify">${esc(x)}</div>`)
            .join("")}
        </section>`
      : "";

  items=[];

  (o.categories||[]).forEach(c=>
    (c.items||[]).forEach(i=>
      items.push({
        ...i,
        cat:c.name,
        done:false,
        uid:crypto.randomUUID()
      })
    )
  );

  draw();

  $("#leave").innerHTML=
    (o.leave_home||[]).length
      ? `<section class="card">
          <h3>🚫 Puedes dejar en casa</h3>
          ${o.leave_home.map(x=>`
            <div class="leaveItem">
              <b>${esc(x.name)}</b>
              <div class="why">${esc(x.why)}</div>
            </div>
          `).join("")}
        </section>`
      : "";

  show("result");
}

function draw(){
  const cats=[...new Set(items.map(x=>x.cat))];

  $("#lists").innerHTML=cats.map(c=>`
    <section class="card">
      <h3>${esc(c)}</h3>
      ${items.filter(i=>i.cat===c).map(i=>`
        <div class="item ${i.done?"done":""}">
          <input type="checkbox"
            data-c="${i.uid}"
            ${i.done?"checked":""}>
          <div>
            <span class="priority ${i.priority||"recommended"}">
              ${label(i.priority)}
            </span>
            <div class="name">${esc(i.name)}</div>
            <div class="why">${esc(i.why||"")}</div>
            ${i.product_candidate
              ? `<a class="amazon"
                  target="_blank"
                  rel="nofollow sponsored"
                  href="${amazon(i.name)}">
                  🛒 Ver opciones en Amazon
                </a>`
              : ""}
          </div>
          <button class="remove" data-r="${i.uid}">×</button>
        </div>
      `).join("")}
    </section>
  `).join("");

  document.querySelectorAll("[data-c]").forEach(x=>{
    x.onchange=()=>{
      const item=items.find(i=>i.uid===x.dataset.c);
      if(item)item.done=x.checked;
      draw();
    };
  });

  document.querySelectorAll("[data-r]").forEach(x=>{
    x.onclick=()=>{
      items=items.filter(i=>i.uid!==x.dataset.r);
      draw();
    };
  });

  const done=items.filter(x=>x.done).length;
  const pct=items.length
    ? Math.round(done/items.length*100)
    : 0;

  $("#meter").style.width=pct+"%";
  $("#meterText").textContent=
    `${pct}% preparado · ${done} de ${items.length}`;
}

$("#add").onclick=()=>{
  const v=$("#custom").value.trim();

  if(v){
    items.push({
      uid:crypto.randomUUID(),
      cat:"Mis cosas",
      name:v,
      why:"Añadido por ti",
      priority:"optional",
      product_candidate:false,
      done:false
    });

    $("#custom").value="";
    draw();
  }
};

$("#retry").onclick=
$("#back").onclick=()=>{
  show("start");
};

$("#newTrip").onclick=()=>{
  location.reload();
};

function setLoad(a,b){
  $("#loadTitle").textContent=a;
  $("#loadText").textContent=b;
}

function error(t){
  $("#error").textContent=t;
  $("#error").classList.remove("hide");
}

function amazon(n){
  return "https://www.amazon.es/s?k="+
    encodeURIComponent(n)+
    "&tag=travelapps-21";
}

function label(p){
  return p==="essential"
    ? "🔴 IMPRESCINDIBLE"
    : p==="optional"
      ? "🟢 OPCIONAL"
      : "🟠 RECOMENDADO";
}

function esc(s){
  return String(s??"").replace(
    /[&<>"']/g,
    m=>({
      "&":"&amp;",
      "<":"&lt;",
      ">":"&gt;",
      '"':"&quot;",
      "'":"&#039;"
    }[m])
  );
}
// Iniciar integración con El Planazo
initImportedPlan();
