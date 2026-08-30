// ============================================================================
// i18n — English, 简体中文, हिन्दी, Español, العربية.
// UseT() hook returns the message table for the active language; formatting
// via K(message, {vars}).
// ============================================================================
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type Lang = "en" | "zh" | "hi" | "es" | "ar";

export const LANGS: { code: Lang; label: string; short: string }[] = [
  { code: "en", label: "English", short: "EN" },
  { code: "zh", label: "简体中文", short: "中" },
  { code: "hi", label: "हिन्दी", short: "हि" },
  { code: "es", label: "Español", short: "ES" },
  { code: "ar", label: "العربية", short: "ع" },
];

const EN_MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const EN_MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const en = {
  headlineStrong: "El Niño strengthens; a very strong event is expected this winter",
  headlineFallback: "El Niño advisory active",
  months: EN_MONTHS,
  monthsShort: EN_MONTHS_SHORT,
  introWarm: "The equatorial Pacific is warming steadily: the {month} index stands at {value}.",
  introCpc: "The U.S. Climate Prediction Center keeps an El Niño Advisory and puts the chance of a very strong event this fall and winter {chance}.",
  introModels: "Six international climate models expect the water temperature to peak at {value} around {month}.",
  attribution: "Based on the official ENSO Diagnostic Discussion (NOAA Climate Prediction Center, {date}).",
  fullStatement: "Full statement",
  whereStands: "Where things stand",
  thermoWarmer: "Warmer than normal",
  thermoModerate: "Moderate El Niño",
  thermoWarmLayer: "Warm layer below the surface",
  captionWater: "{month} 2026 · Niño-3.4 region · water now {temp}",
  captionOni: "Official 3-month index (ONI), May–July 2026",
  captionWarm: "{value} extra heat in the upper 300 m, July 2026",
  howBad: "How bad is it?",
  curveAbove: "Three months in, the {year} event runs {diff}°C above the average of the record events at the same stage.",
  curveBelow: "Three months in, the {year} event runs {diff}°C below the average of the record events at the same stage.",
  badCaption: "The three strongest El Niños on record, aligned at the month each event became active. Values: NOAA CPC monthly Niño-3.4 anomaly (ERSST, 1991–2020 mean).",
  legendCurrent: "2026–27 (current)",
  legendMean: "Climatological mean",
  predicted: "What is predicted?",
  forecastSummary: "Forecast: {value}°C peak in {month} (range {min}–{max}°C).",
  predictedCaption: "Six international climate models (NOAA NMME project), issued {date}.",
  observed: "Observed (measured)",
  forecastMean: "Forecast (6-model mean)",
  modelRange: "Model range",
  consequences: "What are the consequences?",
  catDrought: "Drier than usual",
  catFlood: "Flooding risk",
  catWet: "Wetter than usual",
  catMuted: "Little change expected",
  tipDrought: "Drier than usual — drought risk peaks September–November.",
  tipFlood: "Heavy rain and flooding risk — worst in December–February.",
  tipWet: "Above-normal rainfall — mainly October–March.",
  tipMuted: "No strong, consistent effect documented — conditions vary from year to year.",
  howLong: "How long does this last?",
  outlookCaption: "Official NOAA CPC probability of El Niño per three-month season, {date}.",
  noForecast: "No official probability forecast published.",
  footer1: "Data: NOAA CPC · NOAA PSL · GODAS — updated twice a day.",
  footerRaw: "raw data",
  footerDisc: "official discussion",
  footerModel: "model forecast",
  footerNote: "— independent project, not affiliated with NOAA",
  loading: "Loading data…",
  retry: "Retry",
  noData: "No data available.",
  loadingMap: "Loading map…",
  chance90: "greater than 90%",
  language: "Language",
};

const ZH_MONTHS = ["一月", "二月", "三月", "四月", "五月", "六月", "七月", "八月", "九月", "十月", "十一月", "十二月"];

