/* ============================
  VIAJES TERÁN - app.js
  - Incluye: celular en cada pasajero
  - PDFs mejor diseñados (encabezado color, recuadros, miniaturas)
  - Guardado en localStorage
  - Historial filtrable y PDF
  - Ganancias con filtro
  - Base pasaj. sin duplicados por DNI
  - Preview de imágenes y toma desde archivo/cámara
  ============================ */

/* ---------- KEYS ---------- */
const KEY_TRIPS = "vt_trips_v3";
const KEY_PASS = "vt_pass_v3";
const KEY_DOCS = "vt_docs_v3";

/* ---------- STATE ---------- */
let trips = JSON.parse(localStorage.getItem(KEY_TRIPS) || "[]");
let passengersDB = JSON.parse(localStorage.getItem(KEY_PASS) || "[]");

/* ---------- DOM refs ---------- */
const pantallas = document.querySelectorAll(".pantalla");
const kmInput = document.getElementById("km-vehiculo");
const fechaEl = document.getElementById("fecha");
const horaEl = document.getElementById("hora");
const tempEl = document.getElementById("temp");
const iconoClimaEl = document.getElementById("icono-clima");

const passengerFormsContainer = document.getElementById("passenger-forms");
const passengerCountEl = document.getElementById("passenger-count");
const btnAddPassenger = document.getElementById("btn-add-passenger");
const btnStartTrip = document.getElementById("btn-start-trip");

const historyListEl = document.getElementById("history-list");
const passengerDbListEl = document.getElementById("passenger-db-list");

/* ---------- Navigation ---------- */
function openTab(id){
  pantallas.forEach(p=>p.classList.remove('activo'));
  const el = document.getElementById(id);
  if(!el) return;
  el.classList.add('activo');
  localStorage.setItem('ultimaPantalla', id);
}
document.querySelectorAll('.btn-acceso').forEach(b => b.addEventListener('click', ()=> openTab(b.dataset.target)));
document.querySelectorAll('.back-btn').forEach(b => b.addEventListener('click', ()=> openTab(b.dataset.target || 'pantalla-inicio')));
const last = localStorage.getItem('ultimaPantalla') || 'pantalla-inicio';
openTab(last);

/* ---------- Fecha/Hora ---------- */
function tick(){
  const now = new Date();
  fechaEl.textContent = now.toLocaleDateString('es-AR',{day:'2-digit',month:'2-digit',year:'numeric'});
  horaEl.textContent = now.toLocaleTimeString('es-AR',{hour:'2-digit',minute:'2-digit'});
}
tick(); setInterval(tick,1000);

/* ---------- KM load/save ---------- */
const vehStored = JSON.parse(localStorage.getItem('vt_veh_v3') || "{}");
kmInput.value = vehStored.km || 0;
kmInput.addEventListener('change', ()=>{
  vehStored.km = Number(kmInput.value || 0);
  localStorage.setItem('vt_veh_v3', JSON.stringify(vehStored));
});

/* ---------- Helpers ---------- */
function uid(){ return Date.now().toString(36) + Math.random().toString(36).slice(2,6); }
function fileToDataURL(file){ return new Promise((res,rej)=>{ const r=new FileReader(); r.onload=()=>res(r.result); r.onerror=rej; r.readAsDataURL(file); }); }

/* ---------- Passenger forms (append-only, keep values) ---------- */
let currentForms = 0;

