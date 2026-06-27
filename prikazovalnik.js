const firebaseConfig = {
        apiKey: "AIzaSyCOjFxUBNXfIBCpxIRM9Wliw9GKlJepKEQ",
        authDomain: "kranjbus.firebaseapp.com",
        projectId: "kranjbus",
        storageBucket: "kranjbus.appspot.com",
        messagingSenderId: "10086091245",
        appId: "1:10086091245:android:e548ca35400f1b05967fe4"
    };

    firebase.initializeApp(firebaseConfig);
    const db = firebase.firestore();
    let busDatabase = [];

    let activeOperators = new Set([
        "IJPP",
        "LPP",
        "MARPROM",
        "MPKranj",
        "CELEBUS",
        "MOMS"
    ]);

    const operatorPriority = {
    "LPP": 1,
    "IJPP": 2,
    "MARPROM": 3,
    "CELEBUS": 4,
    "MPKranj": 5,
    "MOMS": 6
    };

    let searchText = "";

    let dbCount = 0;
    let activeCount = 0;

    // 2. ZEMLJEVID
    const map = L.map('map', {
    zoomControl: false   
    }).setView([46.2435, 14.3555], 13);

    L.control.zoom({
        position: 'topright'
    }).addTo(map);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>'
    }).addTo(map);
    let markers = {};


    const clean = (str) => str ? str.toString().replace(/[\s\-]/g,'').toUpperCase() : "";

    // 3. NALAGANJE IZ FIRESTORE 
    function loadFirestoreData() {
        db.collection("avtobusi").onSnapshot((snapshot) => {
            busDatabase = snapshot.docs.map(doc => doc.data());
            dbCount = busDatabase.length;
            updateStats();
            updatePositions();
        });
    }

    const nextStopCache = new Map();

    function getOp(v) {

    const opId = v.vehicle.operator_id || "";
    const opName = v.vehicle.operator_name || "";

    if (v.trip_id.includes("MOKranj") || opName.includes("MP_Kranj")) return { c:"#D74061", lc:v.color, n:"MP Kranj", i:"https://www.kranj.si/img/favicon/favicon-32x32.png", type:"MPKranj", m:true };
    if (opId === "LPP:lpp") return { c:"#278960", lc:v.color, n:"Ljubljanski potniški promet", i:"https://www.lpp.si/sites/www.jhl.si/files/icons/www_lpp/favicon-32x32.png", type:"LPP", m:true };
    if (opId.includes("IJPP") && opName.includes("Arriva")) return { c:v.color, lc:v.color, n:opName, i:"https://arriva.si/wp-content/uploads/2025/05/cropped-favicon-32x32.png", type:"IJPP", m:false };
    if (opId.includes("IJPP") && opName.includes("Nomago")) return { c:v.color, lc:v.color, n:opName, i:"https://www.nomago.si/storage/app/media/favicon.ico", type:"IJPP", m:false };
    if (opId.includes("IJPP") && opName.includes("AP Murska Sobota")) return { c:v.color, lc:v.color, n:opName, i:"https://www.apms.si/favicon.ico", type:"IJPP", m:false };
    if (opId.includes("CELEBUS")) return { c:"#FFD700", lc:v.color, n:"CELEBUS", i:"https://moc.celje.si/images/Datoteke/CELEBUS/Logo1.jpg", type:"CELEBUS", m:true };
    if (opId.includes("MARPROM")) return { c:"#d6181f", lc:v.color, n:"MARPROM", i:"https://www.marprom.si/wp-content/uploads/cropped-logo-32x32.png", type:"MARPROM", m:true };
    if (opId.includes("MOMS:1121")) return { c:"#0077BE", lc:v.color, n:"MP Murska Sobota", i:"https://www.murska-sobota.si/themes/custom/moms/favicon.ico", type:"MOMS", m:true };
    if (v.trip_id?.startsWith("IJPP:")) { return { c: v.color, lc: v.color, n: "IJPP", type: "IJPP", m: false} };
    return { c:v.color, lc:v.color, n:opName, type:"OTHER", m:false };
}