const zh: typeof en = {
  headlineStrong: "厄尔尼诺正在增强；预计今冬将出现极强事件",
  headlineFallback: "厄尔尼诺警报生效中",
  months: ZH_MONTHS,
  monthsShort: ZH_MONTHS,
  introWarm: "赤道太平洋持续变暖：{month} 指数达到 {value}。",
  introCpc: "美国气候预测中心维持厄尔尼诺警报，并将今冬至冬季出现极强厄尔尼诺的概率定为{chance}。",
  introModels: "六个国际气候模型预计海温将在{month}前后达到 {value} 的峰值。",
  attribution: "基于官方《ENSO 诊断讨论》（美国气候预测中心，{date}）。",
  fullStatement: "完整声明",
  whereStands: "现状",
  thermoWarmer: "比常年偏暖",
  thermoModerate: "中等强度厄尔尼诺",
  thermoWarmLayer: "海面以下的暖层",
  captionWater: "{month} 2026 · 尼诺3.4区域 · 当前水温 {temp}",
  captionOni: "官方3个月指数（ONI），2026年5–7月",
  captionWarm: "上层300米额外蓄热 {value}，2026年7月",
  howBad: "有多严重？",
  curveAbove: "至今3个月，{year} 事件比同期历史纪录事件的平均值高 {diff}°C。",
  curveBelow: "至今3个月，{year} 事件比同期历史纪录事件的平均值低 {diff}°C。",
  badCaption: "历史上三次最强厄尔尼诺，按各自事件开始的月份对齐。数据：NOAA CPC 月度尼诺3.4距平（ERSST，1991–2020年基准）。",
  legendCurrent: "2026–27（当前）",
  legendMean: "气候平均值",
  predicted: "预测如何？",
  forecastSummary: "预测：{month}前后达到 {value}°C 峰值（区间 {min}–{max}°C）。",
  predictedCaption: "六个国际气候模型（NOAA NMME 项目），发布于 {date}。",
  observed: "实测值",
  forecastMean: "预测（6模型平均）",
  modelRange: "模型区间",
  consequences: "有哪些影响？",
  catDrought: "比常年偏干",
  catFlood: "洪水风险",
  catWet: "比常年偏湿",
  catMuted: "预计变化不大",
  tipDrought: "比常年更干——旱情风险在9–11月最高。",
  tipFlood: "强降雨和洪水风险——12月至2月最严重。",
  tipWet: "降水高于常年——主要在10月至3月。",
  tipMuted: "没有明确、一致的影响记录——各年情况不同。",
  howLong: "会持续多久？",
  outlookCaption: "NOAA CPC 官方厄尔尼诺概率，按三个月季节，{date}。",
  noForecast: "尚无官方概率预测。",
  footer1: "数据来源：NOAA CPC · NOAA PSL · GODAS —— 每天更新两次。",
  footerRaw: "原始数据",
  footerDisc: "官方讨论",
  footerModel: "模型预报",
  footerNote: "—— 独立项目，与NOAA无关",
  loading: "正在加载数据…",
  retry: "重试",
  noData: "暂无数据。",
  loadingMap: "正在加载地图…",
  chance90: "90%以上",
  language: "语言",
};

const HI_MONTHS = ["जनवरी", "फ़रवरी", "मार्च", "अप्रैल", "मई", "जून", "जुलाई", "अगस्त", "सितंबर", "अक्टूबर", "नवंबर", "दिसंबर"];

