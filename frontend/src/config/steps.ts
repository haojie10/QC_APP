/**
 * 18 步验货流程配置
 * 每步包含 ID、标题、说明、参考图路径
 */

export interface StepConfig {
  id: string;
  title: string;
  description: string;
  referenceImage: string;
  group: string;
}

export const STEP_GROUPS = [
  { id: '1', name: '大货与外箱' },
  { id: '2', name: '外箱尺寸' },
  { id: '3', name: '唛头' },
  { id: '4', name: '产品检查' },
  { id: '5', name: '产品尺寸' },
];

export const ALL_STEPS: StepConfig[] = [
  // 第 1 组：大货与外箱
  {
    id: '1.1',
    title: '大货图片',
    description: '拍摄整个托盘或大批货物的全景照片，确保货物数量可见',
    referenceImage: '/demo/1.1大货.png',
    group: '1',
  },
  {
    id: '1.2',
    title: '外箱图片',
    description: '拍摄外包装箱的整体照片，展示箱体状态',
    referenceImage: '/demo/1.2外箱.png',
    group: '1',
  },
  {
    id: '1.3',
    title: '开箱图片',
    description: '拍摄打开的外箱，展示内部产品排列',
    referenceImage: '/demo/1.3开箱.png',
    group: '1',
  },

  // 第 2 组：外箱尺寸
  {
    id: '2.1',
    title: '外箱长度',
    description: '使用卷尺测量外箱长度，确保刻度清晰可见',
    referenceImage: '/demo/2.1外箱长.png',
    group: '2',
  },
  {
    id: '2.2',
    title: '外箱宽度',
    description: '使用卷尺测量外箱宽度，确保刻度清晰可见',
    referenceImage: '/demo/2.2外箱宽.png',
    group: '2',
  },
  {
    id: '2.3',
    title: '外箱高度',
    description: '使用卷尺测量外箱高度，确保刻度清晰可见',
    referenceImage: '/demo/2.3外箱高.png',
    group: '2',
  },
  {
    id: '2.4',
    title: '外箱重量',
    description: '使用电子秤称量外箱重量，拍摄秤面读数',
    referenceImage: '/demo/2.4外箱重.png',
    group: '2',
  },

  // 第 3 组：唛头
  {
    id: '3.1',
    title: '正唛',
    description: '拍摄外箱正面标签（正唛），确保文字清晰',
    referenceImage: '/demo/3.1正唛.png',
    group: '3',
  },
  {
    id: '3.2',
    title: '侧唛',
    description: '拍摄外箱侧面标签（侧唛），确保文字清晰',
    referenceImage: '/demo/3.2侧唛.png',
    group: '3',
  },

  // 第 4 组：产品检查
  {
    id: '4.1',
    title: '带包装产品',
    description: '拍摄产品连同内包装的照片',
    referenceImage: '/demo/4.1产品带包装.png',
    group: '4',
  },
  {
    id: '4.2',
    title: '裸产品',
    description: '拍摄去除包装后的产品照片，展示产品外观',
    referenceImage: '/demo/4.2产品图片.png',
    group: '4',
  },
  {
    id: '4.3',
    title: '产品标识',
    description: '拍摄产品上的标识、认证标志等',
    referenceImage: '/demo/4.3产品标识.png',
    group: '4',
  },
  {
    id: '4.4',
    title: '其他附件',
    description: '拍摄随附的说明书、配件等',
    referenceImage: '/demo/4.4其他附件.png',
    group: '4',
  },

  // 第 5 组：产品尺寸
  {
    id: '5.1',
    title: '产品长度',
    description: '使用卷尺测量产品长度，确保刻度清晰可见',
    referenceImage: '/demo/5.1产品长.png',
    group: '5',
  },
  {
    id: '5.2',
    title: '产品宽度',
    description: '使用卷尺测量产品宽度，确保刻度清晰可见',
    referenceImage: '/demo/5.2产品宽.png',
    group: '5',
  },
  {
    id: '5.3',
    title: '产品高度',
    description: '使用卷尺测量产品高度，确保刻度清晰可见',
    referenceImage: '/demo/5.3产品高.png',
    group: '5',
  },
  {
    id: '5.4',
    title: '产品净重',
    description: '使用电子秤称量产品净重，拍摄秤面读数',
    referenceImage: '/demo/5.4产品重.png',
    group: '5',
  },
];

/**
 * 根据步骤 ID 获取步骤配置
 */
export function getStepById(stepId: string): StepConfig | undefined {
  return ALL_STEPS.find((s) => s.id === stepId);
}

/**
 * 获取下一个未完成的步骤
 */
export function getNextPendingStep(
  completedStepIds: Set<string>,
): StepConfig | null {
  return ALL_STEPS.find((s) => !completedStepIds.has(s.id)) ?? null;
}