function getTodayYYYYMMDD() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");

    return `${y}${m}${day}`;
}

async function poisciNaslednjePostajalisceIJPP(tripID) {
    try {
        const today = getTodayYYYYMMDD();

        const res = await fetch(`https://api.beta.brezavta.si/trips/${tripID}?date=${today}`);
        const data = await res.json();

        for (const item of data.stop_times) {
            if (item.passed == true) {
                continue;
            }
            return item.stop.name || "";
        }

    } catch(err) {
        console.error(err);
    }

    return "";
}

async function updatePositions() {

    Object.values(markers).forEach(m => m.visible = false);

    try {

        const res = await fetch('https://api.beta.brezavta.si/vehicles/locations');
        const locations = await res.json();

        activeCount = locations.length;
        updateStats();

        // SORTIRANJE
        locations.sort((a, b) => {

            const opA = getOp(a);
            const opB = getOp(b);

            const pA = operatorPriority[opA.type] || 99;
            const pB = operatorPriority[opB.type] || 99;

            if (pA !== pB) return pA - pB;

            let lineA = a.route_short_name || "";
            let lineB = b.route_short_name || "";

            if (opA.type === "IJPP") {
                lineA = parseInt(lineA) || 9999;
                lineB = parseInt(lineB) || 9999;
            } else {
                lineA = parseInt(lineA.replace(/\D/g,'')) || 999;
                lineB = parseInt(lineB.replace(/\D/g,'')) || 999;
            }

            return lineA - lineB;

        });

        const now = Date.now();
        const listDiv = document.getElementById('bus-list');
        let listHtml = "";

        locations.forEach(v => {

            if (!v.trip_id || !v.vehicle?.plate || v.vehicle.plate === "0") return;

            const op = getOp(v);

            if (!activeOperators.has(op.type)) return;

            const apiPlate = clean(v.vehicle.plate);
            const apiId = clean(v.vehicle.id.split(":").pop());

            const dbBus = busDatabase.find(b => {

                const dbSt = clean(b.stVozila);
                const dbReg = clean(b.registrska);

                return (dbSt && (dbSt === apiPlate || dbSt === apiId)) ||
                       (dbReg && (dbReg === apiPlate || dbReg === apiId));

            });

            const reg = dbBus ? dbBus.registrska : v.vehicle.plate;
            let slika = dbBus ? dbBus.slikaPath : null;
            if (op.type === "LPP") {
                slika = "https://mestnipromet.cyou/tracker/img/avtobusi/" + reg.split("-").pop().trim() + ".jpg";
            }
            const modelPrikaz = dbBus ? `${dbBus.proizvajalec} ${dbBus.model}` : "Ni v bazi.";

            if (searchText) {

                const haystack = `
                    ${v.vehicle.plate}
                    ${v.route_short_name}
                    ${v.trip_headsign}
                    ${op.n}
                    ${modelPrikaz}
                    ${reg}
                `.toLowerCase();

                if (!haystack.includes(searchText)) return;

            }

            
            const invalidskiVozicek = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="15" height="15">
                <g fill="#0066CC" transform="translate(85,55) scale(0.8)">
                    <path d="M161.988 98.124c24.9629-2.30469 44.3574-23.811 44.3574-48.9658C206.346 22.083 184.263 0 157.188 0s-49.1572 22.083-49.1572 49.1582c0 8.25684 2.30371 16.7056 6.14453 23.8105l17.5156 246.467 180.396.0488 73.9912 173.365 97.1445-38.0977-15.043-35.8203-54.3662 19.625-71.5908-165.28-167.729 1.12695-2.30273-31.2129 121.423.0483v-46.1831l-126.055-.0493L161.988 98.124Z"/>
                    <path d="M343.42 451.591c-30.4473 60.1875-94.1748 99.8398-162.15 99.8398C81.4297 551.431 0 470.001 0 370.161c0-70.1006 42.4854-135.244 105.882-164.121l4.10254 53.5376c-37.4971 23.6284-60.6123 66.2622-60.6123 110.951 0 72.4268 59.0713 131.497 131.497 131.497 66.2617 0 122.765-50.8516 130.47-116.087L343.42 451.591Z"/>
                </g>
            </svg>`;

            let dostopnost = "";
            if (dbBus?.imaRampo) dostopnost = invalidskiVozicek;

            let naslednjePostajalisce;

            if (op.type === "IJPP" && nextStopCache.has(v.trip_id)) {

                // osveži podatek ob vsakem refreshu
                poisciNaslednjePostajalisceIJPP(v.trip_id)
                    .then(stop => {
                        nextStopCache.set(v.trip_id, stop || "Ni podatka");

                        if (markers[v.trip_id]) {
                            markers[v.trip_id].getPopup().setContent(
                                buildPopup(
                                    v,
                                    op,
                                    reg,
                                    modelPrikaz,
                                    slika,
                                    dostopnost,
                                    stop || "Ni podatka"
                                )
                            );
                        }
                    })
                    .catch(console.error);

                naslednjePostajalisce = nextStopCache.get(v.trip_id);

            } else if (op.type === "IJPP") {

                naslednjePostajalisce = "Nalaganje ...";

            } else {

                naslednjePostajalisce = v.stop?.name || "";

            }

            let title = `
                <span class="mini-krogec" style="background-color:${op.c}; color:#ffffff">
                    ${v.route_short_name}
                </span>
                <b class="popup-ime-linije">${v.trip_headsign}</b>
            `;

            if (op.m && v.route_short_name) {

                title = `
                    <span class="mini-krogec" style="background-color:${op.lc}; color:#ffffff">
                        ${v.route_short_name}
                    </span>
                    <b class="popup-ime-linije">
                        ${v.trip_headsign.split(" - ").pop().trim()}
                    </b>
                `;

            }

            const popupHtml = `
                <div style="min-width:300px">
                    ${title}<br>
                    Naslednje postajališče: ${naslednjePostajalisce}<br>
                    <hr>
                    <b>Prevoznik: <img src="${op.i}" class="inline-emoji"></b> ${op.n}<br>
                    <b>Registrske oznake:</b> ${reg}<br>
                    <b>Vozilo:</b> ${modelPrikaz} ${dostopnost}<br>
                    ${slika ? `<img src="${slika}" class="popup-img">` : '<p>Ni slike.</p>'}
                </div>`;

            if (markers[v.trip_id]) {

                markers[v.trip_id]
                    .setLatLng([v.lat, v.lon])
                    .getPopup()
                    .setContent(popupHtml);

                markers[v.trip_id].lastUpdate = now;

            } else {

            const icon = L.divIcon({
    className: 'bus-icon',
    html: `
        <div class="bus-marker-icon"
             style="color:${op.c}; width:30px; height:30px; border:2px solid ${op.c};">
            <i class="fa-solid fa-bus"
               style="transform:rotate(${v.heading}deg)"></i>
        </div>`,
    iconSize: [30,30]
});

const m = L.marker([v.lat, v.lon], { icon })
    .addTo(map)
    .bindPopup(popupHtml);

m.on("click", async () => {

    if (op.type !== "IJPP") return;

    const id = v.trip_id;

    // loading state
    m.getPopup().setContent(
        buildPopup(v, op, reg, modelPrikaz, slika, dostopnost, "Nalaganje...")
    );

    let stop;

    if (!nextStopCache.has(id)) {
        stop = await poisciNaslednjePostajalisceIJPP(id);
        nextStopCache.set(id, stop || "Ni podatka");
    } else {
        try {
            stop = await poisciNaslednjePostajalisceIJPP(id);
            stop = stop || "Ni podatka";
            nextStopCache.set(id, stop);
        } catch {
            stop = "Napaka";
        }
    }

    m.getPopup().setContent(
        buildPopup(v, op, reg, modelPrikaz, slika, dostopnost, stop)
    );
});

m.lastUpdate = now;
markers[v.trip_id] = m;
            }

            markers[v.trip_id].visible = true;

            listHtml += `
                <div class="bus-card"
                     style="border-left-color:${op.c}"
                     onclick="focusBus('${v.trip_id}')">

                    <div style="margin-bottom:5px">
                        ${title}
                    </div>

                    <div style="font-size:12px; color:#666;">
                        <b style="color:${op.c}">
                        <img src="${op.i}" class="inline-emoji"> ${op.n}
                        </b>
                        • ${reg}
                        • ${modelPrikaz}
                        ${dostopnost}
                    </div>

                </div>
            `;

        });

        listDiv.innerHTML = listHtml;

        for (let id in markers) {

            if (!markers[id].visible) {

                map.removeLayer(markers[id]);
                delete markers[id];
                continue;

            }

            if (now - markers[id].lastUpdate > 60000) {

                map.removeLayer(markers[id]);
                delete markers[id];

            }

        }

    } catch (e) {

        console.error(e);

    }

}

        window.focusBus = (id) => {

            if (markers[id]) {

                map.setView(markers[id].getLatLng(), 16);
                markers[id].openPopup();

            }

        };


// FILTER MODAL

const openBtn = document.getElementById("openFilters");
const modal = document.getElementById("filterModal");
const closeBtn = document.getElementById("closeFilters");

function buildPopup(v, op, reg, modelPrikaz, slika, dostopnost, stopText) {
    let title = `
        <span class="mini-krogec" style="background-color:${op.c}; color:#ffffff">
            ${v.route_short_name}
        </span>
        <b class="popup-ime-linije">${v.trip_headsign}</b>
    `;

    if (op.m && v.route_short_name) {
        title = `
            <span class="mini-krogec" style="background-color:${op.lc}; color:#ffffff">
                ${v.route_short_name}
            </span>
            <b class="popup-ime-linije">
                ${v.trip_headsign.split(" - ").pop().trim()}
            </b>
        `;
    }

    return `
        <div style="min-width:300px">
            ${title}<br>
            Naslednje postajališče: ${stopText}<br>
            <hr>
            <b>Prevoznik: <img src="${op.i}" class="inline-emoji"></b> ${op.n}<br>
            <b>Registrske oznake:</b> ${reg}<br>
            <b>Vozilo:</b> ${modelPrikaz} ${dostopnost}<br>
            ${slika ? `<img src="${slika}" class="popup-img">` : '<p>Ni slike.</p>'}
        </div>
    `;
}

// Odpri popup
openBtn.addEventListener("click", () => {
    modal.style.display = "flex";
});

// Zapri popup
closeBtn.addEventListener("click", () => {
    modal.style.display = "none";
});

// Klik izven okna zapre
modal.addEventListener("click", (e) => {
    if (e.target === modal) {
        modal.style.display = "none";
    }
});

// Checkboxi
modal.querySelectorAll("input[type=checkbox]").forEach(cb => {

    cb.addEventListener("change", () => {

        if (cb.checked) {
            activeOperators.add(cb.value);
        } else {
            activeOperators.delete(cb.value);
        }

        updatePositions();
    });

});

function initSearch() {

    const input = document.getElementById("busSearch");

    input.addEventListener("input", e => {

        searchText = e.target.value.toLowerCase();

        updatePositions();
    });
}

const toggleBtn = document.getElementById("toggleSidebar");
const sidebar = document.getElementById("sidebar");

toggleBtn.addEventListener("click", () => {

    sidebar.classList.toggle("hidden");

    if (window.innerWidth > 768) {
        setTimeout(() => {
            map.invalidateSize();
        }, 310);
    }

});

function updateStats() {

    document.getElementById("stats").innerHTML =
        `Baza: ${dbCount} vozil • Aktivnih: ${activeCount}`;

}



    loadFirestoreData();
    initSearch();
    setInterval(updatePositions, 15000);
    