const hi: typeof en = {
  headlineStrong: "एल नीनो मजबूत हो रहा है; इस सर्दी में अति-शक्तिशाली घटना की उम्मीद",
  headlineFallback: "एल नीनो सलाह जारी",
  months: HI_MONTHS,
  monthsShort: HI_MONTHS,
  introWarm: "भूमध्यरेखीय प्रशांत महासागर लगातार गर्म हो रहा है: {month} सूचकांक {value} पर है।",
  introCpc: "अमेरिकी जलवायु पूर्वानुमान केंद्र ने एल नीनो सलाह जारी की है और इस पतझड़–सर्दियों में अति-शक्तिशाली घटना की संभावना {chance} आंकी है।",
  introModels: "छह अंतरराष्ट्रीय जलवायु मॉडल पानी के तापमान को {month} के आसपास {value} के शिखर पर पहुंचने की उम्मीद करते हैं।",
  attribution: "आधिकारिक ENSO निदान चर्चा पर आधारित (NOAA जलवायु पूर्वानुमान केंद्र, {date})।",
  fullStatement: "पूरा वक्तव्य",
  whereStands: "वर्तमान स्थिति",
  thermoWarmer: "सामान्य से अधिक गर्म",
  thermoModerate: "मध्यम एल नीनो",
  thermoWarmLayer: "सतह के नीचे गर्म परत",
  captionWater: "{month} 2026 · निनो-3.4 क्षेत्र · अभी पानी {temp}",
  captionOni: "आधिकारिक 3-माह सूचकांक (ONI), मई–जुलाई 2026",
  captionWarm: "ऊपरी 300 मी में {value} अतिरिक्त गर्मी, जुलाई 2026",
  howBad: "कितना गंभीर है?",
  curveAbove: "तीन महीनों में, {year} घटना रिकॉर्ड घटनाओं के औसत से {diff}°C ऊपर चल रही है।",
  curveBelow: "तीन महीनों में, {year} घटना रिकॉर्ड घटनाओं के औसत से {diff}°C नीचे चल रही है।",
  badCaption: "अब तक के तीन सबसे शक्तिशाली एल नीनो, प्रत्येक घटना के शुरू होने के महीने के अनुसार संरेखित। आंकड़े: NOAA CPC मासिक निनो-3.4 विसंगति (ERSST, 1991–2020 आधार)।",
  legendCurrent: "2026–27 (वर्तमान)",
  legendMean: "जलवायु औसत",
  predicted: "पूर्वानुमान क्या है?",
  forecastSummary: "पूर्वानुमान: {month} में {value}°C शिखर (सीमा {min}–{max}°C)।",
  predictedCaption: "छह अंतरराष्ट्रीय जलवायु मॉडल (NOAA NMME परियोजना), जारी: {date}।",
  observed: "मापा गया (वास्तविक)",
  forecastMean: "पूर्वानुमान (6-मॉडल औसत)",
  modelRange: "मॉडल परास",
  consequences: "परिणाम क्या होंगे?",
  catDrought: "सामान्य से अधिक सूखा",
  catFlood: "बाढ़ का जोखिम",
  catWet: "सामान्य से अधिक बारिश",
  catMuted: "थोड़ा बदलाव अपेक्षित",
  tipDrought: "सामान्य से अधिक सूखा — सूखे का जोखिम सितंबर–नवंबर में सबसे अधिक।",
  tipFlood: "भारी बारिश और बाढ़ का जोखिम — दिसंबर–फरवरी में सबसे बुरा।",
  tipWet: "सामान्य से अधिक वर्षा — मुख्यतः अक्टूबर–मार्च।",
  tipMuted: "कोई स्पष्ट, सुसंगत प्रभाव दर्ज नहीं — स्थितियाँ साल-दर-साल बदलती हैं।",
  howLong: "यह कब तक रहेगा?",
  outlookCaption: "NOAA CPC आधिकारिक एल नीनो संभावना, तीन-माह ऋतु के अनुसार, {date}।",
  noForecast: "कोई आधिकारिक संभावना पूर्वानुमान उपलब्ध नहीं।",
  footer1: "डेटा: NOAA CPC · NOAA PSL · GODAS — दिन में दो बार अद्यतन।",
  footerRaw: "कच्चा डेटा",
  footerDisc: "आधिकारिक चर्चा",
  footerModel: "मॉडल पूर्वानुमान",
  footerNote: "— स्वतंत्र परियोजना, NOAA से संबद्ध नहीं",
  loading: "डेटा लोड हो रहा है…",
  retry: "पुनः प्रयास",
  noData: "डेटा उपलब्ध नहीं।",
  loadingMap: "मानचित्र लोड हो रहा है…",
  chance90: "90% से अधिक",
  language: "भाषा",
};

const ES_MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const ES_MONTHS_SHORT = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

