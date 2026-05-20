// 큐비클 적산 계산 유틸리티

export interface CubicleInputs {
  frontHeight: number;
  doorHeight: number;
  partitionHeight: number;
  pbType: "일반 PB" | "방수 PB";
  hpmType: "일반 HPM" | "메탈 HPM";
  baseboard: "없음" | "전면" | "전체";
  quantity: number;
}

export interface DetailedRow {
  item: string;
  option: string;
  unitPriceText: string;
  quantityText: string;
  amount: number;
  note: string;
}

export interface CalculationResult {
  pbPricePerSheet: number;
  pbSheets: number;
  pbAmount: number;
  
  hpmPricePerSheet: number;
  hpmSheets: number;
  hpmAmount: number;
  
  hardwareAmount: number;
  bondingAmount: number;
  laborAmount: number;
  baseboardAmount: number;
  
  subtotal: number;
  overhead: number; // 공과잡비 (3%)
  totalCost: number; // 최종 실행가
  costPerHebe: number; // 1헤베당 실행가
}

function calculatePanelSubArea(
  subArea: number,
  panelHeight: number,
  pbType: "일반 PB" | "방수 PB",
  hpmType: "일반 HPM" | "메탈 HPM"
) {
  // This is kept for safety or backwards compatibility, but we will calculate the pooled quantities directly in calculateCubicle.
  return {
    pbSheets: 0,
    hpmSheets: 0,
    pbAmount: 0,
    hpmAmount: 0
  };
}