function createPassengerCard(index){
  const card = document.createElement('div');
  card.className = 'pasajero-card';
  card.dataset.index = index;

  const numero = index + 1; // starts at 1

  card.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center">
      <strong>PASAJERO ${numero}</strong>
      <button class="btn btn-ghost btn-remove">ELIMINAR</button>
    </div>

    <label>DNI</label><input class="p-dni" type="text" />

    <label>APELLIDO Y NOMBRE</label><input class="p-name" type="text" />

    <label>N° CELULAR</label><input class="p-phone" type="text" />

    <label>FOTOS DNI (HASTA 2)</label>
    <input class="p-dni-files" type="file" accept="image/*" capture="environment" multiple />
    <div class="preview-row dni-preview"></div>

    <label>FOTOS EQUIPAJE</label>
    <input class="p-luggage-files" type="file" accept="image/*" capture="environment" multiple />
    <div class="preview-row luggage-preview"></div>

    <label>OBSERVACIONES</label><textarea class="p-notes"></textarea>
  `;

  // remove
  card.querySelector('.btn-remove').addEventListener('click', ()=>{
    card.remove();
    currentForms--;
    updatePassengerCount();
    // renumber remaining cards
    renumberPassengerCards();
  });

  // preview dni
  const dniFilesInput = card.querySelector('.p-dni-files');
  const dniPreview = card.querySelector('.dni-preview');
  dniFilesInput.addEventListener('change', async (e)=>{
    dniPreview.innerHTML = '';
    const files = Array.from(e.target.files).slice(0,2);
    const urls = [];
    for(const f of files){
      const d = await fileToDataURL(f);
      urls.push(d);
      const img = document.createElement('img'); img.src = d;
      dniPreview.appendChild(img);
    }
    card.dataset.dniPhotos = JSON.stringify(urls);
  });

  // preview luggage
  const lugFilesInput = card.querySelector('.p-luggage-files');
  const lugPreview = card.querySelector('.luggage-preview');
  lugFilesInput.addEventListener('change', async (e)=>{
    lugPreview.innerHTML = '';
    const files = Array.from(e.target.files);
    const urls = [];
    for(const f of files){
      const d = await fileToDataURL(f);
      urls.push(d);
      const img = document.createElement('img'); img.src = d;
      lugPreview.appendChild(img);
    }
    card.dataset.luggagePhotos = JSON.stringify(urls);
  });

  return card;
}

function renumberPassengerCards(){
  const cards = passengerFormsContainer.querySelectorAll('.pasajero-card');
  cards.forEach((c,i)=>{
    const strong = c.querySelector('strong');
    if(strong) strong.textContent = `PASAJERO ${i+1}`;
    c.dataset.index = i;
  });
}

function addPassengerForm(){
  if(currentForms >= 4) { alert('LÍMITE DE 4 PASAJEROS'); return; }
  const card = createPassengerCard(currentForms);
  passengerFormsContainer.appendChild(card);
  currentForms++;
  updatePassengerCount();
}
btnAddPassenger.addEventListener('click', addPassengerForm);

function updatePassengerCount(){ passengerCountEl.textContent = `(${passengerFormsContainer.querySelectorAll('.pasajero-card').length} / 4)`; }

/* ---------- Start Trip: collect, save, pdf ---------- */
btnStartTrip.addEventListener('click', async ()=>{
  const date = document.getElementById('trip-date').value || (new Date()).toISOString().slice(0,10);
  const time = document.getElementById('trip-time').value || (new Date()).toTimeString().slice(0,5);
  const origin = document.getElementById('trip-origin').value.trim();
  const destination = document.getElementById('trip-destination').value.trim();
  const notes = document.getElementById('trip-notes').value.trim();
  const km = Number(kmInput.value || 0);

  const cards = passengerFormsContainer.querySelectorAll('.pasajero-card');
  const passengers = [];
  for(const card of cards){
    const dni = (card.querySelector('.p-dni')?.value || '').trim();
    const name = (card.querySelector('.p-name')?.value || '').trim();
    const phone = (card.querySelector('.p-phone')?.value || '').trim();
    const notesP = (card.querySelector('.p-notes')?.value || '').trim();
    const dniPhotos = card.dataset.dniPhotos ? JSON.parse(card.dataset.dniPhotos) : [];
    const luggagePhotos = card.dataset.luggagePhotos ? JSON.parse(card.dataset.luggagePhotos) : [];

    const p = { id: uid(), dni, name, phone, notes: notesP, dniPhotos, luggagePhotos };
    passengers.push(p);

    // update passengers DB (no duplicates by DNI)
    if(dni){
      const existing = passengersDB.find(x=>x.dni === dni);
      const dbRec = { dni, name, phone, notes: notesP, dniPhotos };
      if(!existing) passengersDB.unshift(dbRec);
      else {
        existing.name = name || existing.name;
        existing.phone = phone || existing.phone;
        existing.notes = notesP || existing.notes;
        existing.dniPhotos = dbRec.dniPhotos || existing.dniPhotos;
      }
    }
  }

  const trip = { id: uid(), createdAt: new Date().toISOString(), date, time, origin, destination, notes, km, passengers };
  trips.unshift(trip);

  // persist
  localStorage.setItem(KEY_TRIPS, JSON.stringify(trips));
  localStorage.setItem(KEY_PASS, JSON.stringify(passengersDB));

  // reset forms
  passengerFormsContainer.innerHTML = '';
  currentForms = 0;
  updatePassengerCount();
  document.getElementById('trip-origin').value = '';
  document.getElementById('trip-destination').value = '';
  document.getElementById('trip-notes').value = '';

  // refresh ui
  renderHistory();
  renderPassengersDB();

  // generate pdf automatic
  await generateTripPDF(trip);

  alert('VIAJE GUARDADO Y PDF GENERADO.');
});

/* ---------- Render History & filter ---------- */
function renderHistory(filter){
  historyListEl.innerHTML = '';
  const list = trips.filter(t=>{
    if(!filter) return true;
    if(filter.from && new Date(t.createdAt) < new Date(filter.from)) return false;
    if(filter.to && new Date(t.createdAt) > new Date(filter.to + 'T23:59:59')) return false;
    if(filter.origin && !t.origin?.toLowerCase().includes(filter.origin.toLowerCase())) return false;
    if(filter.destination && !t.destination?.toLowerCase().includes(filter.destination.toLowerCase())) return false;
    return true;
  });

  for(const t of list){
    const el = document.createElement('div'); el.className='item';
    el.innerHTML = `<div>
      <div class="muted small">${new Date(t.createdAt).toLocaleString('es-AR')}</div>
      <div><strong>${t.origin||'--'}</strong> → ${t.destination||'--'}</div>
      <div class="muted small">Pasajeros: ${t.passengers.length}</div>
    </div>
    <div style="display:flex;gap:8px;align-items:center">
      <button class="btn btn-ghost view-trip" data-id="${t.id}">VER PDF</button>
    </div>`;
    historyListEl.appendChild(el);
  }

  historyListEl.querySelectorAll('.view-trip').forEach(b=>{
    b.addEventListener('click', ()=>{
      const id = b.dataset.id;
      const trip = trips.find(x=>x.id===id);
      if(trip) generateTripPDF(trip);
    });
  });
}

document.getElementById('btn-filter-history').addEventListener('click', ()=>{
  const from = document.getElementById('filter-from').value;
  const to = document.getElementById('filter-to').value;
  const origin = document.getElementById('filter-origin').value.trim();
  const destination = document.getElementById('filter-destination').value.trim();
  renderHistory({ from, to, origin, destination });
});
document.getElementById('btn-generate-history-pdf').addEventListener('click', async ()=>{
  const from = document.getElementById('filter-from').value;
  const to = document.getElementById('filter-to').value;
  const filtered = trips.filter(t=>{
    if(from && new Date(t.createdAt) < new Date(from)) return false;
    if(to && new Date(t.createdAt) > new Date(to + 'T23:59:59')) return false;
    return true;
  });
  await generateHistoryPDF(filtered);
});

/* ---------- Render Passengers DB + search + PDF ---------- */
function renderPassengersDB(q){
  passengerDbListEl.innerHTML = '';
  const query = (typeof q === 'string') ? q : (document.getElementById('search-dni').value || '').trim();
  const list = passengersDB.filter(p=> !query || (p.dni && p.dni.includes(query)));
  for(const p of list){
    const el = document.createElement('div'); el.className='pasajero-card';
    el.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center">
      <div><strong>${p.name||'--'}</strong><div class="muted small">DNI: ${p.dni||'--'} · TEL: ${p.phone||'--'}</div></div>
      <div><button class="btn btn-ghost view-pass" data-dni="${p.dni}">VER</button></div>
    </div>`;
    passengerDbListEl.appendChild(el);
  }
  passengerDbListEl.querySelectorAll('.view-pass').forEach(b=>{
    b.addEventListener('click', ()=>{
      const dni = b.dataset.dni;
      const rec = passengersDB.find(x=>x.dni===dni);
      if(rec) alert(`DNI: ${rec.dni}\nNOMBRE: ${rec.name}\nTEL: ${rec.phone}`);
    });
  });
}
document.getElementById('btn-search-dni').addEventListener('click', ()=> renderPassengersDB());

