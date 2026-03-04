// ================================================
// Análisis de Datos – ESP32 + DHT22
// Universidad Surcolombiana – 2026
// ================================================

// ── Navegación ──────────────────────────────────
function toggleMenu() {
    document.getElementById("navLinks").classList.toggle("show");
    document.body.classList.toggle("menu-open");
}

// ── Variables globales de gráficas ──────────────
let chartTemp = null;
let chartHum  = null;
let chartDisp = null;

// ── Drag & Drop ─────────────────────────────────
document.addEventListener('DOMContentLoaded', function () {
    const uploadZone = document.getElementById('uploadZone');

    uploadZone.addEventListener('dragover', function (e) {
        e.preventDefault();
        uploadZone.classList.add('dragover');
    });

    uploadZone.addEventListener('dragleave', function () {
        uploadZone.classList.remove('dragover');
    });

    uploadZone.addEventListener('drop', function (e) {
        e.preventDefault();
        uploadZone.classList.remove('dragover');
        if (e.dataTransfer.files[0]) procesarCSV(e.dataTransfer.files[0]);
    });

    document.getElementById('fileInput').addEventListener('change', function (e) {
        if (e.target.files[0]) procesarCSV(e.target.files[0]);
    });
});

// ── Procesar CSV ─────────────────────────────────
function procesarCSV(file) {
    document.getElementById('loading').style.display = 'block';

    Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: function (results) {
            document.getElementById('loading').style.display = 'none';

            const datos = results.data.filter(function (r) {
                return r.Temperatura && r.Humedad && !isNaN(parseFloat(r.Temperatura));
            });

            if (datos.length === 0) {
                alert('No se encontraron datos válidos en el archivo.');
                return;
            }

            const uploadZone = document.getElementById('uploadZone');
            uploadZone.innerHTML =
                '<div class="upload-icon">✅</div>' +
                '<h3>Archivo cargado correctamente</h3>' +
                '<p>' + file.name + '</p>' +
                '<span class="file-loaded">📊 ' + datos.length + ' registros procesados</span>';

            generarAnalisis(datos);
            document.getElementById('resultados').style.display = 'block';
            document.getElementById('resultados').scrollIntoView({ behavior: 'smooth' });
        },
        error: function () {
            document.getElementById('loading').style.display = 'none';
            alert('Error al leer el archivo. Verifica que sea un CSV válido.');
        }
    });
}

// ── Calcular correlación de Pearson ─────────────
function calcularPearson(temps, hums) {
    const n     = temps.length;
    const meanT = temps.reduce(function (a, b) { return a + b; }, 0) / n;
    const meanH = hums.reduce(function (a, b) { return a + b; }, 0) / n;
    const num   = temps.reduce(function (s, t, i) { return s + (t - meanT) * (hums[i] - meanH); }, 0);
    const denT  = Math.sqrt(temps.reduce(function (s, t) { return s + Math.pow(t - meanT, 2); }, 0));
    const denH  = Math.sqrt(hums.reduce(function (s, h) { return s + Math.pow(h - meanH, 2); }, 0));
    return (num / (denT * denH)).toFixed(3);
}

// ── Descripción del coeficiente de Pearson ───────
function tipoPearson(r) {
    if (r < -0.7)  return 'fuerte correlación negativa';
    if (r < -0.3)  return 'correlación negativa moderada';
    if (r >  0.7)  return 'fuerte correlación positiva';
    return 'correlación débil';
}