const es: typeof en = {
  headlineStrong: "El Niño se fortalece; se espera un evento muy fuerte este invierno",
  headlineFallback: "Aviso de El Niño activo",
  months: ES_MONTHS,
  monthsShort: ES_MONTHS_SHORT,
  introWarm: "El Pacífico ecuatorial sigue calentándose: el índice de {month} se sitúa en {value}.",
  introCpc: "El Centro de Predicción Climática de EE. UU. mantiene un aviso de El Niño y sitúa la probabilidad de un evento muy fuerte este otoño e invierno en {chance}.",
  introModels: "Seis modelos climáticos internacionales prevén que la temperatura del agua alcance su máximo en {month}, con {value}.",
  attribution: "Basado en el ENSO Diagnostic Discussion oficial (NOAA Climate Prediction Center, {date}).",
  fullStatement: "Declaración completa",
  whereStands: "Situación actual",
  thermoWarmer: "Más cálido de lo normal",
  thermoModerate: "El Niño moderado",
  thermoWarmLayer: "Capa cálida bajo la superficie",
  captionWater: "{month} 2026 · región Niño-3.4 · agua ahora a {temp}",
  captionOni: "Índice oficial de 3 meses (ONI), mayo–julio 2026",
  captionWarm: "{value} de calor extra en los 300 m superiores, julio 2026",
  howBad: "¿Qué tan grave es?",
  curveAbove: "A tres meses del inicio, el evento de {year} va {diff}°C por encima del promedio de los eventos récord en la misma fase.",
  curveBelow: "A tres meses del inicio, el evento de {year} va {diff}°C por debajo del promedio de los eventos récord en la misma fase.",
  badCaption: "Los tres El Niño más fuertes registrados, alineados por el mes en que cada evento comenzó. Datos: anomalía mensual Niño-3.4 del NOAA CPC (ERSST, media 1991–2020).",
  legendCurrent: "2026–27 (actual)",
  legendMean: "Media climatológica",
  predicted: "¿Qué se prevé?",
  forecastSummary: "Previsión: máximo de {value}°C en {month} (rango {min}–{max}°C).",
  predictedCaption: "Seis modelos climáticos internacionales (proyecto NOAA NMME), emitido el {date}.",
  observed: "Observado (medido)",
  forecastMean: "Previsión (media de 6 modelos)",
  modelRange: "Rango de modelos",
  consequences: "¿Cuáles son las consecuencias?",
  catDrought: "Más seco de lo normal",
  catFlood: "Riesgo de inundaciones",
  catWet: "Más húmedo de lo normal",
  catMuted: "Poco cambio esperado",
  tipDrought: "Más seco de lo normal — el riesgo de sequía alcanza su máximo entre septiembre y noviembre.",
  tipFlood: "Lluvias intensas y riesgo de inundación — lo peor en diciembre–febrero.",
  tipWet: "Precipitaciones por encima de lo normal — principalmente de octubre a marzo.",
  tipMuted: "Sin efecto documentado fuerte y consistente — las condiciones varían de un año a otro.",
  howLong: "¿Cuánto durará esto?",
  outlookCaption: "Probabilidad oficial de El Niño del NOAA CPC por temporada de tres meses, {date}.",
  noForecast: "No hay previsión de probabilidad oficial publicada.",
  footer1: "Datos: NOAA CPC · NOAA PSL · GODAS — actualizado dos veces al día.",
  footerRaw: "datos brutos",
  footerDisc: "discusión oficial",
  footerModel: "previsión de modelos",
  footerNote: "— proyecto independiente, no afiliado a NOAA",
  loading: "Cargando datos…",
  retry: "Reintentar",
  noData: "No hay datos disponibles.",
  loadingMap: "Cargando mapa…",
  chance90: "más del 90%",
  language: "Idioma",
};

const AR_MONTHS = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];