document.getElementById('btn-generate-passengers-pdf').addEventListener('click', async ()=>{
  await generatePassengersPDF(passengersDB);
});

/* ---------- Ganancias ---------- */
document.getElementById('btn-calc-profit').addEventListener('click', ()=>{
  const from = document.getElementById('profit-from').value;
  const to = document.getElementById('profit-to').value;
  const price = Number(document.getElementById('price-per-passenger').value || 0);
  const fixed = Number(document.getElementById('fixed-cost').value || 0);

  const filtered = trips.filter(t=>{
    if(from && new Date(t.createdAt) < new Date(from)) return false;
    if(to && new Date(t.createdAt) > new Date(to + 'T23:59:59')) return false;
    return true;
  });

  const totalTrips = filtered.length;
  const totalPassengers = filtered.reduce((s,t)=> s + (t.passengers?.length || 0), 0);
  const revenue = totalPassengers * price;
  const expenses = totalTrips * fixed;
  const profit = revenue - expenses;

  document.getElementById('profit-results').innerHTML = `
    <div>Viajes: <strong>${totalTrips}</strong></div>
    <div>Pasajeros totales: <strong>${totalPassengers}</strong></div>
    <div>Ingresos: $ <strong>${revenue.toLocaleString()}</strong></div>
    <div>Gastos: $ <strong>${expenses.toLocaleString()}</strong></div>
    <div>GANANCIA NETA: $ <strong>${profit.toLocaleString()}</strong></div>
  `;
});