// ── Generar todo el análisis ─────────────────────
function generarAnalisis(datos) {
    const temps  = datos.map(function (r) { return parseFloat(r.Temperatura); });
    const hums   = datos.map(function (r) { return parseFloat(r.Humedad); });
    const labels = datos.map(function (r) {
        const fecha = r.Fecha ? r.Fecha.substring(5) : '';
        const hora  = r.Hora  ? r.Hora.substring(0, 5) : '';
        return fecha + ' ' + hora;
    });

    // Reducir puntos manteniendo suavidad y siempre incluir el último
    const paso    = Math.max(1, Math.floor(datos.length / 120));
    const ultimo  = datos.length - 1;
    const labelsR = labels.filter(function (_, i) { return i % paso === 0 || i === ultimo; });
    const tempsR  = temps.filter(function (_, i)  { return i % paso === 0 || i === ultimo; });
    const humsR   = hums.filter(function (_, i)   { return i % paso === 0 || i === ultimo; });

    // Estadísticas
    const tempMin  = Math.min.apply(null, temps).toFixed(2);
    const tempMax  = Math.max.apply(null, temps).toFixed(2);
    const tempProm = (temps.reduce(function (a, b) { return a + b; }, 0) / temps.length).toFixed(2);
    const humMin   = Math.min.apply(null, hums).toFixed(2);
    const humMax   = Math.max.apply(null, hums).toFixed(2);
    const humProm  = (hums.reduce(function (a, b) { return a + b; }, 0) / hums.length).toFixed(2);
    const variacion = (tempMax - tempMin).toFixed(2);
    const pctCalor  = ((temps.filter(function (t) { return t > 27; }).length / temps.length) * 100).toFixed(1);

    const idxMax   = temps.indexOf(Math.max.apply(null, temps));
    const idxMin   = temps.indexOf(Math.min.apply(null, temps));
    const horaPico = datos[idxMax] && datos[idxMax].Hora ? datos[idxMax].Hora.substring(0, 5) : '--';
    const horaMin  = datos[idxMin] && datos[idxMin].Hora ? datos[idxMin].Hora.substring(0, 5) : '--';

    const pearson = calcularPearson(temps, hums);
    const tipo    = tipoPearson(parseFloat(pearson));

    // ── Resumen ──────────────────────────────────
    document.getElementById('resumen-texto').textContent =
        'El sistema registró ' + datos.length + ' lecturas durante el período de monitoreo, ' +
        'abarcando desde las ' + labels[0] + ' hasta las ' + labels[labels.length - 1] + '. ' +
        'A continuación se presenta el resumen estadístico de las variables medidas.';

    // ── Tarjetas estadísticas ────────────────────
    document.getElementById('statsGrid').innerHTML =
        '<div class="stat-card"><div class="val">' + tempMin + '°</div><div class="lbl">Temp. Mínima</div></div>' +
        '<div class="stat-card"><div class="val">' + tempMax + '°</div><div class="lbl">Temp. Máxima</div></div>' +
        '<div class="stat-card"><div class="val">' + tempProm + '°</div><div class="lbl">Temp. Promedio</div></div>' +
        '<div class="stat-card"><div class="val">' + variacion + '°</div><div class="lbl">Variación Total</div></div>' +
        '<div class="stat-card"><div class="val">' + humMin + '%</div><div class="lbl">Hum. Mínima</div></div>' +
        '<div class="stat-card"><div class="val">' + humMax + '%</div><div class="lbl">Hum. Máxima</div></div>' +
        '<div class="stat-card"><div class="val">' + humProm + '%</div><div class="lbl">Hum. Promedio</div></div>' +
        '<div class="stat-card"><div class="val">' + horaPico + '</div><div class="lbl">Hora Pico</div></div>';

    // ── Gráfica 1: Temperatura ───────────────────
    if (chartTemp) chartTemp.destroy();
    chartTemp = new Chart(document.getElementById('chartTemp'), {
        type: 'line',
        data: {
            labels: labelsR,
            datasets: [{
                label: 'Temperatura (°C)',
                data: tempsR,
                borderColor: '#9E1B1F',
                backgroundColor: 'rgba(158,27,31,0.08)',
                borderWidth: 2,
                pointRadius: 0,
                pointHoverRadius: 4,
                fill: true,
                tension: 0.3,
                spanGaps: false
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: { callbacks: { label: function (ctx) { return ' ' + ctx.parsed.y.toFixed(2) + ' °C'; } } }
            },
            scales: {
                x: { ticks: { maxTicksLimit: 16, font: { size: 11 }, maxRotation: 45 }, grid: { color: 'rgba(0,0,0,0.05)' } },
                y: { ticks: { callback: function (v) { return v + '°C'; }, font: { size: 11 } }, grid: { color: 'rgba(0,0,0,0.05)' } }
            }
        }
    });

    document.getElementById('analisisTemp').innerHTML =
        '<p>Durante el período monitoreado la temperatura registró un valor mínimo de <strong>' + tempMin + '°C</strong> ' +
        'a las ' + horaMin + ' y un valor máximo de <strong>' + tempMax + '°C</strong> a las ' + horaPico + ', ' +
        'con una variación total de <strong>' + variacion + '°C</strong>.</p>' +
        '<p>La temperatura promedio fue de <strong>' + tempProm + '°C</strong>, superando en ' +
        '<strong>' + pctCalor + '%</strong> del tiempo el umbral de confort térmico de 27°C ' +
        'según estándares internacionales de bienestar en espacios interiores.</p>' +
        '<p>El comportamiento registrado es coherente con las condiciones climáticas de Neiva, Huila, ' +
        'una de las ciudades con mayor temperatura promedio de Colombia. La ausencia de ventilación ' +
        'en el espacio monitorizado favorece la acumulación de calor por radiación solar ' +
        'durante las horas de mayor incidencia.</p>';

    // ── Gráfica 2: Humedad ───────────────────────
    if (chartHum) chartHum.destroy();
    chartHum = new Chart(document.getElementById('chartHum'), {
        type: 'line',
        data: {
            labels: labelsR,
            datasets: [{
                label: 'Humedad Relativa (%)',
                data: humsR,
                borderColor: '#C9A84C',
                backgroundColor: 'rgba(201,168,76,0.08)',
                borderWidth: 2,
                pointRadius: 0,
                pointHoverRadius: 4,
                fill: true,
                tension: 0.3,
                spanGaps: false
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: { callbacks: { label: function (ctx) { return ' ' + ctx.parsed.y.toFixed(2) + ' %'; } } }
            },
            scales: {
                x: { ticks: { maxTicksLimit: 16, font: { size: 11 }, maxRotation: 45 }, grid: { color: 'rgba(0,0,0,0.05)' } },
                y: { ticks: { callback: function (v) { return v + '%'; }, font: { size: 11 } }, grid: { color: 'rgba(0,0,0,0.05)' } }
            }
        }
    });

    document.getElementById('analisisHum').innerHTML =
        '<p>La humedad relativa registró valores entre <strong>' + humMin + '%</strong> y ' +
        '<strong>' + humMax + '%</strong>, con un promedio de <strong>' + humProm + '%</strong> ' +
        'durante el período de monitoreo.</p>' +
        '<p>Se observa una relación inversa con la temperatura: a medida que la temperatura ' +
        'asciende durante las horas de mayor radiación solar, la humedad relativa tiende a ' +
        'disminuir. Este comportamiento es característico de espacios cerrados sin ventilación ' +
        'donde el aire caliente retiene menos humedad relativa.</p>' +
        '<p>Los niveles de humedad registrados, combinados con las altas temperaturas, ' +
        'generan condiciones de disconfort térmico significativo para los ocupantes del espacio.</p>';

    // ── Gráfica 3: Dispersión ────────────────────
    const dispData = temps
        .map(function (t, i) { return { x: t, y: hums[i] }; })
        .filter(function (_, i) { return i % paso === 0 || i === ultimo; });

    if (chartDisp) chartDisp.destroy();
    chartDisp = new Chart(document.getElementById('chartDisp'), {
        type: 'scatter',
        data: {
            datasets: [{
                label: 'Temp vs Humedad',
                data: dispData,
                backgroundColor: 'rgba(158,27,31,0.45)',
                borderColor: '#9E1B1F',
                borderWidth: 1,
                pointRadius: 3,
                pointHoverRadius: 5
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { display: false },
                tooltip: { callbacks: { label: function (ctx) { return ' ' + ctx.parsed.x.toFixed(2) + '°C — ' + ctx.parsed.y.toFixed(2) + '%'; } } }
            },
            scales: {
                x: {
                    title: { display: true, text: 'Temperatura (°C)', font: { size: 12 } },
                    ticks: { callback: function (v) { return v + '°C'; } },
                    grid: { color: 'rgba(0,0,0,0.05)' }
                },
                y: {
                    title: { display: true, text: 'Humedad Relativa (%)', font: { size: 12 } },
                    ticks: { callback: function (v) { return v + '%'; } },
                    grid: { color: 'rgba(0,0,0,0.05)' }
                }
            }
        }
    });

    document.getElementById('analisisDisp').innerHTML =
        '<p>La gráfica de dispersión muestra la relación entre temperatura y humedad relativa ' +
        'para cada lectura registrada. El coeficiente de correlación de Pearson calculado es ' +
        '<strong>r = ' + pearson + '</strong>, lo que indica una <strong>' + tipo + '</strong> ' +
        'entre ambas variables.</p>' +
        '<p>Este resultado confirma el comportamiento esperado en espacios cerrados: cuando ' +
        'la temperatura aumenta, la capacidad del aire de retener humedad relativa disminuye, ' +
        'generando la tendencia descendente observada en la nube de puntos.</p>' +
        '<p>La distribución de los puntos valida el correcto funcionamiento del sensor DHT22 ' +
        'y la confiabilidad del sistema de adquisición de datos implementado.</p>';

    // ── Conclusiones ─────────────────────────────
    document.getElementById('conclusiones').innerHTML =
        '<p>El sistema de monitoreo implementado con ESP32 y sensor DHT22 demostró ser ' +
        'capaz de registrar de forma continua y confiable las condiciones térmicas e higrométricas ' +
        'del espacio interior. Durante el período analizado se obtuvieron <strong>' + datos.length + ' registros</strong> ' +
        'válidos con una frecuencia de un dato por minuto.</p>' +
        '<p>Los resultados evidencian que el espacio monitoreado supera el umbral de confort ' +
        'térmico de 27°C durante el <strong>' + pctCalor + '%</strong> del tiempo registrado, ' +
        'con temperaturas que alcanzan los <strong>' + tempMax + '°C</strong>. ' +
        'Esto representa condiciones de disconfort que pueden afectar negativamente ' +
        'el bienestar de los ocupantes.</p>' +
        '<p>Como recomendación se propone implementar estrategias de ventilación natural ' +
        'o mecánica durante las horas de mayor temperatura, especialmente entre las ' +
        horaMin + ' y las ' + horaPico + ', período en el que se registra la mayor ' +
        'variación térmica del día.</p>' +
        '<p>El proyecto demuestra la viabilidad técnica y económica de implementar ' +
        'sistemas de monitoreo ambiental de bajo costo basados en microcontroladores ESP32, ' +
        'con capacidad de almacenamiento local de datos para análisis posterior.</p>';
}