export function calculateCubicle(inputs: CubicleInputs): CalculationResult {
  const { frontHeight, doorHeight, partitionHeight, pbType, hpmType, baseboard, quantity } = inputs;

  const fHeight = frontHeight > 0 ? frontHeight : 1800;
  const dHeight = doorHeight > 0 ? doorHeight : 1800;
  const pHeight = partitionHeight > 0 ? partitionHeight : 1800;
  const qty = quantity > 0 ? quantity : 0;

  // Area distributions
  const frontArea = qty * 0.20;
  const doorArea = qty * 0.30;
  const partitionArea = qty * 0.50;

  // Statically determine unit prices for each panel based on height
  const getPanelPrices = (height: number) => {
    let pbPriceVal = 0;
    let hpmPriceVal = 0;
    if (height <= 1800) {
      pbPriceVal = pbType === "일반 PB" ? 11300 : 16000;
      hpmPriceVal = hpmType === "일반 HPM" ? 9500 : 25000;
    } else if (height <= 2400) {
      pbPriceVal = pbType === "일반 PB" ? 13600 : 22000;
      hpmPriceVal = hpmType === "일반 HPM" ? 14000 : 25000;
    } else {
      pbPriceVal = pbType === "일반 PB" ? 13600 : 22000;
      hpmPriceVal = hpmType === "일반 HPM" ? 19500 : 34000;
    }
    return { pbPriceVal, hpmPriceVal };
  };

  const frontPrices = getPanelPrices(fHeight);
  const doorPrices = getPanelPrices(dHeight);
  const partitionPrices = getPanelPrices(pHeight);

  // 1. Door Panels (Width 600mm)
  // - Total pieces needed = (Total Area * 0.30) assigned area converted back to pieces, or simply: Since width is 600mm, 1 raw board (1220mm width) yields exactly 2 pieces.
  // - Formula: HPM Qty = Math.ceil((Total Doors Count * 2 sides) / 2)
  const totalDoorsCount = doorArea / (0.6 * (dHeight / 1000));
  const doorHpmSheets = Math.ceil((totalDoorsCount * 2) / 2);
  const doorPbBase = Math.ceil(totalDoorsCount / 2);
  const doorPbSheets = dHeight > 2400 
    ? Math.ceil(doorPbBase * (dHeight / 2400)) 
    : doorPbBase;

  // 2. Front Panels (Total Width 920mm per set)
  // - Do not round up per side. Calculate the total linear width needed for all sets combined (both sides included).
  // - Total Width = (Number of sets * 920mm * 2 sides)
  // - Formula: HPM Qty = Math.ceil(Total Width / 1220)
  const numSets = frontArea / (0.92 * (fHeight / 1000));
  const totalWidthFront = numSets * 920 * 2;
  const frontHpmSheets = Math.ceil(totalWidthFront / 1220);
  const frontPbBase = Math.ceil((numSets * 920) / 1220);
  const frontPbSheets = fHeight > 2400 
    ? Math.ceil(frontPbBase * (fHeight / 2400)) 
    : frontPbBase;

  // 3. Partition/Inter-wall Panels (Width 1480mm)
  // - Requires 1 full board (1220mm) + 1 extension piece (260mm) per side.
  // - For N total sides (Partitions * 2):
  //   * Full boards needed = N
  //   * Extension pieces needed = N (Since 1 raw board yields 4 pieces of 260mm, Extension boards = Math.ceil(N / 4))
  // - Formula: HPM Qty = N + Math.ceil(N / 4)
  const numPartitions = partitionArea / (1.48 * (pHeight / 1000));
  const partitionNSides = numPartitions * 2;
  const N = Math.ceil(partitionNSides);
  const partitionHpmSheets = N + Math.ceil(N / 4);
  const N_pb = Math.ceil(numPartitions);
  const partitionPbBase = N_pb + Math.ceil(N_pb / 4);
  const partitionPbSheets = pHeight > 2400 
    ? Math.ceil(partitionPbBase * (pHeight / 2400)) 
    : partitionPbBase;

  // Total sheets
  const pbSheets = doorPbSheets + frontPbSheets + partitionPbSheets;
  const hpmSheets = doorHpmSheets + frontHpmSheets + partitionHpmSheets;

  // Amounts
  const pbAmount = (doorPbSheets * doorPrices.pbPriceVal) + (frontPbSheets * frontPrices.pbPriceVal) + (partitionPbSheets * partitionPrices.pbPriceVal);
  const hpmAmount = (doorHpmSheets * doorPrices.hpmPriceVal) + (frontHpmSheets * frontPrices.hpmPriceVal) + (partitionHpmSheets * partitionPrices.hpmPriceVal);

  const pbPricePerSheet = pbSheets > 0 ? Math.round(pbAmount / pbSheets) : 0;
  const hpmPricePerSheet = hpmSheets > 0 ? Math.round(hpmAmount / hpmSheets) : 0;

  // 3. 고정 공정비 및 걸레받이
  const hardwareAmount = quantity * 8000;
  const bondingAmount = quantity * 10000;

  let laborUnitPrice = 11000;
  let baseboardUnitPrice = 0;
  if (baseboard === "전면") {
    laborUnitPrice = 13000;
    baseboardUnitPrice = 3000;
  } else if (baseboard === "전체") {
    laborUnitPrice = 14000;
    baseboardUnitPrice = 5000;
  }
  
  const laborAmount = quantity * laborUnitPrice;
  const baseboardAmount = quantity * baseboardUnitPrice;

  // 실행 소계
  const subtotal = pbAmount + hpmAmount + hardwareAmount + bondingAmount + laborAmount + baseboardAmount;
  
  // 공과잡비 (3% 올림)
  const overhead = Math.ceil(subtotal * 0.03);
  
  // 최종 실행 합계
  const totalCost = subtotal + overhead;
  const costPerHebe = quantity > 0 ? Math.round(totalCost / quantity) : 0;

  return {
    pbPricePerSheet,
    pbSheets,
    pbAmount,
    hpmPricePerSheet,
    hpmSheets,
    hpmAmount,
    hardwareAmount,
    bondingAmount,
    laborAmount,
    baseboardAmount,
    subtotal,
    overhead,
    totalCost,
    costPerHebe
  };
}

export interface ProfitScenario {
  rate: number; // 0.20, 0.25, 0.30, 0.35
  pricePerHebe: number;
  totalQuote: number;
  estimatedProfit: number;
}

export function getProfitScenarios(totalCost: number, quantity: number): ProfitScenario[] {
  const rates = [0.20, 0.25, 0.30, 0.35];
  return rates.map(rate => {
    // 산식: ⌈실행가 ÷ (1-이익률)⌉
    const totalQuote = Math.ceil(totalCost / (1 - rate));
    // ⌈(실행가 ÷ (1-이익률)) ÷ 물량⌉
    const pricePerHebe = quantity > 0 ? Math.ceil(totalQuote / quantity) : 0;
    const estimatedProfit = totalQuote - totalCost;
    return {
      rate,
      pricePerHebe,
      totalQuote,
      estimatedProfit
    };
  });
}