const ar: typeof en = {
  headlineStrong: "إل نينو يشتد؛ من المتوقع وقوع حدث قوي جدًا هذا الشتاء",
  headlineFallback: "تحذير إل نينو سارٍ",
  months: AR_MONTHS,
  monthsShort: AR_MONTHS,
  introWarm: "المحيط الهادئ الاستوائي يسخن باستمرار: مؤشر {month} بلغ {value}.",
  introCpc: "يُبقي مركز التنبؤ المناخي الأمريكي تحذير إل نينو قائمًا، ويقدّر احتمال حدوث حدث قوي جدًا هذا الخريف والشتاء بـ {chance}.",
  introModels: "تتوقع ستة نماذج مناخية دولية أن تبلغ درجة حرارة الماء ذروتها حول {month} عند {value}.",
  attribution: "استنادًا إلى النقاش التشخيصي الرسمي لظاهرة ENSO (NOAA، مركز التنبؤ المناخي، {date}).",
  fullStatement: "البيان الكامل",
  whereStands: "الوضع الحالي",
  thermoWarmer: "أدفأ من المعتاد",
  thermoModerate: "إل نينو معتدل",
  thermoWarmLayer: "طبقة دافئة تحت السطح",
  captionWater: "{month} 2026 · منطقة نينو 3.4 · حرارة الماء الآن {temp}",
  captionOni: "المؤشر الرسمي لثلاثة أشهر (ONI)، مايو–يوليو 2026",
  captionWarm: "{value} حرارة إضافية في الطبقة العليا 300 م، يوليو 2026",
  howBad: "ما مدى خطورة الوضع؟",
  curveAbove: "بعد ثلاثة أشهر من البداية، يتجاوز حدث {year} متوسط الأحداث القياسية في المرحلة نفسها بمقدار {diff} درجة مئوية.",
  curveBelow: "بعد ثلاثة أشهر من البداية، يقل حدث {year} عن متوسط الأحداث القياسية في المرحلة نفسها بمقدار {diff} درجة مئوية.",
  badCaption: "أقوى ثلاث ظواهر إل نينو مسجلة، محاذاة حسب شهر بداية كل حدث. البيانات: شذوذ نينو 3.4 الشهري من NOAA CPC (ERSST، أساس 1991–2020).",
  legendCurrent: "2026–27 (الحالي)",
  legendMean: "المتوسط المناخي",
  predicted: "ما التوقعات؟",
  forecastSummary: "التوقعات: ذروة {value} درجة مئوية في {month} (نطاق {min}–{max} درجة).",
  predictedCaption: "ستة نماذج مناخية دولية (مشروع NOAA NMME)، صدرت في {date}.",
  observed: "المرصود (المقاس)",
  forecastMean: "التوقعات (متوسط 6 نماذج)",
  modelRange: "نطاق النماذج",
  consequences: "ما العواقب؟",
  catDrought: "أجف من المعتاد",
  catFlood: "خطر الفيضانات",
  catWet: "أكثر رطوبة من المعتاد",
  catMuted: "تغيّر طفيف متوقع",
  tipDrought: "أجف من المعتاد — يبلغ خطر الجفاف ذروته بين سبتمبر ونوفمبر.",
  tipFlood: "أمطار غزيرة وخطر فيضانات — الأسوأ بين ديسمبر وفبراير.",
  tipWet: "هطول أعلى من المعتاد — أساسًا من أكتوبر إلى مارس.",
  tipMuted: "لا أثر قوي ومتسق موثق — تختلف الأحوال من عام إلى آخر.",
  howLong: "كم سيستمر هذا؟",
  outlookCaption: "احتمال إل نينو الرسمي من NOAA CPC لكل موسم من ثلاثة أشهر، {date}.",
  noForecast: "لا يوجد توقع احتمالي رسمي منشور.",
  footer1: "البيانات: NOAA CPC · NOAA PSL · GODAS — تُحدَّث مرتين يوميًا.",
  footerRaw: "البيانات الخام",
  footerDisc: "النقاش الرسمي",
  footerModel: "توقعات النماذج",
  footerNote: "— مشروع مستقل غير تابع لمؤسسة NOAA",
  loading: "جارٍ تحميل البيانات…",
  retry: "إعادة المحاولة",
  noData: "لا تتوفر بيانات.",
  loadingMap: "جارٍ تحميل الخريطة…",
  chance90: "أكثر من 90%",
  language: "اللغة",
};

export const MESSAGES: Record<Lang, typeof en> = { en, zh, hi, es, ar };

export function msg(t: Record<string, unknown>, key: string, vars?: Record<string, string>): string {
  let s = String(t[key] ?? (en as Record<string, unknown>)[key] ?? key);
  if (vars) {
    for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(v);
  }
  return s;
}

interface I18nCtx {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: Record<string, string>;
}

const Ctx = createContext<I18nCtx>({ lang: "en", setLang: () => {}, t: en });

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>(() => {
    try {
      const saved = localStorage.getItem("lang");
      return (LANGS.some(l => l.code === saved) ? saved : "en") as Lang;
    } catch {
      return "en";
    }
  });

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
    try { localStorage.setItem("lang", lang); } catch { /* ignore */ }
  }, [lang]);

  const value = useMemo(() => ({ lang, setLang, t: MESSAGES[lang] }), [lang]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useI18n(): I18nCtx {
  return useContext(Ctx);
}
