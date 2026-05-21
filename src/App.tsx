import { useState, useEffect } from "react";
import html2canvas from "html2canvas";
import { 
  Calculator, 
  FileText, 
  Copy, 
  Check, 
  RefreshCw, 
  Info, 
  HelpCircle, 
  TrendingUp, 
  Maximize2, 
  DollarSign, 
  ChevronRight,
  Printer,
  Download,
  Building2,
  MapPin,
  Image as ImageIcon
} from "lucide-react";
import { 
  calculateCubicle, 
  getProfitScenarios, 
  CubicleInputs, 
  CalculationResult, 
  ProfitScenario 
} from "./calculator";

interface FeedbackMessage {
  type: 'success' | 'error' | 'info';
  text: string;
}

export default function App() {
  // 1. 상태값 정의
  const [frontHeight, setFrontHeight] = useState<number | "">("");
  const [doorHeight, setDoorHeight] = useState<number | "">("");
  const [partitionHeight, setPartitionHeight] = useState<number | "">("");
  const [pbType, setPbType] = useState<"일반 PB" | "방수 PB">("일반 PB");
  const [hpmType, setHpmType] = useState<"일반 HPM" | "메탈 HPM">("일반 HPM");
  const [baseboard, setBaseboard] = useState<"없음" | "전면" | "전체">("없음");
  const [quantity, setQuantity] = useState<number | "">("");
  const [doorCount, setDoorCount] = useState<number | "">("");

  // 업체 및 현장명 정보 입력 상태
  const [companyName, setCompanyName] = useState<string>("");
  const [siteName, setSiteName] = useState<string>("");
  const [isSavingImage, setIsSavingImage] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<FeedbackMessage | null>(null);

  const fHeight = Number(frontHeight) || 0;
  const dHeight = Number(doorHeight) || 0;
  const pHeight = Number(partitionHeight) || 0;
  const qty = Number(quantity) || 0;
  const dCount = Number(doorCount) || 0;

  // 2. 누락값 검증용 임시 플래그 (0이나 비어있는 경우 검증을 위함)
  const isInputValid = fHeight > 0 && dHeight > 0 && pHeight > 0 && qty > 0;

  // Dynamic Ratio calculation for UI Labels
  let doorRatioVal = 0.25;
  let frontRatioVal = 0.25;
  const partitionRatioVal = 0.50;

  if (dCount > 0 && qty > 0) {
    const resolvedDHeight = dHeight > 0 ? dHeight : 1800;
    const doorAreaVal = dCount * 0.6 * (resolvedDHeight / 1000);
    doorRatioVal = doorAreaVal / qty;
    frontRatioVal = Math.max(0, 1.0 - 0.50 - doorRatioVal);
  }

  const doorPctText = dCount > 0 && qty > 0 ? `${(doorRatioVal * 100).toFixed(1)}%` : "25%";
  const frontPctText = dCount > 0 && qty > 0 ? `${(frontRatioVal * 100).toFixed(1)}%` : "25%";
  const partitionPctText = "50%";
  
  // 3. 계산 실행 (HPM 타입을 안전하게 매칭)
  const sanitizedHpmType = hpmType.includes("메탈") ? "메탈 HPM" : "일반 HPM";
  const calculation: CalculationResult = calculateCubicle({
    frontHeight: fHeight,
    doorHeight: dHeight,
    partitionHeight: pHeight,
    pbType,
    hpmType: sanitizedHpmType,
    baseboard,
    quantity: qty,
    doorCount: dCount > 0 ? dCount : undefined
  });

  const scenarios: ProfitScenario[] = getProfitScenarios(calculation.totalCost, qty);

  // 이미지 저장 함수 (html2canvas)
  const handleSaveAsImage = async () => {
    const element = document.getElementById("estimate-dashboard");
    if (!element) return;

    setIsSavingImage(true);
    setFeedback({ type: 'info', text: "견적서 이미지를 생성하고 있습니다... 수 초 내 다운로드가 시작됩니다." });

    try {
      // Create options for precise capture preserving desktop and mobile rendering nicely
      const canvas = await html2canvas(element, {
        scale: 2, // 2x high definition resolution
        useCORS: true,
        backgroundColor: "#ffffff",
        logging: false,
        allowTaint: true,
        onclone: (clonedDoc) => {
          // html2canvas passes standard clonedDoc. Create a helper canvas to normalize oklch
          const helperCanvas = clonedDoc.createElement("canvas");
          helperCanvas.width = 1;
          helperCanvas.height = 1;
          const ctx = helperCanvas.getContext("2d");
          if (!ctx) return;

          const memo = new Map<string, string>();

          const resolveColor = (colorValue: string): string => {
            if (!colorValue || !colorValue.includes("oklch")) {
              return colorValue;
            }
            if (memo.has(colorValue)) {
              return memo.get(colorValue)!;
            }
            try {
              ctx.fillStyle = "transparent";
              ctx.fillStyle = colorValue;
              const resolved = ctx.fillStyle;
              if (resolved === "transparent" || resolved === "#00000000" || !resolved) {
                return colorValue;
              }
              memo.set(colorValue, resolved);
              return resolved;
            } catch (e) {
              return colorValue;
            }
          };

          const elements = clonedDoc.getElementsByTagName("*");
          for (let i = 0; i < elements.length; i++) {
            const el = elements[i] as HTMLElement;
            if (!el.style) continue;

            try {
              const win = el.ownerDocument?.defaultView || window;
              const computed = win.getComputedStyle(el);
              const propertiesToNormalize = [
                "backgroundColor",
                "color",
                "borderTopColor",
                "borderRightColor",
                "borderBottomColor",
                "borderLeftColor",
                "outlineColor",
                "fill",
                "stroke"
              ];

              propertiesToNormalize.forEach((prop) => {
                const val = computed[prop as any];
                if (val && val.includes("oklch")) {
                  const resolved = resolveColor(val);
                  if (resolved && resolved !== val) {
                    el.style[prop as any] = resolved;
                  }
                }
              });
            } catch (err) {
              // Ignore computed styles error for unsupported elements
            }
          }
        }
      });

      const image = canvas.toDataURL("image/png");
      const link = document.createElement("a");

      const dateStr = new Date().toISOString().split('T')[0];
      const cleanedCompany = companyName.trim() || "실행계산";
      const cleanedSite = siteName.trim() || "";
      const filename = `${cleanedCompany}${cleanedSite ? '_' + cleanedSite : ''}_큐비클_실행견적서_${dateStr}.png`;

      link.href = image;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setFeedback({ type: 'success', text: "성공적으로 견적서 이미지가 저장되었습니다!" });
    } catch (err) {
      console.error(err);
      setFeedback({ type: 'error', text: "이미지 저장에 실패했습니다. 컴퓨터/스마트폰 브라우저 설정을 확인해주세요." });
    } finally {
      setIsSavingImage(false);
    }
  };

  // 피드백 메시지 자동 소멸
  useEffect(() => {
    if (feedback) {
      const timer = setTimeout(() => setFeedback(null), 8000);
      return () => clearTimeout(timer);
    }
  }, [feedback]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans antialiased pb-20">
      {/* 상단 헤더: 요청대로 인쇄, PDF 출력, 마크다운 복사 버튼 삭제 */}
      <header className="bg-slate-900 text-white border-b border-slate-800 sticky top-0 z-50 shadow-md">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-sky-500 rounded-lg text-white shadow-lg shadow-sky-500/10">
              <Calculator className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-bold tracking-tight">큐비클 실행 마스터</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-2xl sm:text-3xl font-black bg-gradient-to-r from-sky-400 to-indigo-300 bg-clip-text text-transparent tracking-tight">
              (주)아이엔판넬
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 mt-8 sm:px-6 lg:px-8">
        {/* 알림 배너 */}
        {feedback && (
          <div className={`mb-6 p-4 rounded-xl border text-sm flex items-start gap-3 shadow-sm transition duration-150 ${
            feedback.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' :
            feedback.type === 'error' ? 'bg-rose-50 border-rose-200 text-rose-800' :
            'bg-sky-50 border-sky-200 text-sky-800'
          }`}>
            <Info className="w-4 h-4 mt-0.5 shrink-0" />
            <div>{feedback.text}</div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* 왼쪽 컬럼: 스마트 분석 및 다이렉트 자재 조절 폼 */}
          <div className="lg:col-span-4 space-y-6">
            
            {/* 1. 업체 및 현장 정보 입력 & 이미지 저장 */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                <Building2 className="w-5 h-5 text-sky-500" />
                <h2 className="text-sm font-bold text-slate-900">🏢 업체 및 현장 정보</h2>
              </div>

              {/* 업체명 입력 */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1">
                  <Building2 className="w-3.5 h-3.5 text-slate-400" />
                  업체명
                </label>
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="예: 아이엔건설"
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 focus:bg-white transition text-slate-800"
                />
              </div>

              {/* 현장명 입력 */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" />
                  현장명
                </label>
                <input
                  type="text"
                  value={siteName}
                  onChange={(e) => setSiteName(e.target.value)}
                  placeholder="예: 강남 테헤란로 빌딩 현장"
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 focus:bg-white transition text-slate-800"
                />
              </div>

              {/* 이미지 저장 버튼 */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleSaveAsImage}
                  disabled={isSavingImage || !isInputValid}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-sky-600 hover:bg-sky-700 active:bg-sky-800 text-white rounded-xl text-xs font-bold transition disabled:opacity-50 shadow-sm cursor-pointer"
                >
                  {isSavingImage ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      견적서 이미지 생성 중...
                    </>
                  ) : (
                    <>
                      <ImageIcon className="w-4 h-4 text-sky-100" />
                      견적서 이미지 파일로 저장하기
                    </>
                  )}
                </button>
                <p className="text-[10px] text-slate-400 text-center mt-2 leading-relaxed">
                  스마트폰 갤러리 또는 PC 다운로드 폴더에서 확인할 수 있습니다.
                </p>
              </div>
            </div>

            {/* 2. 큐비클 상세 조절 수동 폼 */}
            <div className="bg-white rounded-2xl p-4 lg:p-5 shadow-sm border border-slate-100 space-y-3.5">
              <div className="border-b border-rose-50 pb-2 flex justify-between items-center">
                <h3 className="text-xs font-bold text-slate-950 flex items-center gap-2">
                  <span className="w-1.5 h-3.5 bg-sky-500 rounded-full inline-block"></span>
                  📊 큐비클 적산 설정
                </h3>
                <span className="text-[9px] text-sky-600 bg-sky-50 px-1.5 py-0.5 rounded font-mono font-bold">LIVE UPDATE</span>
              </div>

              {/* 높이 개별 조절 (전면, 도어, 간벽) */}
              <div className="space-y-2.5">
                <div className="border-b border-slate-100 pb-1">
                  <label className="block text-[11px] font-bold text-slate-900 flex items-center gap-1">
                    📐 파트별 설정 및 높이 (mm)
                  </label>
                </div>

                {/* 도어 수량 입력 필드 (선택) */}
                <div className="bg-slate-50/70 p-2.5 rounded-xl border border-slate-100/85">
                  <label className="block text-[10px] font-bold text-slate-700 mb-1 flex items-center gap-1">
                    🚪 도어 수량 (개) - 선택
                  </label>
                  <input
                    type="number"
                    value={doorCount || ""}
                    onChange={(e) => {
                      const val = e.target.value;
                      setDoorCount(val === "" ? "" : Number(val));
                    }}
                    placeholder="수량 입력 시 도어/전면 전용 배분 적용"
                    className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-sky-500 transition font-mono font-medium"
                  />
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {/* 전면 높이 */}
                  <div>
                    <div className="mb-1 leading-tight min-h-[24px] flex flex-col justify-end">
                      <label className="text-[10px] font-semibold text-slate-500 block">전면 ({frontPctText})</label>
                      {fHeight > 2400 && <span className="text-[8px] text-amber-600 font-bold block leading-none">4*10 규격</span>}
                    </div>
                    <input
                      type="number"
                      value={frontHeight || ""}
                      onChange={(e) => {
                        const val = e.target.value;
                        setFrontHeight(val === "" ? "" : Number(val));
                      }}
                      placeholder="예: 1800"
                      className="w-full px-2 py-1 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-sky-500 focus:bg-white transition text-center font-mono font-semibold"
                    />
                  </div>

                  {/* 도어 높이 */}
                  <div>
                    <div className="mb-1 leading-tight min-h-[24px] flex flex-col justify-end">
                      <label className="text-[10px] font-semibold text-slate-500 block">도어 ({doorPctText})</label>
                      {dHeight > 2400 && <span className="text-[8px] text-amber-600 font-bold block leading-none">4*10 규격</span>}
                    </div>
                    <input
                      type="number"
                      value={doorHeight || ""}
                      onChange={(e) => {
                        const val = e.target.value;
                        setDoorHeight(val === "" ? "" : Number(val));
                      }}
                      placeholder="예: 1800"
                      className="w-full px-2 py-1 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-sky-500 focus:bg-white transition text-center font-mono font-semibold"
                    />
                  </div>

                  {/* 간벽 높이 */}
                  <div>
                    <div className="mb-1 leading-tight min-h-[24px] flex flex-col justify-end">
                      <label className="text-[10px] font-semibold text-slate-500 block">간벽 ({partitionPctText})</label>
                      {pHeight > 2400 && <span className="text-[8px] text-amber-600 font-bold block leading-none">4*10 규격</span>}
                    </div>
                    <input
                      type="number"
                      value={partitionHeight || ""}
                      onChange={(e) => {
                        const val = e.target.value;
                        setPartitionHeight(val === "" ? "" : Number(val));
                      }}
                      placeholder="예: 1800"
                      className="w-full px-2 py-1 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-sky-500 focus:bg-white transition text-center font-mono font-semibold"
                    />
                  </div>
                </div>
              </div>

              {/* PB 종류 선택 */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2">
                  🪵 PB 종류 <span className="text-slate-400 font-normal text-[10px] ml-1">(로스율 8% 반영)</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setPbType("일반 PB")}
                    className={`py-2 px-3 text-xs font-medium rounded-lg border transition ${
                      pbType === "일반 PB"
                        ? "bg-slate-900 text-white border-slate-900 font-bold"
                        : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    일반 PB
                  </button>
                  <button
                    onClick={() => setPbType("방수 PB")}
                    className={`py-2 px-3 text-xs font-medium rounded-lg border transition ${
                      pbType === "방수 PB"
                        ? "bg-slate-900 text-white border-slate-900 font-bold"
                        : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    방수 PB
                  </button>
                </div>
              </div>

              {/* HPM 종류 선택 */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2">
                  🎨 HPM 종류 <span className="text-slate-400 font-normal text-[10px] ml-1">(로스율 8% 반영)</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setHpmType("일반 HPM")}
                    className={`py-2 px-3 text-xs font-medium rounded-lg border transition ${
                      hpmType === "일반 HPM"
                        ? "bg-slate-900 text-white border-slate-900 font-bold"
                        : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    일반 HPM
                  </button>
                  <button
                    onClick={() => setHpmType("메탈 HPM")}
                    className={`py-2 px-3 text-xs font-medium rounded-lg border transition ${
                      hpmType === "메탈 HPM"
                        ? "bg-slate-900 text-white border-slate-900 font-bold"
                        : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    메탈 HPM
                  </button>
                </div>
              </div>

              {/* 걸레받이 선택 */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2">
                  🧱 걸레받이 옵션
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  <button
                    onClick={() => setBaseboard("없음")}
                    className={`py-2 px-1 text-[11px] font-medium rounded-lg border transition ${
                      baseboard === "없음"
                        ? "bg-slate-900 text-white border-slate-900 font-bold"
                        : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    없음
                  </button>
                  <button
                    onClick={() => setBaseboard("전면")}
                    className={`py-2 px-1 text-[11px] font-medium rounded-lg border transition ${
                      baseboard === "전면"
                        ? "bg-slate-900 text-white border-slate-900 font-bold"
                        : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    전면
                  </button>
                  <button
                    onClick={() => setBaseboard("전체")}
                    className={`py-2 px-1 text-[11px] font-medium rounded-lg border transition ${
                      baseboard === "전체"
                        ? "bg-slate-900 text-white border-slate-900 font-bold"
                        : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    전체
                  </button>
                </div>
              </div>

              {/* 총 물량 (㎡) */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs font-bold text-slate-700">
                    📏 총 물량 (㎡)
                  </label>
                </div>
                <input
                  type="number"
                  step="0.1"
                  value={quantity || ""}
                  onChange={(e) => {
                    const val = e.target.value;
                    setQuantity(val === "" ? "" : Number(val));
                  }}
                  placeholder="단위: ㎡ (예: 15.5)"
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 focus:bg-white transition"
                />
              </div>

            </div>

          </div>

          {/* 오른쪽 컬럼: 실시간 견적 대시보드 */}
          <div className="lg:col-span-8 space-y-4">
            
            {!isInputValid ? (
              <div className="bg-red-50 border border-red-200 text-red-800 p-6 rounded-2xl flex flex-col items-center text-center gap-3">
                <HelpCircle className="w-10 h-10 text-red-400" />
                <div>
                  <h3 className="font-bold text-base">정보 누락 안내</h3>
                  <p className="text-xs mt-1 text-red-600">
                    높이 정보와 총 물량(㎡) 정보가 누락되었습니다.<br />
                    값을 양수로 올바르게 완벽하게 채워주세요.
                  </p>
                </div>
              </div>
            ) : (
              <div id="estimate-dashboard" className="space-y-4 bg-slate-50 p-2 sm:p-4 rounded-2xl border border-slate-200">
                {/* 📄 견적서 공식 헤더 (이미지 저장 시 포함되어 출력) */}
                <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-100 shadow-sm space-y-3">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-3 border-b border-slate-100">
                    <div>
                      <span className="text-[9px] font-bold text-sky-600 bg-sky-50 px-2 py-0.5 rounded uppercase tracking-wider">OFFICIAL ESTIMATE REPORT</span>
                      <h2 className="text-lg font-extrabold text-slate-950 mt-1 tracking-tight">큐비클 실행견적서</h2>
                    </div>
                    <div className="text-left sm:text-right">
                      <p className="text-base font-black text-slate-900 tracking-tight">(주)아이엔판넬</p>
                      <p className="text-[9px] text-slate-400 font-medium">산출일자: {new Date().toLocaleDateString('ko-KR')}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div className="bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100 flex items-center gap-2">
                      <div className="p-1.5 bg-white rounded-lg border border-slate-200 text-slate-500">
                        <Building2 className="w-3.5 h-3.5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[9px] text-slate-400 font-bold uppercase">발주업체명</p>
                        <p className="text-xs font-bold text-slate-800 truncate">{companyName.trim() || "미지정"}</p>
                      </div>
                    </div>
                    <div className="bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100 flex items-center gap-2">
                      <div className="p-1.5 bg-white rounded-lg border border-slate-200 text-slate-500">
                        <MapPin className="w-3.5 h-3.5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[9px] text-slate-400 font-bold uppercase">공사현장명</p>
                        <p className="text-xs font-bold text-slate-800 truncate">{siteName.trim() || "미지정"}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 📢 최종 계산 결론 요약 카드 */}
                <div className="bg-slate-950 text-white rounded-2xl p-4 sm:p-5 shadow-xl relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-4 text-sky-500 opacity-5 pointer-events-none">
                    <TrendingUp className="w-24 h-24" />
                  </div>
                  <span className="text-[9px] uppercase font-bold tracking-wider text-sky-400 bg-sky-950 border border-sky-800 px-2 py-0.5 rounded-full">
                    Chief Estimator Realtime Summary
                  </span>
                  
                  <div className="mt-3 space-y-0.5">
                    <p className="text-slate-400 text-[10px] sm:text-xs font-medium">최초 입력 {quantity}㎡ (높이: 전면 {frontHeight}mm / 도어 {doorHeight}mm / 간벽 {partitionHeight}mm) 기준</p>
                    <h2 className="text-lg sm:text-2xl font-extrabold tracking-tight">
                      최종 실행가 : <span className="text-sky-400">{calculation.totalCost.toLocaleString()}</span> 원
                    </h2>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-800/85">
                    <div className="flex items-center justify-between bg-slate-900/80 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl border border-slate-800">
                      <p className="text-[10px] sm:text-xs font-bold text-slate-400 flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block"></span>
                        📊 1㎡당 실행 단가
                      </p>
                      <p className="text-sm sm:text-base font-extrabold text-amber-400 font-mono tracking-tight">
                        {calculation.costPerHebe.toLocaleString()}원
                      </p>
                    </div>
                  </div>
                </div>

                {/* 컴퓨터용 사이드바 그리드 (데스크톱에서 두 단 나란히 배치) */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
                  
                  {/* ■ 1. 세부 실행 내역서 */}
                  <div className="lg:col-span-7 bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                    <div className="p-3 border-b border-slate-100 flex items-center justify-between">
                      <h3 className="text-xs font-bold text-slate-950 flex items-center gap-1.5">
                        <span className="w-1.5 h-3.5 bg-sky-500 rounded-full inline-block"></span>
                        ■ 1. 세부 실행 내역서
                      </h3>
                      <span className="text-[10px] text-slate-400">올림 연산</span>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-[11px] border-collapse min-w-[340px]">
                        <thead>
                          <tr className="bg-slate-50 text-slate-500 font-bold border-b border-slate-100 text-[10px]">
                            <th className="p-2 py-1.5 whitespace-nowrap">구분</th>
                            <th className="p-2 py-1.5">선택 옵션</th>
                            <th className="p-2 py-1.5">소요량</th>
                            <th className="p-2 py-1.5 text-right">금액 (원)</th>
                            <th className="p-2 py-1.5">비고</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-slate-700">
                          {/* 심재 PB Breakdown */}
                          {calculation.pbSheets_door_4x6 > 0 && (
                            <tr className="hover:bg-slate-50 transition">
                              <td className="p-2 font-bold text-slate-900 whitespace-nowrap">심재 (PB 4*6 도어)</td>
                              <td className="p-2 whitespace-nowrap">
                                {pbType === "일반 PB" ? "일반 PB (11,300원)" : "방수 PB (16,000원)"}
                              </td>
                              <td className="p-2 font-mono font-bold text-indigo-600 whitespace-nowrap">{calculation.pbSheets_door_4x6}장</td>
                              <td className="p-2 text-right font-mono font-bold text-slate-900 whitespace-nowrap">{calculation.pbAmount_door_4x6.toLocaleString()}원</td>
                              <td className="p-2 text-slate-400 text-[9px] whitespace-nowrap truncate max-w-[100px]" title="로스율 8% 반영">로스 8%</td>
                            </tr>
                          )}
                          {calculation.pbSheets_door_4x8 > 0 && (
                            <tr className="hover:bg-slate-50 transition">
                              <td className="p-2 font-bold text-slate-900 whitespace-nowrap">심재 (PB 4*8 도어)</td>
                              <td className="p-2 whitespace-nowrap">
                                {pbType === "일반 PB" ? "일반 PB (13,600원)" : "방수 PB (22,000원)"}
                              </td>
                              <td className="p-2 font-mono font-bold text-indigo-600 whitespace-nowrap">{calculation.pbSheets_door_4x8}장</td>
                              <td className="p-2 text-right font-mono font-bold text-slate-900 whitespace-nowrap">{calculation.pbAmount_door_4x8.toLocaleString()}원</td>
                              <td className="p-2 text-slate-400 text-[9px] whitespace-nowrap truncate max-w-[100px]" title="로스율 8% 반영">로스 8%</td>
                            </tr>
                          )}
                          {calculation.pbSheets_base_4x6 > 0 && (
                            <tr className="hover:bg-slate-50 transition">
                              <td className="p-2 font-bold text-slate-900 whitespace-nowrap">심재 (PB 4*6 기본판)</td>
                              <td className="p-2 whitespace-nowrap">
                                {pbType === "일반 PB" ? "일반 PB (11,300원)" : "방수 PB (16,000원)"}
                              </td>
                              <td className="p-2 font-mono font-bold text-indigo-600 whitespace-nowrap">{calculation.pbSheets_base_4x6}장</td>
                              <td className="p-2 text-right font-mono font-bold text-slate-900 whitespace-nowrap">{calculation.pbAmount_base_4x6.toLocaleString()}원</td>
                              <td className="p-2 text-slate-400 text-[9px] whitespace-nowrap truncate max-w-[100px]" title="2400 이하 밑판">2400 이하 밑판</td>
                            </tr>
                          )}
                          {calculation.pbSheets_base_4x8 > 0 && (
                            <tr className="hover:bg-slate-50 transition">
                              <td className="p-2 font-bold text-slate-900 whitespace-nowrap">심재 (PB 4*8 기본판)</td>
                              <td className="p-2 whitespace-nowrap">
                                {pbType === "일반 PB" ? "일반 PB (13,600원)" : "방수 PB (22,000원)"}
                              </td>
                              <td className="p-2 font-mono font-bold text-indigo-600 whitespace-nowrap">{calculation.pbSheets_base_4x8}장</td>
                              <td className="p-2 text-right font-mono font-bold text-slate-900 whitespace-nowrap">{calculation.pbAmount_base_4x8.toLocaleString()}원</td>
                              <td className="p-2 text-slate-400 text-[9px] whitespace-nowrap truncate max-w-[100px]" title="2400 이하 밑판">2400 이하 밑판</td>
                            </tr>
                          )}
                          {calculation.pbSheets_splice_4x8 > 0 && (
                            <tr className="hover:bg-slate-50 transition">
                              <td className="p-2 font-bold text-slate-900 whitespace-nowrap">심재 (PB 4*8 연장판)</td>
                              <td className="p-2 whitespace-nowrap">
                                {pbType === "일반 PB" ? "일반 PB (13,600원)" : "방수 PB (22,000원)"}
                              </td>
                              <td className="p-2 font-mono font-bold text-indigo-600 whitespace-nowrap">{calculation.pbSheets_splice_4x8}장</td>
                              <td className="p-2 text-right font-mono font-bold text-slate-900 whitespace-nowrap">{calculation.pbAmount_splice_4x8.toLocaleString()}원</td>
                              <td className="p-2 text-slate-400 text-[9px] whitespace-nowrap truncate max-w-[100px]" title="2400 초과 조인용">2400 초과 조인용</td>
                            </tr>
                          )}
                          {/* 심재 소계 (4*8) */}
                          {calculation.pbSheets > 0 && (
                            <tr className="bg-slate-100/60 font-semibold border-t-2 border-slate-200">
                              <td className="p-2 font-bold text-slate-900 whitespace-nowrap">심재 소계 (4*8)</td>
                              <td className="p-2 text-slate-400 whitespace-nowrap">-</td>
                              <td className="p-2 font-mono font-bold text-indigo-600 whitespace-nowrap">{calculation.pbSheets}장</td>
                              <td className="p-2 text-right font-mono font-bold text-slate-900 whitespace-nowrap">{calculation.pbAmount.toLocaleString()}원</td>
                              <td className="p-2 text-indigo-600 font-bold text-[9px] whitespace-nowrap" title="PB 총 발주량">PB 총 발주량</td>
                            </tr>
                          )}
                          {/* 마감재 HPM */}
                          {calculation.hpmSheets_4x6 > 0 && (
                            <tr className="hover:bg-slate-50 transition">
                              <td className="p-2 font-bold text-slate-900 whitespace-nowrap">마감재 (HPM 4*6)</td>
                              <td className="p-2 whitespace-nowrap">
                                {hpmType === "일반 HPM" ? "일반 HPM (9,500원)" : "메탈 HPM (25,000원)"}
                              </td>
                              <td className="p-2 font-mono font-bold text-indigo-600 whitespace-nowrap">{calculation.hpmSheets_4x6}장</td>
                              <td className="p-2 text-right font-mono font-bold text-slate-900 whitespace-nowrap">{calculation.hpmAmount_4x6.toLocaleString()}원</td>
                              <td className="p-2 text-slate-400 text-[9px] whitespace-nowrap truncate max-w-[100px]" title="양면 부착">양면 부착</td>
                            </tr>
                          )}
                          {calculation.hpmSheets_4x8 > 0 && (
                            <tr className="hover:bg-slate-50 transition">
                              <td className="p-2 font-bold text-slate-900 whitespace-nowrap">마감재 (HPM 4*8)</td>
                              <td className="p-2 whitespace-nowrap">
                                {hpmType === "일반 HPM" ? "일반 HPM (14,000원)" : "메탈 HPM (25,000원)"}
                              </td>
                              <td className="p-2 font-mono font-bold text-indigo-600 whitespace-nowrap">{calculation.hpmSheets_4x8}장</td>
                              <td className="p-2 text-right font-mono font-bold text-slate-900 whitespace-nowrap">{calculation.hpmAmount_4x8.toLocaleString()}원</td>
                              <td className="p-2 text-slate-400 text-[9px] whitespace-nowrap truncate max-w-[100px]" title="양면 부착">양면 부착</td>
                            </tr>
                          )}
                          {calculation.hpmSheets_4x10 > 0 && (
                            <tr className="hover:bg-slate-50 transition">
                              <td className="p-2 font-bold text-slate-900 whitespace-nowrap">마감재 (HPM 4*10)</td>
                              <td className="p-2 whitespace-nowrap">
                                {hpmType === "일반 HPM" ? "일반 HPM (19,500원)" : "메탈 HPM (34,000원)"}
                              </td>
                              <td className="p-2 font-mono font-bold text-indigo-600 whitespace-nowrap">{calculation.hpmSheets_4x10}장</td>
                              <td className="p-2 text-right font-mono font-bold text-slate-900 whitespace-nowrap">{calculation.hpmAmount_4x10.toLocaleString()}원</td>
                              <td className="p-2 text-slate-400 text-[9px] whitespace-nowrap truncate max-w-[100px]" title="양면 부착">양면 부착</td>
                            </tr>
                          )}
                          {/* 하드웨어 */}
                          <tr className="hover:bg-slate-50 transition">
                            <td className="p-2 font-bold text-slate-900 whitespace-nowrap">하드웨어</td>
                            <td className="p-2 whitespace-nowrap text-slate-500">8,000원/㎡</td>
                            <td className="p-2 font-mono text-slate-600 whitespace-nowrap">{quantity}㎡</td>
                            <td className="p-2 text-right font-mono font-bold text-slate-900 whitespace-nowrap">{calculation.hardwareAmount.toLocaleString()}원</td>
                            <td className="p-2 text-slate-400 text-[9px] whitespace-nowrap">고정단가</td>
                          </tr>
                          {/* 가공비 */}
                          <tr className="hover:bg-slate-50 transition">
                            <td className="p-2 font-bold text-slate-900 whitespace-nowrap">가공비</td>
                            <td className="p-2 whitespace-nowrap text-slate-500">10,000원/㎡</td>
                            <td className="p-2 font-mono text-slate-600 whitespace-nowrap">{quantity}㎡</td>
                            <td className="p-2 text-right font-mono font-bold text-slate-900 whitespace-nowrap">{calculation.bondingAmount.toLocaleString()}원</td>
                            <td className="p-2 text-slate-400 text-[9px] whitespace-nowrap">고정단가</td>
                          </tr>
                          {/* 시공비 */}
                          <tr className="hover:bg-slate-50 transition">
                            <td className="p-2 font-bold text-slate-900 whitespace-nowrap">시공비</td>
                            <td className="p-2 whitespace-nowrap text-slate-[11px] truncate max-w-[100px]">
                              {(baseboard === '전체' ? 14000 : baseboard === '전면' ? 13000 : 11000).toLocaleString()}원/㎡
                            </td>
                            <td className="p-2 font-mono text-slate-600 whitespace-nowrap">{quantity}㎡</td>
                            <td className="p-2 text-right font-mono font-bold text-slate-900 whitespace-nowrap">{calculation.laborAmount.toLocaleString()}원</td>
                            <td className="p-2 text-slate-400 text-[9px] whitespace-nowrap">걸레받이</td>
                          </tr>
                          {/* 전면 걸레받이 */}
                          <tr className="hover:bg-slate-50 transition">
                            <td className="p-2 font-bold text-slate-900 whitespace-nowrap">전면 걸레받이</td>
                            <td className="p-2 whitespace-nowrap text-slate-500">3,000원/㎡</td>
                            <td className="p-2 font-mono text-slate-600 whitespace-nowrap">{quantity}㎡</td>
                            <td className="p-2 text-right font-mono font-bold text-slate-900 whitespace-nowrap">
                              {(baseboard === "전면" ? calculation.baseboardAmount : 0).toLocaleString()}원
                            </td>
                            <td className="p-2 text-slate-400 text-[9px] whitespace-nowrap">{baseboard === "전면" ? "적용" : "-"}</td>
                          </tr>
                          {/* 전체 걸레받이 */}
                          <tr className="hover:bg-slate-50 transition">
                            <td className="p-2 font-bold text-slate-900 whitespace-nowrap">전체 걸레받이</td>
                            <td className="p-2 whitespace-nowrap text-slate-500">5,000원/㎡</td>
                            <td className="p-2 font-mono text-slate-600 whitespace-nowrap">{quantity}㎡</td>
                            <td className="p-2 text-right font-mono font-bold text-slate-900 whitespace-nowrap">
                              {(baseboard === "전체" ? calculation.baseboardAmount : 0).toLocaleString()}원
                            </td>
                            <td className="p-2 text-slate-400 text-[9px] whitespace-nowrap">{baseboard === "전체" ? "적용" : "-"}</td>
                          </tr>
                          {/* 공과잡비 */}
                          <tr className="hover:bg-slate-50 transition bg-slate-50/50">
                            <td className="p-2 font-bold text-slate-950 whitespace-nowrap">공과잡비</td>
                            <td className="p-2 text-slate-500 whitespace-nowrap">3% (올림)</td>
                            <td className="p-2 font-mono whitespace-nowrap">-</td>
                            <td className="p-2 text-right font-mono font-bold text-slate-900 whitespace-nowrap">{calculation.overhead.toLocaleString()}원</td>
                            <td className="p-2 text-slate-400 text-[9px] whitespace-nowrap">-</td>
                          </tr>
                          {/* 최종 합계 */}
                          <tr className="bg-sky-50 text-sky-950 font-bold border-t border-sky-100">
                            <td className="p-2 font-extrabold text-[12px] whitespace-nowrap" colSpan={2}>실행 합계</td>
                            <td className="p-2 font-mono whitespace-nowrap">-</td>
                            <td className="p-2 text-right font-mono text-[12px] font-extrabold text-sky-700 whitespace-nowrap">
                              {calculation.totalCost.toLocaleString()}원
                            </td>
                            <td className="p-2 text-[10px] font-semibold text-slate-500 whitespace-nowrap">㎡당 {calculation.costPerHebe.toLocaleString()}원</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* ■ 2. 영업이익별 마진/견적가 비교표 */}
                  <div className="lg:col-span-5 bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                    <div className="p-3 border-b border-slate-100 flex items-center justify-between">
                      <h3 className="text-xs font-bold text-slate-950 flex items-center gap-1.5">
                        <span className="w-1.5 h-3.5 bg-emerald-500 rounded-full inline-block"></span>
                        ■ 2. 영업이익 비교표
                      </h3>
                      <span className="text-[9px] text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded font-bold font-mono">20%~35% 분석</span>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-[11px] border-collapse min-w-[280px]">
                        <thead>
                          <tr className="bg-slate-50 text-slate-500 font-bold border-b border-slate-100 text-[10px]">
                            <th className="p-2 py-1.5 text-center whitespace-nowrap">영업이익률</th>
                            <th className="p-2 py-1.5 text-left whitespace-nowrap">㎡당 단가</th>
                            <th className="p-2 py-1.5 text-left whitespace-nowrap">최종 총견적</th>
                            <th className="p-2 py-1.5 text-right whitespace-nowrap">예상 순이익</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-slate-700">
                          {scenarios.map((scenario) => (
                            <tr key={scenario.rate} className="hover:bg-slate-50 transition">
                              <td className="p-2 text-center font-bold text-slate-900 bg-slate-50/20 whitespace-nowrap">
                                {(scenario.rate * 100).toFixed(0)}%
                              </td>
                              <td className="p-2 font-mono font-bold text-slate-800 whitespace-nowrap">
                                {scenario.pricePerHebe.toLocaleString()}원
                              </td>
                              <td className="p-2 font-mono font-extrabold text-sky-600 whitespace-nowrap">
                                {scenario.totalQuote.toLocaleString()}원
                              </td>
                              <td className="p-2 text-right font-mono font-bold text-emerald-600 whitespace-nowrap">
                                +{scenario.estimatedProfit.toLocaleString()}원
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="p-2 bg-slate-50 border-t border-slate-100">
                      <p className="text-[9px] text-slate-500 leading-tight text-center">
                        ※ ⌈(실행가 ÷ (1-이익률)) ÷ 물량⌉ 및 ⌈실행가 ÷ (1-이익률)⌉ 공식을 엄밀하게 적용한 영업 제안가입니다.
                      </p>
                    </div>
                  </div>

                </div>
              </div>
            )}

          </div>
        </div>
      </main>
    </div>
  );
}