/* ---------- PDF Generators (mejor diseño) ---------- */
async function generateTripPDF(trip){
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit:'px', format:'a4' });
  const m = 18; let y = 20;

  // Header colored bar
  doc.setFillColor(45,114,255);
  doc.rect(m-10, y-10, 580, 60, 'F');
  doc.setTextColor(255,255,255); doc.setFontSize(22); doc.text("VIAJES TERÁN", m+4, y+18);
  doc.setFontSize(10); doc.text(`ID: ${trip.id}`, m+4, y+34);
  y += 66;

  // Trip info box
  doc.setDrawColor(125,162,255); doc.setLineWidth(1.2);
  doc.roundedRect(m, y, 560, 70, 6, 6);
  doc.setTextColor(11,37,69); doc.setFontSize(11);
  doc.text(`FECHA: ${trip.date}    HORA: ${trip.time}`, m+8, y+18);
  doc.text(`PARTIDA: ${trip.origin || '--'}`, m+8, y+36);
  doc.text(`LLEGADA: ${trip.destination || '--'}`, m+8, y+54);
  y += 86;

  // Passengers section
  doc.setFontSize(13); doc.text("PASAJEROS", m, y); y += 16;
  for(const p of trip.passengers){
    // passenger box
    doc.setDrawColor(220,230,255);
    doc.roundedRect(m, y, 560, 100, 6, 6);
    doc.setFontSize(11);
    doc.text(`NOMBRE: ${p.name || '--'}`, m+8, y+18);
    doc.text(`DNI: ${p.dni || '--'}`, m+8, y+36);
    doc.text(`CEL: ${p.phone || '--'}`, m+8, y+54);
    if(p.notes) doc.text(`OBS: ${p.notes}`, m+8, y+72);

    // add first dni photo if any
    if(p.dniPhotos && p.dniPhotos[0]){
      try{ doc.addImage(p.dniPhotos[0],'JPEG', m+380, y+12, 160, 76); }catch(e){}
    }

    y += 116;
    if(y > doc.internal.pageSize.height - 120){ doc.addPage(); y = 20; }
  }

  doc.save(`viaje_${trip.id}.pdf`);
}

async function generateHistoryPDF(list){
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit:'px', format:'a4' });
  const m = 18; let y = 20;

  doc.setFillColor(45,114,255); doc.rect(m-10,y-10,580,48,'F');
  doc.setTextColor(255,255,255); doc.setFontSize(16); doc.text("VIAJES TERÁN - HISTORIAL", m+4, y+16);
  y += 44;

  doc.setFontSize(11); doc.setTextColor(11,37,69);
  for(const t of list){
    doc.roundedRect(m, y, 560, 64, 6, 6);
    doc.text(`${new Date(t.createdAt).toLocaleString('es-AR')}`, m+8, y+16);
    doc.text(`${t.origin || '--'} → ${t.destination || '--'}`, m+8, y+34);
    doc.text(`Pasajeros: ${t.passengers.length}`, m+8, y+50);
    y += 78;
    if(y > doc.internal.pageSize.height - 100){ doc.addPage(); y = 20; }
  }

  doc.save(`historial_${Date.now()}.pdf`);
}

async function generatePassengersPDF(list){
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit:'px', format:'a4' });
  const m = 18; let y = 20;

  doc.setFillColor(45,114,255); doc.rect(m-10,y-10,580,48,'F');
  doc.setTextColor(255,255,255); doc.setFontSize(16); doc.text("VIAJES TERÁN - PASAJEROS", m+4, y+16);
  y += 44;

  doc.setFontSize(11); doc.setTextColor(11,37,69);
  for(const p of list){
    doc.roundedRect(m, y, 560, 40, 6, 6);
    doc.text(`${p.name || '--'}`, m+8, y+14);
    doc.text(`DNI: ${p.dni || '--'}   TEL: ${p.phone || '--'}`, m+8, y+30);
    y += 54;
    if(y > doc.internal.pageSize.height - 80){ doc.addPage(); y = 20; }
  }

  doc.save(`pasajeros_${Date.now()}.pdf`);
}

/* ---------- Utils ---------- */
function renderHistory(){ renderHistory(); } // no-op to avoid linter errors, real render below

function renderHistory(){ // real implementation
  renderHistoryFiltered();
}
function renderHistoryFiltered(filter){
  // implemented earlier; use same fn name
  const from = filter?.from || null;
  const to = filter?.to || null;
  const origin = filter?.origin || null;
  const destination = filter?.destination || null;
  historyListEl.innerHTML = '';
  const list = trips.filter(t=>{
    if(from && new Date(t.createdAt) < new Date(from)) return false;
    if(to && new Date(t.createdAt) > new Date(to + 'T23:59:59')) return false;
    if(origin && !t.origin?.toLowerCase().includes(origin.toLowerCase())) return false;
    if(destination && !t.destination?.toLowerCase().includes(destination.toLowerCase())) return false;
    return true;
  });

  for(const t of list){
    const el = document.createElement('div'); el.className='item';
    el.innerHTML = `<div>
      <div class="muted small">${new Date(t.createdAt).toLocaleString('es-AR')}</div>
      <div><strong>${t.origin||'--'}</strong> → ${t.destination||'--'}</div>
      <div class="muted small">Pasajeros: ${t.passengers.length}</div>
    </div>
    <div style="display:flex;gap:8px;align-items:center">
      <button class="btn btn-ghost view-trip" data-id="${t.id}">VER PDF</button>
    </div>`;
    historyListEl.appendChild(el);
  }
  historyListEl.querySelectorAll('.view-trip').forEach(b=>{
    b.addEventListener('click', ()=>{
      const id=b.dataset.id;
      const trip = trips.find(x=>x.id===id);
      if(trip) generateTripPDF(trip);
    });
  });
}

document.getElementById('btn-filter-history').addEventListener('click', ()=>{
  const from = document.getElementById('filter-from').value;
  const to = document.getElementById('filter-to').value;
  const origin = document.getElementById('filter-origin').value.trim();
  const destination = document.getElementById('filter-destination').value.trim();
  renderHistoryFiltered({ from, to, origin, destination });
});

/* ---------- Render passengers DB ---------- */
function renderPassengersDB(q){
  passengerDbListEl.innerHTML = '';
  const query = (typeof q === 'string') ? q : (document.getElementById('search-dni').value || '').trim();
  const list = passengersDB.filter(p => !query || (p.dni && p.dni.includes(query)));
  for(const p of list){
    const el = document.createElement('div'); el.className='pasajero-card';
    el.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center">
      <div><strong>${p.name||'--'}</strong><div class="muted small">DNI: ${p.dni||'--'} · TEL: ${p.phone||'--'}</div></div>
      <div><button class="btn btn-ghost view-pass" data-dni="${p.dni}">VER</button></div>
    </div>`;
    passengerDbListEl.appendChild(el);
  }
  passengerDbListEl.querySelectorAll('.view-pass').forEach(b=>{
    b.addEventListener('click', ()=>{
      const dni=b.dataset.dni;
      const rec = passengersDB.find(x=>x.dni===dni);
      if(rec) alert(`DNI: ${rec.dni}\nNOMBRE: ${rec.name}\nTEL: ${rec.phone}`);
    });
  });
}
document.getElementById('btn-search-dni').addEventListener('click', ()=> renderPassengersDB());

/* ---------- generate history & passengers pdf wrappers ---------- */
document.getElementById('btn-generate-history-pdf').addEventListener('click', async ()=>{
  const from = document.getElementById('filter-from').value;
  const to = document.getElementById('filter-to').value;
  const filtered = trips.filter(t=>{
    if(from && new Date(t.createdAt) < new Date(from)) return false;
    if(to && new Date(t.createdAt) > new Date(to + 'T23:59:59')) return false;
    return true;
  });
  await generateHistoryPDF(filtered);
});
document.getElementById('btn-generate-passengers-pdf').addEventListener('click', async ()=> await generatePassengersPDF(passengersDB));

/* ---------- initial render ---------- */
renderHistoryFiltered();
renderPassengersDB();

/* ---------- keep UI reactive (search input) ---------- */
document.getElementById('search-dni').addEventListener('input', (e)=> renderPassengersDB(e.target.value.trim()));
